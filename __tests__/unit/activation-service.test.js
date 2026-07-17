/**
 * 会员激活服务 (common/activation-service.js) 单元测试
 * 聚焦：carryoverMemberCreditsToPoints（升级剩余额度转点数）
 *
 * ⚠️ 异步测试必须 await（自研框架），否则 summary 在断言前执行（假绿）。
 *    所有用例在 async run() 内逐个 await 后再输出摘要。
 *
 * 覆盖：
 * 1. 无现有 user_points → 新建 + 写流水
 * 2. 有现有记录 → balance 累加、balance_after 正确
 * 3. 同 orderId 幂等 → 跳过不重发
 * 4. expire_at 现有未过期 → 保留原值（取较晚）
 * 5. expire_at 现有过期 → now+90
 * 6. points<=0 → 直接 return
 * 7. 无 orderId → 正常发放（无幂等键时仍执行）
 */

// ===== 测试框架（与 quota-service.test.js 一致） =====
let passed = 0,
  failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push('FAIL: ' + message);
    console.error('  ✗ ' + message);
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    const msg = message + ' - 期望: ' + JSON.stringify(expected) + ', 实际: ' + JSON.stringify(actual);
    errors.push('FAIL: ' + msg);
    console.error('  ✗ ' + msg);
  }
}

// ===== Mock DB（支持 where/limit/get/update/doc/add + command.inc） =====
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), obj);
}
function matchDoc(doc, query) {
  for (const k of Object.keys(query || {})) {
    const qv = query[k];
    if (qv !== null && qv !== undefined && typeof qv === 'object' && !Array.isArray(qv) && !(qv instanceof Date)) {
      continue; // command 操作符对象（inc），mock 假定通过
    }
    if (getPath(doc, k) !== qv) return false;
  }
  return true;
}

function createMockDb(collections, opts) {
  const _opts = opts || {};
  const data = {};
  Object.keys(collections).forEach((k) => (data[k] = collections[k].slice()));
  const updates = [];
  const command = { inc: (v) => ({ $op: 'inc', v: v }) };

  function chainFor(name) {
    const rows = data[name] || [];
    return {
      where: (query) => {
        const filtered = rows.filter((d) => matchDoc(d, query));
        return {
          limit: (n) => ({ get: async () => ({ data: filtered.slice(0, n) }) }),
          get: async () => ({ data: filtered }),
          update: async ({ data: patch }) => {
            if (filtered.length > 0) filtered.forEach((d) => Object.assign(d, patch));
            updates.push({ collection: name, query: query, patch: patch, updated: filtered.length });
            return { stats: { updated: filtered.length } };
          },
        };
      },
      doc: (id) => ({
        update: async ({ data: patch }) => {
          const found = rows.find((d) => d._id === id);
          if (found) Object.assign(found, patch);
          updates.push({ collection: name, docId: id, patch: patch, updated: found ? 1 : 0 });
          return { stats: { updated: found ? 1 : 0 } };
        },
      }),
      add: async ({ data: doc }) => {
        if (_opts.dupKeyOnAddTxn && name === COLLECTIONS.POINT_TRANSACTIONS) {
          throw { code: 11000, message: 'E11000 duplicate key error' };
        }
        const newDoc = Object.assign({ _id: 'gen_' + (rows.length + 1) }, doc);
        rows.push(newDoc);
        updates.push({ collection: name, add: doc });
        return { _id: newDoc._id };
      },
      get: async () => ({ data: rows }),
    };
  }

  return { command: command, collection: (name) => chainFor(name), _updates: updates, _data: data };
}

const { carryoverMemberCreditsToPoints, activateMembership } = require('../../cloudfunctions/common/activation-service');
const { COLLECTIONS, MEMBER_CREDITS } = require('../../cloudfunctions/common/constants');

const DAY_MS = 24 * 60 * 60 * 1000;

