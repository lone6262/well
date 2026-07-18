/**
 * 食物安全查询 (searchFoodSafety/index.js) 回归测试
 * 对应提交 0cbd677：加鉴权限流 + 正则转义 + 分页修正
 *
 * 通过 Module._load 拦截注入 mock（wx-server-sdk / auth / rate-limiter / constants），
 * 端到端测试 exports.main，验证：
 * 1. Token 鉴权网关（防匿名爬取）
 * 2. 速率限制网关
 * 3. escapeRegExp 正则元字符转义（防 ReDoS / 注入）—— 捕获 db.RegExp 入参
 * 4. 分页参数 clamp（page ≥ 1、1 ≤ pageSize ≤ 100）
 * 5. 关键词 OR 合并 + 结果格式化
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

// ===== mock 依赖（通过 Module._load 拦截） =====
const Module = require('module');

const COLLECTIONS = { FOOD_SAFETY: 'food_safety' };
const RESPONSE_CODE = { SUCCESS: 0, ERROR: -1, UNAUTHORIZED: 401, SERVER_ERROR: 500 };

// 可变控制点（每个场景前重置）
const ctrl = {
  verifyTokenRet: true,
  rateLimitRet: true,
  openid: 'openid_test',
};

// spy 容器（每个场景前清空）
const spy = { regExp: [], skip: [], limit: [], queries: [] };

// mock 数据集
let foodData = [];
let foodTotal = 0;

const command = {
  or: (arr) => ({ $or: arr }),
  and: (arr) => ({ $and: arr }),
};

const mockDb = {
  command,
  RegExp: ({ regexp, options }) => {
    spy.regExp.push({ regexp, options });
    return { $regexp: regexp, $options: options };
  },
  collection: (name) => ({
    where: (query) => {
      spy.queries.push(query);
      return {
        count: async () => ({ total: foodTotal }),
        orderBy: () => ({
          skip: (n) => {
            spy.skip.push(n);
            return {
              limit: (size) => {
                spy.limit.push(size);
                return { get: async () => ({ data: foodData }) };
              },
            };
          },
        }),
      };
    },
  }),
};

const mockCloud = {
  DYNAMIC_CURRENT_ENV: '__DCE__',
  init: () => {},
  database: () => mockDb,
  getWXContext: () => ({ OPENID: ctrl.openid }),
};

const mockAuth = {
  verifyToken: (token) => ctrl.verifyTokenRet,
  // C-1 修复：authenticate 交叉校验 openid
  authenticate: (event, context) => ({
    openid: ctrl.openid,
    valid: ctrl.verifyTokenRet,
  }),
};
const mockRateLimiter = {
  checkRateLimit: async () => ctrl.rateLimitRet,
};
const mockConstants = {
  COLLECTIONS,
  RESPONSE_CODE,
  warmupConfig: async () => {},
};

const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return mockCloud;
  if (request === './common/auth') return mockAuth;
  if (request === './common/rate-limiter') return mockRateLimiter;
  if (request === './common/constants') return mockConstants;
  return realLoad.apply(this, arguments);
};

// 以 mock 加载被测云函数
const cloudFuncPath = require.resolve('../../cloudfunctions/searchFoodSafety/index.js');
delete require.cache[cloudFuncPath];
const { main } = require('../../cloudfunctions/searchFoodSafety/index.js');

function resetSpies() {
  spy.regExp = [];
  spy.skip = [];
  spy.limit = [];
  spy.queries = [];
}

// ===== 主测试流程 =====
async function run() {
  console.log('\n=== 1. 鉴权网关：无 token → UNAUTHORIZED ===');
  await (async function testAuthGate() {
    ctrl.verifyTokenRet = false;
    ctrl.rateLimitRet = true;
    resetSpies();
    const res = await main({ keyword: '鸡胸肉' });
    assertEqual(res.code, RESPONSE_CODE.UNAUTHORIZED, '无 token 返回 UNAUTHORIZED');
    assertEqual(spy.queries.length, 0, '鉴权失败不查 DB');
    ctrl.verifyTokenRet = true;
  })();

  console.log('\n=== 2. 速率限制网关：限流触发 → ERROR ===');
  await (async function testRateLimitGate() {
    ctrl.verifyTokenRet = true;
    ctrl.rateLimitRet = false;
    resetSpies();
    const res = await main({ keyword: '鸡胸肉', token: 'tok' });
    assertEqual(res.code, RESPONSE_CODE.ERROR, '限流返回 ERROR');
    assertEqual(spy.queries.length, 0, '限流失败不查 DB');
    ctrl.rateLimitRet = true;
  })();

  console.log('\n=== 3. 正则转义（防 ReDoS）：元字符被反斜杠转义 ===');
  await (async function testRegexEscape() {
    resetSpies();
    foodTotal = 0;
    foodData = [];
    // 含全部正则元字符的恶意输入
    const malicious = 'a.*+?^${}()|[]\\b';
    await main({ keyword: malicious, token: 'tok' });
    assertEqual(spy.regExp.length, 1, '调用 1 次 db.RegExp');
    const regexp = spy.regExp[0].regexp;
    // 每个元字符前都应有反斜杠
    assert(regexp.includes('\\.'), '转义 .');
    assert(regexp.includes('\\*'), '转义 *');
    assert(regexp.includes('\\+'), '转义 +');
    assert(regexp.includes('\\?'), '转义 ?');
    assert(regexp.includes('\\^'), '转义 ^');
    assert(regexp.includes('\\$'), '转义 $');
    assert(regexp.includes('\\{'), '转义 {');
    assert(regexp.includes('\\}'), '转义 }');
    assert(regexp.includes('\\('), '转义 (');
    assert(regexp.includes('\\)'), '转义 )');
    assert(regexp.includes('\\|'), '转义 |');
    assert(regexp.includes('\\['), '转义 [');
    assert(regexp.includes('\\]'), '转义 ]');
    assert(regexp.includes('\\\\'), '转义反斜杠');
    // 转义后作为字面量，不应残留未转义的元字符序列
    assert(!/^a\.[*]/.test(regexp) || regexp[1] === '\\', '首字符 a 后跟转义符');
  })();

  console.log('\n=== 4. 正则转义：普通关键词不被误伤 ===');
  await (async function testRegexEscapeNormal() {
    resetSpies();
    foodTotal = 0;
    foodData = [];
    await main({ keyword: '鸡胸肉', token: 'tok' });
    assertEqual(spy.regExp[0].regexp, '鸡胸肉', '普通中文关键词原样传入');
    assertEqual(spy.regExp[0].options, 'i', '大小写不敏感');
  })();

  console.log('\n=== 5. 分页 clamp：pageSize 超上限 → 100 ===');
  await (async function testPageSizeClampMax() {
    resetSpies();
    foodTotal = 0;
    foodData = [];
    await main({ keyword: '肉', pageSize: 500, token: 'tok' });
    assertEqual(spy.limit[0], 100, 'pageSize=500 被 clamp 到 100');
  })();

  console.log('\n=== 6. 分页 clamp：pageSize 非法值处理 ===');
  await (async function testPageSizeClampMin() {
    // 源码：Math.min(100, Math.max(1, parseInt(pageSize,10) || 20))
    // 注意 `|| 20` 默认值：0 / NaN / undefined 都回退到 20（0 视为「未指定」）
    resetSpies();
    foodTotal = 0;
    foodData = [];
    await main({ keyword: '肉', pageSize: 0, token: 'tok' });
    assertEqual(spy.limit[0], 20, 'pageSize=0 触发 || 20 默认值（0 为 falsy）');
    await main({ keyword: '肉', pageSize: -5, token: 'tok' });
    assertEqual(spy.limit[1], 1, 'pageSize=-5 经 Math.max(1,..) clamp 到 1');
    resetSpies();
    await main({ keyword: '肉', pageSize: 'abc', token: 'tok' });
    assertEqual(spy.limit[0], 20, 'pageSize 非数字 → parseInt NaN → 默认 20');
  })();

  console.log('\n=== 7. 分页 clamp：page ≤ 0 → skip=0 ===');
  await (async function testPageClamp() {
    resetSpies();
    foodTotal = 0;
    foodData = [];
    await main({ keyword: '肉', page: 0, pageSize: 20, token: 'tok' });
    assertEqual(spy.skip[0], 0, 'page=0 → clamp 到 1，skip=0');
    resetSpies();
    await main({ keyword: '肉', page: 3, pageSize: 20, token: 'tok' });
    assertEqual(spy.skip[0], 40, 'page=3, size=20 → skip=40');
  })();

  console.log('\n=== 8. 关键词搜索：结果格式化 + total ===');
  await (async function testKeywordResultFormat() {
    resetSpies();
    foodTotal = 2;
    foodData = [
      {
        _id: 'f1',
        name: '鸡胸肉',
        category: '肉类',
        cat_safety: 'safe',
        dog_safety: 'safe',
        effect: '高蛋白',
        severity: 2,
      },
      {
        _id: 'f2',
        name: '葡萄',
        category: '水果',
        cat_safety: 'toxic',
        dog_safety: 'toxic',
        effect: '肾衰竭',
        severity: 5,
      },
    ];
    const res = await main({ keyword: '肉', token: 'tok' });
    assertEqual(res.code, RESPONSE_CODE.SUCCESS, '成功码');
    assertEqual(res.data.total, 2, 'total 准确');
    assertEqual(res.data.foods.length, 2, '返回 2 条');
    assertEqual(res.data.foods[0].name, '鸡胸肉', '第 1 条 name');
    assertEqual(res.data.foods[1].alternative, '', 'alternative 缺省为空字符串');
    assertEqual(res.data.foods[1].severity, 5, 'severity 透传');
  })();

  console.log('\n=== 9. 无关键词：按 published 全量 ===');
  await (async function testNoKeyword() {
    resetSpies();
    foodTotal = 1;
    foodData = [{ _id: 'f9', name: '牛肉', category: '肉类', cat_safety: 'safe', severity: 1 }];
    const res = await main({ token: 'tok' });
    assertEqual(res.code, RESPONSE_CODE.SUCCESS, '无关键词也成功');
    assertEqual(res.data.foods.length, 1, '返回 1 条');
    assertEqual(spy.regExp.length, 0, '无关键词不构造正则');
  })();

  console.log('\n=== 10. DB 异常 → SERVER_ERROR 兜底 ===');
  await (async function testDbErrorFallback() {
    const originalCollection = mockDb.collection;
    mockDb.collection = () => {
      throw new Error('db exploded');
    };
    const res = await main({ keyword: '肉', token: 'tok' });
    assertEqual(res.code, RESPONSE_CODE.SERVER_ERROR, 'DB 异常返回 SERVER_ERROR');
    mockDb.collection = originalCollection;
  })();
}

// ===== 执行 + 摘要 =====
run()
  .then(() => {
    Module._load = realLoad;
    const total = passed + failed;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`searchFoodSafety.test.js: ${passed}/${total} 通过, ${failed} 失败`);
    if (failed > 0) {
      console.error('\n❌ 失败详情:');
      errors.forEach((e) => console.error(`  ${e}`));
      process.exit(1);
    } else {
      console.log('\n✅ 所有测试通过！');
    }
  })
  .catch((e) => {
    Module._load = realLoad;
    console.error('\n💥 测试运行异常:', e);
    process.exit(1);
  });
