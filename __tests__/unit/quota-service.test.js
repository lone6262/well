/**
 * 报告额度服务 (common/quota-service.js) 单元测试
 * TDD: RED → GREEN → REFACTOR
 *
 * ⚠️ 注意：异步测试必须 await，否则 summary 会在断言完成前执行（假绿）。
 *    本文件用 async run() 包裹所有测试，逐个 await 后再输出摘要。
 *
 * 测试覆盖（计费核心模块，0 覆盖补全）：
 * 1. calcNextReset 纯日期逻辑（跨月/月末 clamp/跨年）
 * 2. resolveQuota 六级优先级链：首份 > 邀请 > 体验 > 正式 > 点数 > 付费
 *    - 首份优惠 ORDERS 交叉验证（防删号重注册绕过）
 *    - 会员/体验额度到期自动重置
 *    - 旧会员 total 迁移
 * 3. deductQuota 条件更新原子性 + 并发重试
 * 4. rollbackQuota 反向操作幂等 + 错误吞咽
 */

// ===== 测试框架 =====
let passed = 0,
  failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push(`FAIL: ${message}`);
    console.error(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    const msg = `${message} - 期望: ${JSON.stringify(expected)}, 实际: ${JSON.stringify(actual)}`;
    errors.push(`FAIL: ${msg}`);
    console.error(`  ✗ ${msg}`);
  }
}

// ===== 导入被测模块 + 常量 =====
const {
  resolveQuota,
  deductQuota,
  rollbackQuota,
  calcNextReset,
} = require('../../cloudfunctions/common/quota-service');
const {
  COLLECTIONS,
  MEMBER_CREDITS,
  PRICES,
  MEMBER_STATUS,
  ORDER_STATUS,
  ORDER_TYPES,
} = require('../../cloudfunctions/common/constants');

// ===== Mock 数据库工厂（支持 get/count/update/doc/add + command 操作符） =====
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o === null || o === undefined ? o : o[k]), obj);
}

// where 查询匹配：仅匹配字面量字段，跳过 command 操作符对象
function matchDoc(doc, query) {
  for (const k of Object.keys(query || {})) {
    const qv = query[k];
    if (qv !== null && qv !== undefined && typeof qv === 'object' && !Array.isArray(qv) && !(qv instanceof Date)) {
      continue; // command 操作符（neq/gt/lt/inc），mock 假定通过
    }
    if (getPath(doc, k) !== qv) return false;
  }
  return true;
}

function createQuotaMockDb(collections = {}, opts = {}) {
  const data = {};
  Object.keys(collections).forEach((k) => (data[k] = collections[k].slice()));
  const updates = [];

  const command = {
    neq: (v) => ({ $op: 'neq', v }),
    gt: (v) => ({ $op: 'gt', v }),
    lt: (v) => ({ $op: 'lt', v }),
    inc: (v) => ({ $op: 'inc', v }),
    in: (v) => ({ $op: 'in', v }), // F5: 支持 _.in([PENDING, PAID])
  };

  function chainFor(name) {
    const rows = data[name] || [];
    return {
      where: (query) => {
        const filtered = rows.filter((d) => matchDoc(d, query));
        return {
          orderBy: (_field, _dir) => ({
            limit: (n) => ({ get: async () => ({ data: filtered.slice(0, n) }) }),
            get: async () => ({ data: filtered }),
          }),
          limit: (n) => ({ get: async () => ({ data: filtered.slice(0, n) }) }),
          get: async () => ({ data: filtered }),
          count: async () => ({ total: filtered.length }),
          update: async ({ data: patch }) => {
            const updatedCount = opts.forceUpdateZero || filtered.length === 0 ? 0 : filtered.length;
            if (updatedCount > 0) filtered.forEach((d) => Object.assign(d, patch));
            updates.push({ collection: name, query, patch, updated: updatedCount });
            return { stats: { updated: updatedCount } };
          },
        };
      },
      doc: (id) => ({
        get: async () => ({ data: rows.find((d) => d._id === id) || null }),
        update: async ({ data: patch }) => {
          const found = rows.find((d) => d._id === id);
          const updatedCount = opts.forceUpdateZero || !found ? 0 : 1;
          if (updatedCount > 0) Object.assign(found, patch);
          updates.push({ collection: name, docId: id, patch, updated: updatedCount });
          return { stats: { updated: updatedCount } };
        },
      }),
      add: async ({ data: doc }) => {
        if (opts.throwOnAdd) throw new Error('mock add conflict');
        const newDoc = { _id: 'gen_' + (rows.length + 1), ...doc };
        rows.push(newDoc);
        updates.push({ collection: name, add: doc });
        return { _id: newDoc._id };
      },
      get: async () => ({ data: rows }),
    };
  }

  return {
    command,
    RegExp: ({ regexp }) => ({ $regexp: regexp }),
    collection: (name) => chainFor(name),
    _updates: updates,
    _data: data,
  };
}

