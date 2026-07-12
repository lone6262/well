/**
 * 数据库初始化模块 (common/db.js) 烟雾测试
 * TDD: RED → GREEN → REFACTOR
 *
 * db.js 顶部 require('wx-server-sdk')，但 SDK 未在本地安装。
 * 通过 Module._load 拦截注入 mock SDK，验证：
 * - 以 DYNAMIC_CURRENT_ENV 调用 cloud.init()
 * - 导出 { cloud, db, _ }，且 _ === db.command
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

// ===== 注入 mock wx-server-sdk =====
const Module = require('module');
const initCalls = [];
const mockCommand = {
  gt: (v) => ({ $gt: v }),
  lt: (v) => ({ $lt: v }),
  neq: (v) => ({ $neq: v }),
  eq: (v) => ({ $eq: v }),
  inc: (v) => ({ $inc: v }),
};
const mockDb = { command: mockCommand };
const mockCloud = {
  DYNAMIC_CURRENT_ENV: '__DYNAMIC_CURRENT_ENV__',
  init: (cfg) => initCalls.push(cfg),
  database: () => mockDb,
};

const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return mockCloud;
  return realLoad.apply(this, arguments);
};

// 清除可能的缓存，确保以 mock 重新加载 db.js
delete require.cache[require.resolve('../../cloudfunctions/common/db')];

// ===== 测试主流程 =====
function run() {
  console.log('\n=== 1. 模块加载并以 DYNAMIC_CURRENT_ENV 初始化 ===');
  (function testInit() {
    const { cloud, db, _ } = require('../../cloudfunctions/common/db');
    assert(initCalls.length >= 1, 'cloud.init 被调用');
    assertEqual(
      initCalls[0],
      { env: '__DYNAMIC_CURRENT_ENV__' },
      'init 使用 DYNAMIC_CURRENT_ENV'
    );
  })();

  console.log('\n=== 2. 导出结构完整 ===');
  (function testExports() {
    const { cloud, db, _ } = require('../../cloudfunctions/common/db');
    assertEqual(cloud, mockCloud, 'cloud 为 SDK 实例');
    assertEqual(db, mockDb, 'db 为 database() 实例');
  })();

  console.log('\n=== 3. _ 等于 db.command（命令操作符） ===');
  (function testCommand() {
    const { db, _ } = require('../../cloudfunctions/common/db');
    assertEqual(_, mockCommand, '_ === db.command');
    assert(typeof _.gt === 'function', '_.gt 可用');
    assert(typeof _.inc === 'function', '_.inc 可用');
  })();

  console.log('\n=== 4. 单例性：多次 require 返回同一实例 ===');
  (function testSingleton() {
    const a = require('../../cloudfunctions/common/db');
    const b = require('../../cloudfunctions/common/db');
    assert(a === b, '多次 require 返回同一模块实例');
    // init 只应被调用一次（模块首次加载）
    const initCountBefore = initCalls.length;
    require('../../cloudfunctions/common/db');
    assertEqual(initCalls.length, initCountBefore, '模块缓存，init 不重复调用');
  })();
}

// ===== 执行 + 摘要 =====
try {
  run();
} catch (e) {
  console.error('\n💥 测试运行异常:', e);
  Module._load = realLoad;
  process.exit(1);
}
// 恢复 loader，避免污染后续测试
Module._load = realLoad;

const total = passed + failed;
console.log(`\n${'='.repeat(60)}`);
console.log(`db.test.js: ${passed}/${total} 通过, ${failed} 失败`);
if (failed > 0) {
  console.error('\n❌ 失败详情:');
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('\n✅ 所有测试通过！');
}
