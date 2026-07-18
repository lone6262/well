/**
 * 常量定义模块完整性测试 (V1.5)
 * TDD: RED → GREEN → REFACTOR
 *
 * 测试覆盖：
 * - PET_TYPES, RISK_LEVELS, ORDER_STATUS, ORDER_TYPES 完整性
 * - COLLECTIONS 完整性（V1.5 新增集合）
 * - PRICES, MEMBER_CREDITS, POINTS_PACKS, BUNDLES 结构验证
 * - MEMBER_LIMITS, INVITE_CONFIG 完整性
 * - VALID_SYMPTOM_SET, SERVER_CONFIG, TIME 常量验证
 * - CONFIG_KEY_MAP 映射完整性
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
    errors.push('FAIL: ' + message);
    console.error('  ✗ ' + message);
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    const msg =
      message + ' - 期望: ' + JSON.stringify(expected) + ', 实际: ' + JSON.stringify(actual);
    errors.push('FAIL: ' + msg);
    console.error('  ✗ ' + msg);
  }
}

function assertType(value, expectedType, message) {
  assert(
    typeof value === expectedType,
    message + ' - 期望类型: ' + expectedType + ', 实际: ' + typeof value
  );
}

function assertGreaterThan(value, threshold, message) {
  assert(value > threshold, message + ' - 期望 > ' + threshold + ', 实际: ' + value);
}

function assertHasProperty(obj, prop, message) {
  assert(obj && obj.hasOwnProperty(prop), message + ' - 缺少属性: ' + prop);
}

function summary(name) {
  const total = passed + failed;
  console.log('\n' + '='.repeat(60));
  console.log(name + ': ' + passed + '/' + total + ' 通过, ' + failed + ' 失败');
  console.log('='.repeat(60));

  if (failed > 0) {
    console.error('\n❌ 失败详情:');
    errors.forEach((e) => console.error('  ' + e));
  }

  return failed === 0;
}

// ===== 导入常量模块 =====
// 注意：我们只导入常量，避免触发 warmupConfig 中的 db 依赖
const constantsPath = '../../cloudfunctions/common/constants.js';
let constants;

try {
  constants = require(constantsPath);
} catch (error) {
  console.error('无法加载 constants.js:', error.message);
  process.exit(1);
}

// ========== 测试套件 ==========

console.log('\n=== 1. PET_TYPES 完整性 ===');
assertHasProperty(constants, 'PET_TYPES', 'PET_TYPES 应存在');
assertType(constants.PET_TYPES, 'object', 'PET_TYPES 应为对象');
assertHasProperty(constants.PET_TYPES, 'CAT', 'PET_TYPES.CAT 应存在');
assertHasProperty(constants.PET_TYPES, 'DOG', 'PET_TYPES.DOG 应存在');
assertHasProperty(constants.PET_TYPES, 'OTHER', 'PET_TYPES.OTHER 应存在');
assertEqual(constants.PET_TYPES.CAT, 'cat', 'CAT 值应为 cat');
assertEqual(constants.PET_TYPES.DOG, 'dog', 'DOG 值应为 dog');
assertEqual(constants.PET_TYPES.OTHER, 'other', 'OTHER 值应为 other');

console.log('\n=== 2. RISK_LEVELS 完整性 ===');
assertHasProperty(constants, 'RISK_LEVELS', 'RISK_LEVELS 应存在');
assertType(constants.RISK_LEVELS, 'object', 'RISK_LEVELS 应为对象');
assertHasProperty(constants.RISK_LEVELS, 'LOW', 'RISK_LEVELS.LOW 应存在');
assertHasProperty(constants.RISK_LEVELS, 'MID', 'RISK_LEVELS.MID 应存在');
assertHasProperty(constants.RISK_LEVELS, 'HIGH', 'RISK_LEVELS.HIGH 应存在');
assertEqual(constants.RISK_LEVELS.LOW, 'low', 'LOW 值应为 low');
assertEqual(constants.RISK_LEVELS.MID, 'mid', 'MID 值应为 mid');
assertEqual(constants.RISK_LEVELS.HIGH, 'high', 'HIGH 值应为 high');

console.log('\n=== 3. ORDER_STATUS 完整性 ===');
assertHasProperty(constants, 'ORDER_STATUS', 'ORDER_STATUS 应存在');
assertType(constants.ORDER_STATUS, 'object', 'ORDER_STATUS 应为对象');
assertHasProperty(constants.ORDER_STATUS, 'PENDING', 'ORDER_STATUS.PENDING 应存在');
assertHasProperty(constants.ORDER_STATUS, 'PAID', 'ORDER_STATUS.PAID 应存在');
assertHasProperty(
  constants.ORDER_STATUS,
  'REFUND_REQUESTED',
  'ORDER_STATUS.REFUND_REQUESTED 应存在'
);
assertHasProperty(constants.ORDER_STATUS, 'REFUNDED', 'ORDER_STATUS.REFUNDED 应存在');
assertHasProperty(constants.ORDER_STATUS, 'FAILED', 'ORDER_STATUS.FAILED 应存在');
assertHasProperty(constants.ORDER_STATUS, 'CLOSED', 'ORDER_STATUS.CLOSED 应存在');
assertEqual(constants.ORDER_STATUS.PENDING, 'pending', 'PENDING 值应为 pending');
assertEqual(constants.ORDER_STATUS.PAID, 'paid', 'PAID 值应为 paid');
assertEqual(
  constants.ORDER_STATUS.REFUND_REQUESTED,
  'refund_requested',
  'REFUND_REQUESTED 值应为 refund_requested'
);
assertEqual(constants.ORDER_STATUS.REFUNDED, 'refunded', 'REFUNDED 值应为 refunded');
assertEqual(constants.ORDER_STATUS.FAILED, 'failed', 'FAILED 值应为 failed');
assertEqual(constants.ORDER_STATUS.CLOSED, 'closed', 'CLOSED 值应为 closed');

console.log('\n=== 4. ORDER_TYPES 完整性 ===');
assertHasProperty(constants, 'ORDER_TYPES', 'ORDER_TYPES 应存在');
assertType(constants.ORDER_TYPES, 'object', 'ORDER_TYPES 应为对象');
assertHasProperty(constants.ORDER_TYPES, 'REPORT', 'ORDER_TYPES.REPORT 应存在');
assertHasProperty(constants.ORDER_TYPES, 'MEMBER', 'ORDER_TYPES.MEMBER 应存在');
assertHasProperty(constants.ORDER_TYPES, 'MEMBER_MONTHLY', 'ORDER_TYPES.MEMBER_MONTHLY 应存在');
assertHasProperty(constants.ORDER_TYPES, 'MEMBER_YEARLY', 'ORDER_TYPES.MEMBER_YEARLY 应存在');
assertHasProperty(
  constants.ORDER_TYPES,
  'MEMBER_FAMILY_MONTHLY',
  'ORDER_TYPES.MEMBER_FAMILY_MONTHLY 应存在'
);
assertHasProperty(
  constants.ORDER_TYPES,
  'MEMBER_FAMILY_YEARLY',
  'ORDER_TYPES.MEMBER_FAMILY_YEARLY 应存在'
);
assertHasProperty(constants.ORDER_TYPES, 'POINTS', 'ORDER_TYPES.POINTS 应存在');
assertHasProperty(constants.ORDER_TYPES, 'BUNDLE', 'ORDER_TYPES.BUNDLE 应存在');
assertEqual(constants.ORDER_TYPES.REPORT, 'report', 'REPORT 值应为 report');
assertEqual(constants.ORDER_TYPES.MEMBER, 'member', 'MEMBER 值应为 member');
assertEqual(
  constants.ORDER_TYPES.MEMBER_MONTHLY,
  'member_monthly',
  'MEMBER_MONTHLY 值应为 member_monthly'
);
assertEqual(
  constants.ORDER_TYPES.MEMBER_YEARLY,
  'member_yearly',
  'MEMBER_YEARLY 值应为 member_yearly'
);
assertEqual(
  constants.ORDER_TYPES.MEMBER_FAMILY_MONTHLY,
  'member_family_monthly',
  'MEMBER_FAMILY_MONTHLY 值应为 member_family_monthly'
);
assertEqual(
  constants.ORDER_TYPES.MEMBER_FAMILY_YEARLY,
  'member_family_yearly',
  'MEMBER_FAMILY_YEARLY 值应为 member_family_yearly'
);
assertEqual(constants.ORDER_TYPES.POINTS, 'points', 'POINTS 值应为 points');
assertEqual(constants.ORDER_TYPES.BUNDLE, 'bundle', 'BUNDLE 值应为 bundle');

console.log('\n=== 5. COLLECTIONS 完整性（V1.5 新增集合）===');
assertHasProperty(constants, 'COLLECTIONS', 'COLLECTIONS 应存在');
assertType(constants.COLLECTIONS, 'object', 'COLLECTIONS 应为对象');

// 基础集合
const baseCollections = [
  'USERS',
  'PETS',
  'SYMPTOM_RECORDS',
  'AI_CACHE',
  'ORDERS',
  'HOSPITALS',
  'MEMBERS',
  'KNOWLEDGE_ARTICLES',
  'INVITE_RECORDS',
  'FOLLOWUP_RECORDS',
  'REPORT_TEMPLATES',
  'SYSTEM_CONFIG',
];
baseCollections.forEach(function (col) {
  assertHasProperty(constants.COLLECTIONS, col, 'COLLECTIONS.' + col + ' 应存在');
});

// V1.5 新增集合
const v15Collections = [
  'REFUND_RECORDS',
  'USER_POINTS',
  'POINT_TRANSACTIONS',
  'USER_COUPONS',
  'COUPONS',
  'MEMBER_RENEW_LOG',
  'BILL_CHECK_LOGS',
  'ANALYTICS_EVENTS',
  'ERROR_LOGS',
];
v15Collections.forEach(function (col) {
  assertHasProperty(constants.COLLECTIONS, col, 'COLLECTIONS.' + col + ' (V1.5 新增) 应存在');
});

// 验证新增集合的值
assertEqual(
  constants.COLLECTIONS.REFUND_RECORDS,
  'refund_records',
  'REFUND_RECORDS 值应为 refund_records'
);
assertEqual(constants.COLLECTIONS.USER_POINTS, 'user_points', 'USER_POINTS 值应为 user_points');
assertEqual(
  constants.COLLECTIONS.POINT_TRANSACTIONS,
  'point_transactions',
  'POINT_TRANSACTIONS 值应为 point_transactions'
);
assertEqual(constants.COLLECTIONS.USER_COUPONS, 'user_coupons', 'USER_COUPONS 值应为 user_coupons');
assertEqual(constants.COLLECTIONS.COUPONS, 'coupons', 'COUPONS 值应为 coupons');
assertEqual(
  constants.COLLECTIONS.MEMBER_RENEW_LOG,
  'member_renew_log',
  'MEMBER_RENEW_LOG 值应为 member_renew_log'
);
assertEqual(
  constants.COLLECTIONS.BILL_CHECK_LOGS,
  'bill_check_logs',
  'BILL_CHECK_LOGS 值应为 bill_check_logs'
);
assertEqual(
  constants.COLLECTIONS.ANALYTICS_EVENTS,
  'analytics_events',
  'ANALYTICS_EVENTS 值应为 analytics_events'
);
assertEqual(constants.COLLECTIONS.ERROR_LOGS, 'error_logs', 'ERROR_LOGS 值应为 error_logs');

console.log('\n=== 6. PRICES 完整性 ===');
assertHasProperty(constants, 'PRICES', 'PRICES 应存在');
assertType(constants.PRICES, 'object', 'PRICES 应为对象');

// AI 报告价格：FIRST_REPORT=0（首份免费，V1.5 商业化调整），STANDARD_REPORT 付费
assertEqual(constants.PRICES.FIRST_REPORT, 0, 'FIRST_REPORT 应为 0（首份免费）');
assertEqual(constants.PRICES.STANDARD_REPORT, 990, 'STANDARD_REPORT 应为 990 (分)');
// 付费报告价格须为正数（首份免费不参与 >0 校验）
['STANDARD_REPORT'].forEach(function (key) {
  assertHasProperty(constants.PRICES, key, 'PRICES.' + key + ' 应存在');
  assertType(constants.PRICES[key], 'number', 'PRICES.' + key + ' 应为数字');
  assertGreaterThan(constants.PRICES[key], 0, 'PRICES.' + key + ' 应为正数');
});

// 会员价格
const memberPrices = [
  'MEMBER_MONTHLY',
  'MEMBER_YEARLY',
  'MEMBER_FAMILY_MONTHLY',
  'MEMBER_FAMILY_YEARLY',
];
memberPrices.forEach(function (key) {
  assertHasProperty(constants.PRICES, key, 'PRICES.' + key + ' 应存在');
  assertType(constants.PRICES[key], 'number', 'PRICES.' + key + ' 应为数字');
  assertGreaterThan(constants.PRICES[key], 0, 'PRICES.' + key + ' 应为正数');
});

// 续费价格
const renewPrices = [
  'RENEW_MONTHLY',
  'RENEW_YEARLY',
  'RENEW_FAMILY_MONTHLY',
  'RENEW_FAMILY_YEARLY',
];
renewPrices.forEach(function (key) {
  assertHasProperty(constants.PRICES, key, 'PRICES.' + key + ' 应存在');
  assertType(constants.PRICES[key], 'number', 'PRICES.' + key + ' 应为数字');
  assertGreaterThan(constants.PRICES[key], 0, 'PRICES.' + key + ' 应为正数');
});

// 点数包价格
const pointsPrices = ['POINTS_PACK_3', 'POINTS_PACK_5'];
pointsPrices.forEach(function (key) {
  assertHasProperty(constants.PRICES, key, 'PRICES.' + key + ' 应存在');
  assertType(constants.PRICES[key], 'number', 'PRICES.' + key + ' 应为数字');
  assertGreaterThan(constants.PRICES[key], 0, 'PRICES.' + key + ' 应为正数');
});

// 组合套餐价格
const bundlePrices = ['BUNDLE_STARTER', 'BUNDLE_ESSENTIAL', 'BUNDLE_FAMILY'];
bundlePrices.forEach(function (key) {
  assertHasProperty(constants.PRICES, key, 'PRICES.' + key + ' 应存在');
  assertType(constants.PRICES[key], 'number', 'PRICES.' + key + ' 应为数字');
  assertGreaterThan(constants.PRICES[key], 0, 'PRICES.' + key + ' 应为正数');
});

// 审核阈值
assertHasProperty(
  constants.PRICES,
  'MANUAL_REVIEW_THRESHOLD',
  'PRICES.MANUAL_REVIEW_THRESHOLD 应存在'
);
assertType(constants.PRICES.MANUAL_REVIEW_THRESHOLD, 'number', 'MANUAL_REVIEW_THRESHOLD 应为数字');
assertEqual(
  constants.PRICES.MANUAL_REVIEW_THRESHOLD,
  9900,
  'MANUAL_REVIEW_THRESHOLD 应为 9900 (分)'
);

console.log('\n=== 7. MEMBER_CREDITS 完整性 ===');
assertHasProperty(constants, 'MEMBER_CREDITS', 'MEMBER_CREDITS 应存在');
assertType(constants.MEMBER_CREDITS, 'object', 'MEMBER_CREDITS 应为对象');

const creditTypes = [
  'MONTHLY_REPORTS',
  'YEARLY_REPORTS',
  'FAMILY_MONTHLY_REPORTS',
  'FAMILY_YEARLY_REPORTS',
  'TRIAL_REPORTS',
];
creditTypes.forEach(function (key) {
  assertHasProperty(constants.MEMBER_CREDITS, key, 'MEMBER_CREDITS.' + key + ' 应存在');
  assertType(constants.MEMBER_CREDITS[key], 'number', 'MEMBER_CREDITS.' + key + ' 应为数字');
  assertGreaterThan(constants.MEMBER_CREDITS[key], 0, 'MEMBER_CREDITS.' + key + ' 应为正数');
});

assertEqual(constants.MEMBER_CREDITS.MONTHLY_REPORTS, 3, 'MONTHLY_REPORTS 应为 3');
assertEqual(constants.MEMBER_CREDITS.YEARLY_REPORTS, 3, 'YEARLY_REPORTS 应为 3');
assertEqual(constants.MEMBER_CREDITS.FAMILY_MONTHLY_REPORTS, 6, 'FAMILY_MONTHLY_REPORTS 应为 6');
assertEqual(constants.MEMBER_CREDITS.FAMILY_YEARLY_REPORTS, 6, 'FAMILY_YEARLY_REPORTS 应为 6');
assertEqual(constants.MEMBER_CREDITS.TRIAL_REPORTS, 1, 'TRIAL_REPORTS 应为 1');

console.log('\n=== 8. POINTS_PACKS 结构 ===');
assertHasProperty(constants, 'POINTS_PACKS', 'POINTS_PACKS 应存在');
assertType(constants.POINTS_PACKS, 'object', 'POINTS_PACKS 应为对象');

const packTypes = ['PACK_3', 'PACK_5'];
packTypes.forEach(function (key) {
  assertHasProperty(constants.POINTS_PACKS, key, 'POINTS_PACKS.' + key + ' 应存在');
  const pack = constants.POINTS_PACKS[key];
  assertType(pack, 'object', 'POINTS_PACKS.' + key + ' 应为对象');

  // 验证 pack 结构
  assertHasProperty(pack, 'count', 'POINTS_PACKS.' + key + '.count 应存在');
  assertHasProperty(pack, 'price', 'POINTS_PACKS.' + key + '.price 应存在');
  assertHasProperty(pack, 'expire_days', 'POINTS_PACKS.' + key + '.expire_days 应存在');

  // 验证类型和值
  assertType(pack.count, 'number', 'POINTS_PACKS.' + key + '.count 应为数字');
  assertType(pack.price, 'number', 'POINTS_PACKS.' + key + '.price 应为数字');
  assertType(pack.expire_days, 'number', 'POINTS_PACKS.' + key + '.expire_days 应为数字');
  assertGreaterThan(pack.count, 0, 'POINTS_PACKS.' + key + '.count 应为正数');
  assertGreaterThan(pack.price, 0, 'POINTS_PACKS.' + key + '.price 应为正数');
  assertGreaterThan(pack.expire_days, 0, 'POINTS_PACKS.' + key + '.expire_days 应为正数');
});

// 验证具体值
assertEqual(constants.POINTS_PACKS.PACK_3.count, 3, 'PACK_3.count 应为 3');
assertEqual(constants.POINTS_PACKS.PACK_3.price, 1990, 'PACK_3.price 应为 1990');
assertEqual(constants.POINTS_PACKS.PACK_3.expire_days, 90, 'PACK_3.expire_days 应为 90');

assertEqual(constants.POINTS_PACKS.PACK_5.count, 5, 'PACK_5.count 应为 5');
assertEqual(constants.POINTS_PACKS.PACK_5.price, 2990, 'PACK_5.price 应为 2990');
assertEqual(constants.POINTS_PACKS.PACK_5.expire_days, 90, 'PACK_5.expire_days 应为 90');

console.log('\n=== 9. BUNDLES 结构 ===');
assertHasProperty(constants, 'BUNDLES', 'BUNDLES 应存在');
assertType(constants.BUNDLES, 'object', 'BUNDLES 应为对象');

const bundleTypes = ['STARTER', 'ESSENTIAL', 'FAMILY'];
bundleTypes.forEach(function (key) {
  assertHasProperty(constants.BUNDLES, key, 'BUNDLES.' + key + ' 应存在');
  const bundle = constants.BUNDLES[key];
  assertType(bundle, 'object', 'BUNDLES.' + key + ' 应为对象');

  // 验证 bundle 结构
  assertHasProperty(bundle, 'name', 'BUNDLES.' + key + '.name 应存在');
  assertHasProperty(bundle, 'items', 'BUNDLES.' + key + '.items 应存在');
  assertHasProperty(bundle, 'price', 'BUNDLES.' + key + '.price 应存在');
  assertHasProperty(bundle, 'origin_price', 'BUNDLES.' + key + '.origin_price 应存在');

  // 验证类型
  assertType(bundle.name, 'string', 'BUNDLES.' + key + '.name 应为字符串');
  assert(Array.isArray(bundle.items), 'BUNDLES.' + key + '.items 应为数组');
  assertType(bundle.price, 'number', 'BUNDLES.' + key + '.price 应为数字');
  assertType(bundle.origin_price, 'number', 'BUNDLES.' + key + '.origin_price 应为数字');
  assertGreaterThan(bundle.price, 0, 'BUNDLES.' + key + '.price 应为正数');
  assertGreaterThan(bundle.origin_price, 0, 'BUNDLES.' + key + '.origin_price 应为正数');

  // 验证 price < origin_price
  assert(bundle.price < bundle.origin_price, 'BUNDLES.' + key + '.price 应小于 origin_price');
});

// 验证具体值
assertEqual(constants.BUNDLES.STARTER.name, '新手礼包', 'STARTER.name 应为 新手礼包');
assertEqual(constants.BUNDLES.ESSENTIAL.name, '铲屎官必备', 'ESSENTIAL.name 应为 铲屎官必备');
assertEqual(constants.BUNDLES.FAMILY.name, '家庭尊享', 'FAMILY.name 应为 家庭尊享');

assertEqual(constants.BUNDLES.STARTER.price, 2990, 'STARTER.price 应为 2990');
assertEqual(constants.BUNDLES.ESSENTIAL.price, 11900, 'ESSENTIAL.price 应为 11900');
assertEqual(constants.BUNDLES.FAMILY.price, 3990, 'FAMILY.price 应为 3990');

console.log('\n=== 10. MEMBER_LIMITS 完整性 ===');
assertHasProperty(constants, 'MEMBER_LIMITS', 'MEMBER_LIMITS 应存在');
assertType(constants.MEMBER_LIMITS, 'object', 'MEMBER_LIMITS 应为对象');

const limitKeys = [
  'MAX_PETS_PERSONAL',
  'MAX_PETS_FAMILY',
  'MAX_FAMILY_MEMBERS',
  'TRIAL_DURATION_DAYS',
  'TRIAL_COOLDOWN_DAYS',
];
limitKeys.forEach(function (key) {
  assertHasProperty(constants.MEMBER_LIMITS, key, 'MEMBER_LIMITS.' + key + ' 应存在');
  assertType(constants.MEMBER_LIMITS[key], 'number', 'MEMBER_LIMITS.' + key + ' 应为数字');
  assertGreaterThan(constants.MEMBER_LIMITS[key], 0, 'MEMBER_LIMITS.' + key + ' 应为正数');
});

assertEqual(constants.MEMBER_LIMITS.MAX_PETS_PERSONAL, 3, 'MAX_PETS_PERSONAL 应为 3');
assertEqual(constants.MEMBER_LIMITS.MAX_PETS_FAMILY, 5, 'MAX_PETS_FAMILY 应为 5');
assertEqual(constants.MEMBER_LIMITS.MAX_FAMILY_MEMBERS, 4, 'MAX_FAMILY_MEMBERS 应为 4');
assertEqual(constants.MEMBER_LIMITS.TRIAL_DURATION_DAYS, 7, 'TRIAL_DURATION_DAYS 应为 7');
assertEqual(constants.MEMBER_LIMITS.TRIAL_COOLDOWN_DAYS, 30, 'TRIAL_COOLDOWN_DAYS 应为 30');

console.log('\n=== 11. INVITE_CONFIG 完整性 ===');
assertHasProperty(constants, 'INVITE_CONFIG', 'INVITE_CONFIG 应存在');
assertType(constants.INVITE_CONFIG, 'object', 'INVITE_CONFIG 应为对象');

const inviteKeys = [
  'REWARD_CREDITS',
  'TRIAL_THRESHOLD',
  'TRIAL_DAYS',
  'MAX_REWARDS_PER_MONTH',
  'MAX_INVITES_PER_DAY',
  'EXPIRE_DAYS',
];
inviteKeys.forEach(function (key) {
  assertHasProperty(constants.INVITE_CONFIG, key, 'INVITE_CONFIG.' + key + ' 应存在');
  assertType(constants.INVITE_CONFIG[key], 'number', 'INVITE_CONFIG.' + key + ' 应为数字');
  assertGreaterThan(constants.INVITE_CONFIG[key], 0, 'INVITE_CONFIG.' + key + ' 应为正数');
});

assertEqual(constants.INVITE_CONFIG.REWARD_CREDITS, 1, 'REWARD_CREDITS 应为 1');
assertEqual(constants.INVITE_CONFIG.TRIAL_THRESHOLD, 3, 'TRIAL_THRESHOLD 应为 3');
assertEqual(constants.INVITE_CONFIG.TRIAL_DAYS, 7, 'TRIAL_DAYS 应为 7');
assertEqual(constants.INVITE_CONFIG.MAX_REWARDS_PER_MONTH, 10, 'MAX_REWARDS_PER_MONTH 应为 10');
assertEqual(constants.INVITE_CONFIG.MAX_INVITES_PER_DAY, 50, 'MAX_INVITES_PER_DAY 应为 50');
assertEqual(constants.INVITE_CONFIG.EXPIRE_DAYS, 7, 'EXPIRE_DAYS 应为 7');

console.log('\n=== 12. VALID_SYMPTOM_SET 验证 ===');
assertHasProperty(constants, 'VALID_SYMPTOM_IDS', 'VALID_SYMPTOM_IDS 应存在');
assertHasProperty(constants, 'VALID_SYMPTOM_SET', 'VALID_SYMPTOM_SET 应存在');
assert(Array.isArray(constants.VALID_SYMPTOM_IDS), 'VALID_SYMPTOM_IDS 应为数组');
assert(constants.VALID_SYMPTOM_SET instanceof Set, 'VALID_SYMPTOM_SET 应为 Set');

// 验证 Set 大小等于数组长度
assert(
  constants.VALID_SYMPTOM_SET.size === constants.VALID_SYMPTOM_IDS.length,
  'VALID_SYMPTOM_SET.size (' +
    constants.VALID_SYMPTOM_SET.size +
    ') 应等于 VALID_SYMPTOM_IDS.length (' +
    constants.VALID_SYMPTOM_IDS.length +
    ')'
);

// 验证所有 ID 都在 Set 中
constants.VALID_SYMPTOM_IDS.forEach(function (id) {
  assert(constants.VALID_SYMPTOM_SET.has(id), 'VALID_SYMPTOM_SET 应包含症状 ID: ' + id);
});

// 验证已知的高风险症状ID存在
const highRiskSymptoms = ['coma', 'bleeding', 'paralysis', 'collapse', 'cyanosis'];
highRiskSymptoms.forEach(function (id) {
  assert(constants.VALID_SYMPTOM_SET.has(id), 'VALID_SYMPTOM_SET 应包含高风险症状: ' + id);
});

console.log('\n=== 13. SERVER_CONFIG 结构 ===');
assertHasProperty(constants, 'SERVER_CONFIG', 'SERVER_CONFIG 应存在');
assertType(constants.SERVER_CONFIG, 'object', 'SERVER_CONFIG 应为对象');

const serverConfigKeys = [
  'TOKEN_SECRET',
  'TENCENT_MAP_KEY',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_MODEL',
  'ADMIN_SECRET',
];
serverConfigKeys.forEach(function (key) {
  assertHasProperty(constants.SERVER_CONFIG, key, 'SERVER_CONFIG.' + key + ' 应存在');
});

// 验证默认值
assertEqual(
  constants.SERVER_CONFIG.DEEPSEEK_BASE_URL,
  'https://api.deepseek.com',
  'DEEPSEEK_BASE_URL 应为 https://api.deepseek.com'
);
assertEqual(
  constants.SERVER_CONFIG.DEEPSEEK_MODEL,
  'deepseek-chat',
  'DEEPSEEK_MODEL 应为 deepseek-chat'
);

// 验证密钥默认为空（需要从数据库加载）
assert(constants.SERVER_CONFIG.TOKEN_SECRET === '', 'TOKEN_SECRET 默认应为空字符串');
assert(constants.SERVER_CONFIG.TENCENT_MAP_KEY === '', 'TENCENT_MAP_KEY 默认应为空字符串');
assert(constants.SERVER_CONFIG.DEEPSEEK_API_KEY === '', 'DEEPSEEK_API_KEY 默认应为空字符串');
assert(constants.SERVER_CONFIG.ADMIN_SECRET === '', 'ADMIN_SECRET 默认应为空字符串');

console.log('\n=== 14. TIME 常量验证 ===');
assertHasProperty(constants, 'TIME', 'TIME 应存在');
assertType(constants.TIME, 'object', 'TIME 应为对象');

const timeKeys = ['MINUTE', 'HOUR', 'DAY', 'WEEK', 'CACHE_5MIN', 'CACHE_30MIN'];
timeKeys.forEach(function (key) {
  assertHasProperty(constants.TIME, key, 'TIME.' + key + ' 应存在');
  assertType(constants.TIME[key], 'number', 'TIME.' + key + ' 应为数字');
  assertGreaterThan(constants.TIME[key], 0, 'TIME.' + key + ' 应为正数');
});

// 验证具体值
assertEqual(constants.TIME.MINUTE, 60 * 1000, 'MINUTE 应为 60000 (毫秒)');
assertEqual(constants.TIME.HOUR, 60 * 60 * 1000, 'HOUR 应为 3600000 (毫秒)');
assertEqual(constants.TIME.DAY, 24 * 60 * 60 * 1000, 'DAY 应为 86400000 (毫秒)');
assertEqual(constants.TIME.WEEK, 7 * 24 * 60 * 60 * 1000, 'WEEK 应为 604800000 (毫秒)');
assertEqual(constants.TIME.CACHE_5MIN, 5 * 60 * 1000, 'CACHE_5MIN 应为 300000 (毫秒)');
assertEqual(constants.TIME.CACHE_30MIN, 30 * 60 * 1000, 'CACHE_30MIN 应为 1800000 (毫秒)');

console.log('\n=== 15. CONFIG_KEY_MAP 映射完整性（内部常量）===');
// 注意：CONFIG_KEY_MAP 未导出，仅作为内部常量存在
// 这里跳过测试，因为它不是公共 API
console.log('  ⚠ CONFIG_KEY_MAP 未导出，跳过测试（内部常量）');

console.log('\n=== 16. V1.5 新增其他常量 ===');
// MEMBER_STATUS
assertHasProperty(constants, 'MEMBER_STATUS', 'MEMBER_STATUS 应存在');
assertType(constants.MEMBER_STATUS, 'object', 'MEMBER_STATUS 应为对象');
['ACTIVE', 'EXPIRED', 'CANCELLED'].forEach(function (key) {
  assertHasProperty(constants.MEMBER_STATUS, key, 'MEMBER_STATUS.' + key + ' 应存在');
});

// REPORT_SOURCE
assertHasProperty(constants, 'REPORT_SOURCE', 'REPORT_SOURCE 应存在');
assertType(constants.REPORT_SOURCE, 'object', 'REPORT_SOURCE 应为对象');
['TEMPLATE', 'LLM', 'CACHE'].forEach(function (key) {
  assertHasProperty(constants.REPORT_SOURCE, key, 'REPORT_SOURCE.' + key + ' 应存在');
});

// CACHE_TTL
assertHasProperty(constants, 'CACHE_TTL', 'CACHE_TTL 应存在');
assertType(constants.CACHE_TTL, 'number', 'CACHE_TTL 应为数字');
assertEqual(constants.CACHE_TTL, 24 * 60 * 60 * 1000, 'CACHE_TTL 应为 24小时');

// INVITE_STATUS
assertHasProperty(constants, 'INVITE_STATUS', 'INVITE_STATUS 应存在');
assertType(constants.INVITE_STATUS, 'object', 'INVITE_STATUS 应为对象');
['PENDING', 'REWARDED', 'EXPIRED'].forEach(function (key) {
  assertHasProperty(constants.INVITE_STATUS, key, 'INVITE_STATUS.' + key + ' 应存在');
});

// PAYMENT_TIMEOUT
assertHasProperty(constants, 'PAYMENT_TIMEOUT', 'PAYMENT_TIMEOUT 应存在');
assertType(constants.PAYMENT_TIMEOUT, 'number', 'PAYMENT_TIMEOUT 应为数字');
assertEqual(constants.PAYMENT_TIMEOUT, 30, 'PAYMENT_TIMEOUT 应为 30 (分钟)');

// AI_CONFIG
assertHasProperty(constants, 'AI_CONFIG', 'AI_CONFIG 应存在');
assertType(constants.AI_CONFIG, 'object', 'AI_CONFIG 应为对象');
['TEMPERATURE', 'MAX_TOKENS', 'TIMEOUT_MS', 'API_PORT', 'CACHE_CLEANUP_PROBABILITY'].forEach(
  function (key) {
    assertHasProperty(constants.AI_CONFIG, key, 'AI_CONFIG.' + key + ' 应存在');
  }
);

// RANKING_CONFIG
assertHasProperty(constants, 'RANKING_CONFIG', 'RANKING_CONFIG 应存在');
assertType(constants.RANKING_CONFIG, 'object', 'RANKING_CONFIG 应为对象');
['TOP_N', 'BATCH_SIZE', 'MAX_QUERY_LIMIT'].forEach(function (key) {
  assertHasProperty(constants.RANKING_CONFIG, key, 'RANKING_CONFIG.' + key + ' 应存在');
});

// RATE_LIMIT
assertHasProperty(constants, 'RATE_LIMIT', 'RATE_LIMIT 应存在');
assertType(constants.RATE_LIMIT, 'object', 'RATE_LIMIT 应为对象');
['WINDOW_MS', 'MAX_REQUESTS', 'DAILY_MAX_INVITES'].forEach(function (key) {
  assertHasProperty(constants.RATE_LIMIT, key, 'RATE_LIMIT.' + key + ' 应存在');
});

console.log('\n=== 17. warmupConfig 函数存在性 ===');
assertHasProperty(constants, 'warmupConfig', 'warmupConfig 函数应存在');
assertType(constants.warmupConfig, 'function', 'warmupConfig 应为函数');

// ========== 测试总结 ==========
const success = summary('constants-v15.test.js');
console.log('\n预期: ~200+ 测试用例\n');

if (!success) {
  process.exit(1);
}