// ===== 主测试流程（所有异步测试在此逐个 await） =====
async function run() {
  // ========== 1. calcNextReset 纯日期逻辑 ==========

  console.log('\n=== 1. calcNextReset 基础跨月 ===');
  (function testCalcNextResetBasic() {
    const start = new Date(2026, 0, 15, 9, 30, 0); // 1月15日
    const currentReset = new Date(2026, 1, 15); // 2月15日（月索引1）
    const next = calcNextReset(start, currentReset);
    assertEqual(next.getMonth(), 2, '基础: 下一个月是 3 月（索引2）');
    assertEqual(next.getDate(), 15, '基础: 对齐起始日 15');
    assertEqual(next.getHours(), 9, '基础: 保留小时');
    assertEqual(next.getFullYear(), 2026, '基础: 同年');
  })();

  console.log('\n=== 2. calcNextReset 月末 clamp（31日 → 短月） ===');
  (function testCalcNextResetMonthEndClamp() {
    const start = new Date(2026, 0, 31);
    const currentReset = new Date(2026, 2, 31); // 3月31日（月索引2）
    const next = calcNextReset(start, currentReset);
    assertEqual(next.getMonth(), 3, '月末: 下一月 4 月（索引3）');
    assertEqual(next.getDate(), 30, '月末: 4月只有30天，clamp 到 30');
  })();

  console.log('\n=== 3. calcNextReset 2月 clamp（非闰年） ===');
  (function testCalcNextResetFebClamp() {
    const start = new Date(2026, 0, 31);
    const currentReset = new Date(2026, 0, 31); // 月索引0 → 2月
    const next = calcNextReset(start, currentReset);
    assertEqual(next.getMonth(), 1, '闰年: 下一月 2 月（索引1）');
    assertEqual(next.getDate(), 28, '闰年: 2026年2月28天，clamp 到 28');
  })();

  console.log('\n=== 4. calcNextReset 跨年（12月 → 次年1月） ===');
  (function testCalcNextResetYearWrap() {
    const start = new Date(2026, 11, 15); // 月索引11
    const currentReset = new Date(2026, 11, 15);
    const next = calcNextReset(start, currentReset);
    assertEqual(next.getMonth(), 0, '跨年: 下一月 1 月（索引0）');
    assertEqual(next.getFullYear(), 2027, '跨年: 年份进位到 2027');
    assertEqual(next.getDate(), 15, '跨年: 对齐起始日 15');
  })();

  console.log('\n=== 5. calcNextReset 保留时分秒 ===');
  (function testCalcNextResetTimePreserved() {
    const start = new Date(2026, 5, 10, 14, 25, 45);
    const currentReset = new Date(2026, 6, 10);
    const next = calcNextReset(start, currentReset);
    assertEqual(next.getHours(), 14, '保留小时 14');
    assertEqual(next.getMinutes(), 25, '保留分钟 25');
    assertEqual(next.getSeconds(), 45, '保留秒 45');
  })();

  // ========== resolveQuota 优先级链 ==========

  console.log('\n=== 6. resolveQuota: 新用户首份优惠 ===');
  await (async function testResolveFirstReportNewUser() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_new', PRICES, MEMBER_CREDITS);
    assertEqual(q.has_free_quota, true, '新用户有免费额度');
    assertEqual(q.quota_source, 'first_report', '来源 first_report');
    assertEqual(q.price, PRICES.FIRST_REPORT, '价格为首份优惠价');
    assertEqual(q.userExists, false, '用户记录不存在');
  })();

  console.log('\n=== 7. resolveQuota: 首份优惠 ORDERS 交叉验证（防删号重注册） ===');
  await (async function testResolveFirstReportCrossValidate() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [],
      [COLLECTIONS.ORDERS]: [
        {
          _id: 'o1',
          user_id: 'openid_x',
          type: ORDER_TYPES.REPORT,
          metadata: { is_first_report: true },
          status: ORDER_STATUS.PAID,
        },
      ],
      [COLLECTIONS.MEMBERS]: [],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_x', PRICES, MEMBER_CREDITS);
    assertEqual(q.quota_source, 'paid', '曾有首份订单 → 回退到付费');
    assertEqual(q.has_free_quota, false, '无免费额度');
    assertEqual(q.price, PRICES.STANDARD_REPORT, '价格为标准报告价');
  })();

  console.log('\n=== 8. resolveQuota: 邀请奖励额度 ===');
  await (async function testResolveInvite() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_inv', first_report_used: true, invite_reward_credits: 3 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_inv');
    assertEqual(q.quota_source, 'invite', '来源 invite');
    assertEqual(q.has_free_quota, true, '有免费额度');
    assertEqual(q.price, 0, '邀请奖励免费');
  })();

  console.log('\n=== 9. resolveQuota: 体验会员额度 ===');
  await (async function testResolveTrial() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_t', first_report_used: true, invite_reward_credits: 0 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [
        {
          _id: 'm1',
          user_id: 'openid_t',
          status: MEMBER_STATUS.ACTIVE,
          type: 'trial',
          report_credits_used: 0,
          report_credits_total: 1,
          report_credits_reset_at: new Date(Date.now() + 86400000),
        },
      ],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_t');
    assertEqual(q.quota_source, 'trial', '来源 trial');
    assertEqual(q.has_free_quota, true, '体验会员有免费额度');
    assertEqual(q.price, 0, '体验免费');
  })();

  console.log('\n=== 10. resolveQuota: 体验额度到期重置 ===');
  await (async function testResolveTrialReset() {
    const pastReset = new Date(Date.now() - 86400000);
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_tr', first_report_used: true, invite_reward_credits: 0 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [
        {
          _id: 'm1',
          user_id: 'openid_tr',
          status: MEMBER_STATUS.ACTIVE,
          type: 'trial',
          report_credits_used: 1,
          report_credits_total: 1,
          start_date: new Date(2026, 5, 10),
          report_credits_reset_at: pastReset,
        },
      ],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_tr');
    assertEqual(q.quota_source, 'trial', '到期重置后仍可用体验额度');
    assertEqual(q.has_free_quota, true, '重置后有免费额度');
    const resetUpdate = db._updates.find(
      (u) => u.collection === COLLECTIONS.MEMBERS && u.patch && u.patch.report_credits_used === 0
    );
    assert(!!resetUpdate, '触发了 report_credits_used=0 的重置写入');
  })();

  console.log('\n=== 11. resolveQuota: 正式会员（月卡）额度 ===');
  await (async function testResolveMember() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_m', first_report_used: true, invite_reward_credits: 0 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [
        {
          _id: 'm1',
          user_id: 'openid_m',
          status: MEMBER_STATUS.ACTIVE,
          type: 'monthly',
          report_credits_used: 1,
          report_credits_total: 3,
          report_credits_reset_at: new Date(Date.now() + 86400000),
        },
      ],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_m');
    assertEqual(q.quota_source, 'member', '来源 member');
    assertEqual(q.has_free_quota, true, '会员有免费额度');
    assertEqual(q.price, 0, '会员免费');
  })();

  console.log('\n=== 12. resolveQuota: 正式会员额度到期重置 ===');
  await (async function testResolveMemberReset() {
    const pastReset = new Date(Date.now() - 1000);
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_mr', first_report_used: true, invite_reward_credits: 0 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [
        {
          _id: 'm1',
          user_id: 'openid_mr',
          status: MEMBER_STATUS.ACTIVE,
          type: 'monthly',
          report_credits_used: 3,
          report_credits_total: 3,
          start_date: new Date(2026, 5, 10),
          report_credits_reset_at: pastReset,
        },
      ],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_mr');
    assertEqual(q.quota_source, 'member', '会员到期重置后仍可用');
    assertEqual(q.has_free_quota, true, '重置后有额度');
    assertEqual(q.member.report_credits_used, 0, '本地 used 被重置为 0');
  })();

  console.log('\n=== 13. resolveQuota: 旧会员 total 迁移（库里低于配置） ===');
  await (async function testResolveMemberMigration() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_mig', first_report_used: true, invite_reward_credits: 0 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [
        {
          _id: 'm1',
          user_id: 'openid_mig',
          status: MEMBER_STATUS.ACTIVE,
          type: 'monthly',
          report_credits_used: 1,
          report_credits_total: 1, // 低于配置 MONTHLY_REPORTS=3
          report_credits_reset_at: new Date(Date.now() + 86400000),
        },
      ],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_mig');
    assertEqual(q.quota_source, 'member', '迁移后仍是会员额度');
    assertEqual(q.has_free_quota, true, '迁移后可用');
  })();

  console.log('\n=== 14. resolveQuota: 点数包余额 ===');
  await (async function testResolvePoints() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_p', first_report_used: true, invite_reward_credits: 0 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [],
      [COLLECTIONS.USER_POINTS]: [
        { _id: 'p1', user_id: 'openid_p', balance: 5, expire_at: new Date(Date.now() + 86400000) },
      ],
    });
    const q = await resolveQuota(db, 'openid_p');
    assertEqual(q.quota_source, 'points', '来源 points');
    assertEqual(q.has_free_quota, true, '点数包有免费额度');
    assertEqual(q.points_balance, 5, '点数余额 5');
    assertEqual(q.price, 0, '点数免费');
  })();

  console.log('\n=== 15. resolveQuota: 点数包过期 → 付费 ===');
  await (async function testResolvePointsExpired() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_pe', first_report_used: true, invite_reward_credits: 0 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [],
      [COLLECTIONS.USER_POINTS]: [
        { _id: 'p1', user_id: 'openid_pe', balance: 5, expire_at: new Date(Date.now() - 1000) },
      ],
    });
    const q = await resolveQuota(db, 'openid_pe');
    assertEqual(q.quota_source, 'paid', '点数过期 → 付费');
    assertEqual(q.has_free_quota, false, '无免费额度');
  })();

  console.log('\n=== 16. resolveQuota: 全空 → 付费兜底 ===');
  await (async function testResolvePaidFallback() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_paid', first_report_used: true, invite_reward_credits: 0 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_paid');
    assertEqual(q.quota_source, 'paid', '无任何额度 → paid');
    assertEqual(q.has_free_quota, false, '无免费额度');
    assertEqual(q.price, PRICES.STANDARD_REPORT, '标准报告价');
  })();

  console.log('\n=== 17. resolveQuota: 会员+点数同时有 → 点数优先（保护付费会员权益） ===');
  await (async function testResolvePointsOverMember() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_pm', first_report_used: true, invite_reward_credits: 0 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [
        {
          _id: 'm1',
          user_id: 'openid_pm',
          status: MEMBER_STATUS.ACTIVE,
          type: 'monthly',
          report_credits_used: 0,
          report_credits_total: 3,
          report_credits_reset_at: new Date(Date.now() + 86400000),
        },
      ],
      [COLLECTIONS.USER_POINTS]: [
        { _id: 'p1', user_id: 'openid_pm', balance: 2, expire_at: new Date(Date.now() + 86400000) },
      ],
    });
    const q = await resolveQuota(db, 'openid_pm');
    assertEqual(q.quota_source, 'points', '会员+点数 → 点数优先（最后才扣会员次数）');
    assertEqual(q.has_free_quota, true, '有免费额度');
    assertEqual(q.points_balance, 2, '命中点数余额');
  })();

  console.log('\n=== 18. resolveQuota: 邀请+首份都可用 → 邀请优先 ===');
  await (async function testResolveInviteOverFirst() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_if', first_report_used: false, invite_reward_credits: 3 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_if');
    assertEqual(q.quota_source, 'invite', '邀请+首份都可用 → 邀请优先于首份');
    assertEqual(q.has_free_quota, true, '有免费额度');
  })();

  console.log('\n=== 17. resolveQuota: 会员用尽且无点数 → 付费 ===');
  await (async function testResolveMemberExhausted() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_ex', first_report_used: true, invite_reward_credits: 0 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [
        {
          _id: 'm1',
          user_id: 'openid_ex',
          status: MEMBER_STATUS.ACTIVE,
          type: 'monthly',
          report_credits_used: 3,
          report_credits_total: 3,
          report_credits_reset_at: new Date(Date.now() + 86400000),
        },
      ],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_ex');
    assertEqual(q.quota_source, 'paid', '会员用尽 → 付费');
  })();

  console.log('\n=== 18. resolveQuota: 首份已用但无记录标记 → 享首份（标记丢失修复） ===');
  await (async function testResolveFirstReportMissingFlag() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [
        { _id: 'u1', user_id: 'openid_f', first_report_used: false, invite_reward_credits: 0 },
      ],
      [COLLECTIONS.ORDERS]: [],
      [COLLECTIONS.MEMBERS]: [],
      [COLLECTIONS.USER_POINTS]: [],
    });
    const q = await resolveQuota(db, 'openid_f');
    assertEqual(q.quota_source, 'first_report', '标记丢失且无历史订单 → 享首份');
    assertEqual(q.userExists, true, '用户记录存在');
  })();

  // ========== deductQuota 扣减 ==========

  console.log('\n=== 19. deductQuota: 首份优惠 - 新用户自动建记录 ===');
  await (async function testDeductFirstReportNewUser() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [],
      [COLLECTIONS.POINT_TRANSACTIONS]: [],
    });
    const quotaInfo = { quota_source: 'first_report', userExists: false, user: null };
    const ok = await deductQuota(db, 'openid_new', quotaInfo);
    assertEqual(ok, true, '扣减成功');
    const addUser = db._updates.find((u) => u.collection === COLLECTIONS.USERS && u.add);
    assert(!!addUser, '自动创建了用户记录');
    assertEqual(addUser.add.first_report_used, true, '新记录标记 first_report_used=true');
  })();

  console.log('\n=== 20. deductQuota: 首份优惠 - 并发 add 冲突重试成功 ===');
  await (async function testDeductFirstReportConcurrentRetry() {
    const db = createQuotaMockDb(
      {
        [COLLECTIONS.USERS]: [{ _id: 'u1', user_id: 'openid_c', first_report_used: false }],
        [COLLECTIONS.POINT_TRANSACTIONS]: [],
      },
      { throwOnAdd: true }
    );
    const quotaInfo = { quota_source: 'first_report', userExists: false, user: null };
    const ok = await deductQuota(db, 'openid_c', quotaInfo);
    assertEqual(ok, true, '并发冲突后重试成功');
  })();

  console.log('\n=== 21. deductQuota: 首份优惠 - 重试仍失败返回 false ===');
  await (async function testDeductFirstReportRetryFail() {
    const db = createQuotaMockDb(
      {
        [COLLECTIONS.USERS]: [],
        [COLLECTIONS.POINT_TRANSACTIONS]: [],
      },
      { throwOnAdd: true, forceUpdateZero: true }
    );
    const quotaInfo = { quota_source: 'first_report', userExists: false, user: null };
    const ok = await deductQuota(db, 'openid_f', quotaInfo);
    assertEqual(ok, false, 'add 抛错 + 重试 updated=0 → 返回 false');
  })();

  console.log('\n=== 22. deductQuota: 首份优惠 - 老用户条件更新 ===');
  await (async function testDeductFirstReportExisting() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [{ _id: 'u1', user_id: 'openid_e', first_report_used: false }],
    });
    const quotaInfo = {
      quota_source: 'first_report',
      userExists: true,
      user: { _id: 'u1', first_report_used: false },
    };
    const ok = await deductQuota(db, 'openid_e', quotaInfo);
    assertEqual(ok, true, '老用户条件更新成功');
  })();

  console.log('\n=== 23. deductQuota: 邀请奖励扣减 ===');
  await (async function testDeductInvite() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [{ _id: 'u1', user_id: 'openid_i', invite_reward_credits: 3 }],
    });
    const quotaInfo = { quota_source: 'invite', user: { _id: 'u1', invite_reward_credits: 3 } };
    const ok = await deductQuota(db, 'openid_i', quotaInfo);
    assertEqual(ok, true, '邀请扣减成功');
  })();

  console.log('\n=== 24. deductQuota: 邀请奖励并发失败 → false ===');
  await (async function testDeductInviteFail() {
    const db = createQuotaMockDb(
      { [COLLECTIONS.USERS]: [{ _id: 'u1', user_id: 'openid_if', invite_reward_credits: 0 }] },
      { forceUpdateZero: true }
    );
    const quotaInfo = { quota_source: 'invite', user: { _id: 'u1', invite_reward_credits: 0 } };
    const ok = await deductQuota(db, 'openid_if', quotaInfo);
    assertEqual(ok, false, '邀请并发竞争失败 → false');
  })();

  console.log('\n=== 25. deductQuota: 正式会员扣减 ===');
  await (async function testDeductMember() {
    const db = createQuotaMockDb({
      [COLLECTIONS.MEMBERS]: [
        { _id: 'm1', user_id: 'openid_m', report_credits_used: 1, report_credits_total: 3 },
      ],
    });
    const quotaInfo = {
      quota_source: 'member',
      member: { _id: 'm1', report_credits_used: 1, report_credits_total: 3 },
    };
    const ok = await deductQuota(db, 'openid_m', quotaInfo);
    assertEqual(ok, true, '会员扣减成功');
  })();

  console.log('\n=== 26. deductQuota: 体验会员扣减 ===');
  await (async function testDeductTrial() {
    const db = createQuotaMockDb({
      [COLLECTIONS.MEMBERS]: [
        { _id: 'm1', user_id: 'openid_t', report_credits_used: 0, report_credits_total: 1 },
      ],
    });
    const quotaInfo = {
      quota_source: 'trial',
      member: { _id: 'm1', report_credits_used: 0, report_credits_total: 1 },
    };
    const ok = await deductQuota(db, 'openid_t', quotaInfo);
    assertEqual(ok, true, '体验扣减成功');
  })();

  console.log('\n=== 27. deductQuota: 点数包扣减 + 流水记录 ===');
  await (async function testDeductPoints() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USER_POINTS]: [
        { _id: 'p1', user_id: 'openid_p', balance: 5, total_used: 0 },
      ],
      [COLLECTIONS.POINT_TRANSACTIONS]: [],
    });
    const quotaInfo = { quota_source: 'points', points_record_id: 'p1', points_balance: 5 };
    const ok = await deductQuota(db, 'openid_p', quotaInfo);
    assertEqual(ok, true, '点数扣减成功');
    const txn = db._updates.find((u) => u.collection === COLLECTIONS.POINT_TRANSACTIONS && u.add);
    assert(!!txn, '记录了点数消费流水');
    assertEqual(txn.add.type, 'consume', '流水类型 consume');
    assertEqual(txn.add.amount, -1, '流水金额 -1');
  })();

  console.log('\n=== 28. deductQuota: 付费（无源）→ 直接 true ===');
  await (async function testDeductPaid() {
    const db = createQuotaMockDb({});
    const quotaInfo = { quota_source: 'paid' };
    const ok = await deductQuota(db, 'openid_paid', quotaInfo);
    assertEqual(ok, true, '付费无需扣减，直接成功');
  })();

  // ========== rollbackQuota 回滚 ==========

  console.log('\n=== 29. rollbackQuota: 首份优惠回滚 ===');
  await (async function testRollbackFirstReport() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [{ _id: 'u1', user_id: 'openid_r', first_report_used: true }],
    });
    await rollbackQuota(db, 'openid_r', { quota_source: 'first_report', _deducted: true, user: { _id: 'u1' } });
    const u = db._updates.find(
      (x) => x.collection === COLLECTIONS.USERS && x.patch && x.patch.first_report_used === false
    );
    assert(!!u, '回滚写入 first_report_used=false');
  })();

  console.log('\n=== 30. rollbackQuota: 邀请奖励回滚（inc +1） ===');
  await (async function testRollbackInvite() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USERS]: [{ _id: 'u1', user_id: 'openid_ri', invite_reward_credits: 2 }],
    });
    await rollbackQuota(db, 'openid_ri', { quota_source: 'invite', _deducted: true, user: { _id: 'u1' } });
    const u = db._updates.find((x) => x.collection === COLLECTIONS.USERS);
    assert(!!u, '邀请回滚触发 USERS 更新');
    assert(!!u.patch.invite_reward_credits, '回滚 invite_reward_credits 含 inc 操作符');
  })();

  console.log('\n=== 31. rollbackQuota: 会员额度回滚（inc -1） ===');
  await (async function testRollbackMember() {
    const db = createQuotaMockDb({
      [COLLECTIONS.MEMBERS]: [{ _id: 'm1', user_id: 'openid_rm', report_credits_used: 2 }],
    });
    await rollbackQuota(db, 'openid_rm', { quota_source: 'member', _deducted: true, member: { _id: 'm1' } });
    const u = db._updates.find((x) => x.collection === COLLECTIONS.MEMBERS);
    assert(!!u, '会员回滚触发 MEMBERS 更新');
    assert(!!u.patch.report_credits_used, '回滚 report_credits_used 含 inc 操作符');
  })();

  console.log('\n=== 32. rollbackQuota: 点数包回滚 ===');
  await (async function testRollbackPoints() {
    const db = createQuotaMockDb({
      [COLLECTIONS.USER_POINTS]: [{ _id: 'p1', user_id: 'openid_rp', balance: 4, total_used: 1 }],
    });
    await rollbackQuota(db, 'openid_rp', { quota_source: 'points', _deducted: true, points_record_id: 'p1' });
    const u = db._updates.find((x) => x.collection === COLLECTIONS.USER_POINTS);
    assert(!!u, '点数回滚触发 USER_POINTS 更新');
    assert(!!u.patch.balance, '回滚 balance 含 inc 操作符');
  })();

  console.log('\n=== 33. rollbackQuota: 错误吞咽（DB 异常不抛出） ===');
  await (async function testRollbackErrorSwallow() {
    const db = {
      command: { neq: () => ({}), gt: () => ({}), lt: () => ({}), inc: () => ({}), in: () => ({}) },
      collection: () => {
        throw new Error('db down');
      },
    };
    let threw = false;
    try {
      await rollbackQuota(db, 'openid_err', { quota_source: 'invite', _deducted: true, user: { _id: 'u1' } });
    } catch (e) {
      threw = true;
    }
    assertEqual(threw, false, '回滚内部错误被吞咽，不抛给调用方');
  })();
}

// ========== 执行 + 摘要 ==========
run()
  .then(() => {
    const total = passed + failed;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`quota-service.test.js: ${passed}/${total} 通过, ${failed} 失败`);
    if (failed > 0) {
      console.error('\n❌ 失败详情:');
      errors.forEach((e) => console.error(`  ${e}`));
      process.exit(1);
    } else {
      console.log('\n✅ 所有测试通过！');
    }
  })
  .catch((e) => {
    console.error('\n💥 测试运行异常:', e);
    process.exit(1);
  });