// ===== 主测试流程 =====
async function run() {
  // 1. 无现有记录 → 新建
  console.log('\n=== 1. 无现有 user_points → 新建 + 写流水 ===');
  await (async function () {
    const db = createMockDb({ [COLLECTIONS.USER_POINTS]: [], [COLLECTIONS.POINT_TRANSACTIONS]: [] });
    const now = new Date('2026-07-17T10:00:00Z');
    await carryoverMemberCreditsToPoints({
      db, _: db.command, openid: 'U1', points: 2, orderId: 'O1', relatedMemberId: 'M1', now: now,
    });
    const ups = db._data[COLLECTIONS.USER_POINTS];
    const txs = db._data[COLLECTIONS.POINT_TRANSACTIONS];
    assertEqual(ups.length, 1, '新建 user_points 1 条');
    assertEqual(ups[0].balance, 2, 'balance=2');
    assertEqual(ups[0].total_purchased, 2, 'total_purchased=2');
    assertEqual(ups[0].total_used, 0, 'total_used=0');
    assertEqual(txs.length, 1, '流水 1 条');
    assertEqual(txs[0].type, 'member_upgrade_carryover', '流水 type');
    assertEqual(txs[0].amount, 2, '流水 amount=2');
    assertEqual(txs[0].order_id, 'O1', '流水 order_id');
    assertEqual(txs[0].source, 'member_upgrade', '流水 source');
    assertEqual(txs[0].related_member_id, 'M1', '流水 related_member_id');
    assertEqual(txs[0].balance_after, 2, 'balance_after=2');
  })();

  // 2. 有现有记录 → 累加
  console.log('\n=== 2. 有现有记录 → balance 累加、balance_after 正确 ===');
  await (async function () {
    const futureExpire = new Date('2026-10-17T10:00:00Z');
    const db = createMockDb({
      [COLLECTIONS.USER_POINTS]: [
        { _id: 'UP1', user_id: 'U1', balance: 5, total_purchased: 10, total_used: 5, expire_at: futureExpire },
      ],
      [COLLECTIONS.POINT_TRANSACTIONS]: [],
    });
    const now = new Date('2026-07-17T10:00:00Z');
    await carryoverMemberCreditsToPoints({
      db, _: db.command, openid: 'U1', points: 3, orderId: 'O2', now: now,
    });
    const upUpdate = db._updates.find((u) => u.collection === COLLECTIONS.USER_POINTS && u.docId === 'UP1');
    assert(!!upUpdate, '调用了 user_points doc.update');
    assertEqual(upUpdate.patch.balance.$op, 'inc', 'balance 用 _.inc');
    assertEqual(upUpdate.patch.balance.v, 3, 'balance _.inc(3)');
    assertEqual(upUpdate.patch.total_purchased.v, 3, 'total_purchased _.inc(3)');
    const txs = db._data[COLLECTIONS.POINT_TRANSACTIONS];
    assertEqual(txs[0].balance_after, 8, 'balance_after=5+3=8');
    assertEqual(txs[0].amount, 3, 'amount=3');
    assertEqual(db._data[COLLECTIONS.USER_POINTS].length, 1, '未新建额外 user_points');
  })();

  // 3. 幂等：同 orderId 已发过 → 跳过
  console.log('\n=== 3. 同 orderId 第二次 → 幂等跳过（不重发） ===');
  await (async function () {
    const db = createMockDb({
      [COLLECTIONS.USER_POINTS]: [],
      [COLLECTIONS.POINT_TRANSACTIONS]: [
        { user_id: 'U1', type: 'member_upgrade_carryover', order_id: 'O3', amount: 2 },
      ],
    });
    const beforeTxs = db._data[COLLECTIONS.POINT_TRANSACTIONS].length;
    await carryoverMemberCreditsToPoints({
      db, _: db.command, openid: 'U1', points: 2, orderId: 'O3', now: new Date(),
    });
    assertEqual(db._data[COLLECTIONS.POINT_TRANSACTIONS].length, beforeTxs, '流水数不变');
    assertEqual(db._data[COLLECTIONS.USER_POINTS].length, 0, 'user_points 不新建');
    assertEqual(db._updates.length, 0, '无任何写操作');
  })();

  // 4. expire_at 取较晚：现有未过期（更晚） → 保留原值
  console.log('\n=== 4. expire_at 现有未过期且更晚 → 保留原值 ===');
  await (async function () {
    const futureExpire = new Date('2026-12-31T00:00:00Z'); // 比 now+90 更晚
    const db = createMockDb({
      [COLLECTIONS.USER_POINTS]: [
        { _id: 'UP1', user_id: 'U1', balance: 1, total_purchased: 1, total_used: 0, expire_at: futureExpire },
      ],
      [COLLECTIONS.POINT_TRANSACTIONS]: [],
    });
    const now = new Date('2026-07-17T10:00:00Z');
    await carryoverMemberCreditsToPoints({
      db, _: db.command, openid: 'U1', points: 1, orderId: 'O4', now: now,
    });
    const upUpdate = db._updates.find((u) => u.collection === COLLECTIONS.USER_POINTS);
    assertEqual(upUpdate.patch.expire_at.getTime(), futureExpire.getTime(), '保留更晚的原 expire_at');
  })();

  // 5. expire_at 现有过期 → now+90
  console.log('\n=== 5. expire_at 现有过期 → 用 now+90 ===');
  await (async function () {
    const pastExpire = new Date('2020-01-01T00:00:00Z');
    const db = createMockDb({
      [COLLECTIONS.USER_POINTS]: [
        { _id: 'UP1', user_id: 'U1', balance: 1, total_purchased: 1, total_used: 0, expire_at: pastExpire },
      ],
      [COLLECTIONS.POINT_TRANSACTIONS]: [],
    });
    const now = new Date('2026-07-17T10:00:00Z');
    await carryoverMemberCreditsToPoints({
      db, _: db.command, openid: 'U1', points: 1, orderId: 'O5', now: now,
    });
    const upUpdate = db._updates.find((u) => u.collection === COLLECTIONS.USER_POINTS);
    const expected90 = new Date(now.getTime() + 90 * DAY_MS);
    assertEqual(upUpdate.patch.expire_at.getTime(), expected90.getTime(), '过期 → now+90');
  })();

  // 6. points<=0 → 直接 return
  console.log('\n=== 6. points<=0 → 直接 return，无写操作 ===');
  await (async function () {
    const db = createMockDb({ [COLLECTIONS.USER_POINTS]: [], [COLLECTIONS.POINT_TRANSACTIONS]: [] });
    await carryoverMemberCreditsToPoints({
      db, _: db.command, openid: 'U1', points: 0, orderId: 'O6', now: new Date(),
    });
    assertEqual(db._updates.length, 0, 'points=0 无写操作');
  })();

  // 7. 无 orderId → 仍发放（正常场景 orderId 必传，此处验证不崩）
  console.log('\n=== 7. 无 orderId → 正常发放 ===');
  await (async function () {
    const db = createMockDb({ [COLLECTIONS.USER_POINTS]: [], [COLLECTIONS.POINT_TRANSACTIONS]: [] });
    await carryoverMemberCreditsToPoints({
      db, _: db.command, openid: 'U1', points: 2, orderId: '', now: new Date(),
    });
    assertEqual(db._data[COLLECTIONS.USER_POINTS].length, 1, '无 orderId 仍新建 user_points');
    assertEqual(db._data[COLLECTIONS.POINT_TRANSACTIONS][0].order_id, '', '流水 order_id 为空串');
  })();

  // 8. [集成] activateMembership 升级 月卡→年卡：剩余 2 次 → 转 2 点 + 额度重置
  console.log('\n=== 8. [集成] activateMembership 升级 月卡(used=1,total=3)→年卡 ===');
  await (async function () {
    const now = new Date('2026-07-17T10:00:00Z');
    const monthExpire = new Date('2026-08-15T10:00:00Z');
    const start = new Date('2026-07-15T10:00:00Z');
    const futurePointsExpire = new Date('2026-10-17T10:00:00Z');
    const db = createMockDb({
      [COLLECTIONS.MEMBERS]: [{
        _id: 'M1', user_id: 'U1', type: 'monthly', status: 'active',
        expire_date: monthExpire, start_date: start,
        report_credits_total: 3, report_credits_used: 1,
        report_credits_reset_at: monthExpire, activated_by_order: 'OLD_ORDER',
      }],
      [COLLECTIONS.USER_POINTS]: [
        { _id: 'UP1', user_id: 'U1', balance: 5, total_purchased: 5, total_used: 0, expire_at: futurePointsExpire },
      ],
      [COLLECTIONS.POINT_TRANSACTIONS]: [],
      [COLLECTIONS.USERS]: [{ _id: 'US1', user_id: 'U1', isMember: true }],
    });
    const res = await activateMembership({
      db, _: db.command, dbCredits: MEMBER_CREDITS,
      openid: 'U1', memberType: 'yearly', orderId: 'NEW_UPGRADE_O', now: now,
    });
    assertEqual(res.activated, true, 'activated=true');
    // members 原地更新：type=yearly、used 重置 0、total=YEARLY_REPORTS(3)
    const m = db._data[COLLECTIONS.MEMBERS][0];
    assertEqual(m.type, 'yearly', 'members.type 切到 yearly');
    assertEqual(m.report_credits_used, 0, 'report_credits_used 重置 0');
    assertEqual(m.report_credits_total, 3, 'report_credits_total=YEARLY_REPORTS(3)');
    assertEqual(m.activated_by_order, 'NEW_UPGRADE_O', 'activated_by_order 更新为新订单');
    // user_points: remaining = 3 - 1 = 2 → balance _.inc(2)
    const upUpdate = db._updates.find((u) => u.collection === COLLECTIONS.USER_POINTS);
    assert(!!upUpdate, '触发了 user_points 更新');
    assertEqual(upUpdate.patch.balance.v, 2, 'balance _.inc(2)');
    assertEqual(upUpdate.patch.total_purchased.v, 2, 'total_purchased _.inc(2)');
    // 流水
    const txs = db._data[COLLECTIONS.POINT_TRANSACTIONS];
    assertEqual(txs.length, 1, '1 条转点数流水');
    assertEqual(txs[0].type, 'member_upgrade_carryover', '流水 type');
    assertEqual(txs[0].amount, 2, '转 2 点');
    assertEqual(txs[0].order_id, 'NEW_UPGRADE_O', '流水 order_id');
    assertEqual(txs[0].balance_after, 7, 'balance_after=5+2=7');
  })();

  // 9. [并发] 写流水命中 duplicate key → 视为已发放、跳过余额更新（防重复发点数）
  console.log('\n=== 9. [并发] 写流水 duplicate key → 跳过余额更新 ===');
  await (async function () {
    const db = createMockDb(
      {
        [COLLECTIONS.USER_POINTS]: [
          { _id: 'UP1', user_id: 'U1', balance: 5, total_purchased: 5, total_used: 0, expire_at: new Date('2026-10-17T00:00:00Z') },
        ],
        [COLLECTIONS.POINT_TRANSACTIONS]: [],
      },
      { dupKeyOnAddTxn: true }
    );
    await carryoverMemberCreditsToPoints({
      db, _: db.command, openid: 'U1', points: 2, orderId: 'O9', now: new Date(),
    });
    // 余额更新被跳过（不重复发）
    const upUpdates = db._updates.filter((u) => u.collection === COLLECTIONS.USER_POINTS);
    assertEqual(upUpdates.length, 0, 'duplicate key 时未更新 user_points');
    assertEqual(db._data[COLLECTIONS.USER_POINTS][0].balance, 5, '余额未被 +2（仍为 5）');
  })();

  console.log('\n========== SUMMARY: ' + passed + ' passed, ' + failed + ' failed ==========');
  if (failed > 0) {
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('TEST ERROR', e);
  process.exit(1);
});
