/**
 * 审计日志模块 (common/audit-logger.js) 单元测试
 * TDD: RED → GREEN → REFACTOR
 * 测试 logAuditEvent：正常写入、字段映射、details 默认值、错误吞咽
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

const { logAuditEvent } = require('../../cloudfunctions/common/audit-logger');

// ===== Mock DB 工厂 =====
function createAuditMockDb() {
  const inserted = [];
  return {
    collection: (name) => ({
      add: async ({ data }) => {
        inserted.push({ collection: name, data });
        return { _id: 'audit_' + inserted.length };
      },
    }),
    _inserted: inserted,
  };
}

function createFailingMockDb() {
  return {
    collection: () => ({
      add: async () => {
        throw new Error('db connection lost');
      },
    }),
  };
}

// ===== 主测试流程（异步 await） =====
async function run() {
  console.log('\n=== 1. 正常写入审计事件 ===');
  await (async function testNormalWrite() {
    const db = createAuditMockDb();
    await logAuditEvent(db, 'openid_a', 'delete_pet', { petId: 'p1', petName: '小白' });
    assertEqual(db._inserted.length, 1, '写入 1 条记录');
    const rec = db._inserted[0];
    assertEqual(rec.collection, 'audit_logs', '写入 audit_logs 集合');
    assertEqual(rec.data.openid, 'openid_a', '记录 openid');
    assertEqual(rec.data.action, 'delete_pet', '记录 action');
  })();

  console.log('\n=== 2. details 字段映射 ===');
  await (async function testDetailsMapping() {
    const db = createAuditMockDb();
    const details = { target: 'record_123', reason: 'user_request', meta: { ip: '1.2.3.4' } };
    await logAuditEvent(db, 'openid_b', 'delete_record', details);
    assertEqual(db._inserted[0].data.details, details, 'details 完整透传');
  })();

  console.log('\n=== 3. details 缺省为空对象 ===');
  await (async function testDetailsDefault() {
    const db = createAuditMockDb();
    await logAuditEvent(db, 'openid_c', 'login');
    assertEqual(db._inserted[0].data.details, {}, 'details 缺省为 {}');
  })();

  console.log('\n=== 4. created_at 为 Date 实例 ===');
  await (async function testCreatedAt() {
    const db = createAuditMockDb();
    await logAuditEvent(db, 'openid_d', 'save_pet', { name: '大黄' });
    assert(db._inserted[0].data.created_at instanceof Date, 'created_at 是 Date 实例');
  })();

  console.log('\n=== 5. DB 异常被吞咽（不抛给调用方） ===');
  await (async function testErrorSwallow() {
    const db = createFailingMockDb();
    let threw = false;
    try {
      await logAuditEvent(db, 'openid_e', 'submit_symptom', { risk: 'high' });
    } catch (e) {
      threw = true;
    }
    assertEqual(threw, false, 'DB 写入失败不阻断主流程');
  })();

  console.log('\n=== 6. 不同 action 类型均可记录 ===');
  await (async function testVariousActions() {
    const actions = ['login', 'delete_pet', 'delete_record', 'save_pet', 'submit_symptom'];
    const db = createAuditMockDb();
    for (const a of actions) {
      await logAuditEvent(db, 'openid_f', a);
    }
    assertEqual(db._inserted.length, actions.length, `${actions.length} 种 action 全部记录`);
    const recordedActions = db._inserted.map((r) => r.data.action);
    assertEqual(recordedActions, actions, 'action 顺序与入参一致');
  })();
}

// ===== 执行 + 摘要 =====
run()
  .then(() => {
    const total = passed + failed;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`audit-logger.test.js: ${passed}/${total} 通过, ${failed} 失败`);
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
