/**
 * 管理员认证模块 (common/admin-auth.js) 单元测试
 * TDD: RED → GREEN → REFACTOR
 *
 * 测试范围:
 * - generateAdminToken: Token 生成逻辑
 * - verifyAdminToken: Token 验证逻辑
 * - validateAdminRequest: 请求验证逻辑
 */
const crypto = require('crypto');

// ===== 测试框架 =====
let passed = 0, failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) { passed++; }
  else { failed++; errors.push(`FAIL: ${message}`); console.error(`  ✗ ${message}`); }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; }
  else {
    failed++;
    const msg = `${message} - 期望: ${JSON.stringify(expected)}, 实际: ${JSON.stringify(actual)}`;
    errors.push(`FAIL: ${msg}`);
    console.error(`  ✗ ${msg}`);
  }
}

function summary(name) {
  const total = passed + failed;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${name}: ${passed}/${total} 通过, ${failed} 失败`);
}

// ===== 被测代码（从 admin-auth.js 提取的纯逻辑） =====

/**
 * 获取管理员密钥（Mock 版本）
 */
function getAdminSecret(config = {}) {
  const secret = config.ADMIN_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SECRET 未配置，请在 system_config 集合中设置');
  }
  return secret;
}

/**
 * 验证管理员 Token（独立逻辑副本）
 */
function verifyAdminToken(token, config = {}) {
  try {
    if (!token) return false;

    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const payloadStr = Buffer.from(parts[0], 'base64').toString();
    const payload = JSON.parse(payloadStr);

    // 验证签名（密钥未配置时直接返回 false）
    let secret;
    try {
      secret = getAdminSecret(config);
    } catch (e) {
      console.error('[admin-auth] 密钥未配置，拒绝所有管理员请求');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex');

    // 使用恒定时间比较防止时序攻击
    const sigBuf = Buffer.from(parts[1], 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return false;
    }

    // 检查 Token 类型
    if (payload.type !== 'admin') return false;

    // 检查是否过期
    if (Date.now() - payload.timestamp > (payload.expiresIn || 86400000)) return false;

    return true;
  } catch (e) {
    console.error('[admin-auth] Token验证失败:', e.message);
    return false;
  }
}

/**
 * 生成管理员 Token（独立逻辑副本）
 */
function generateAdminToken(config = {}) {
  const secret = getAdminSecret(config);

  const payload = {
    type: 'admin',
    timestamp: Date.now(),
    expiresIn: 24 * 60 * 60 * 1000 // 24小时
  };

  const payloadStr = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadStr)
    .digest('hex');

  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

/**
 * 验证请求的管理员权限（独立逻辑副本）
 */
function validateAdminRequest(event, config = {}) {
  const token = event && event.adminToken;

  if (!token) {
    return { valid: false, error: '缺少管理员 Token' };
  }

  if (!verifyAdminToken(token, config)) {
    return { valid: false, error: '管理员 Token 无效或已过期' };
  }

  return { valid: true };
}

// ========== 测试套件 ==========

console.log('\n=== 1. generateAdminToken 基础功能 ===');

const TEST_SECRET = 'test_admin_secret_key_12345';
const config = { ADMIN_SECRET: TEST_SECRET };

// 测试 1: 生成 Token 结构正确
const token = generateAdminToken(config);
const parts = token.split('.');
assert(parts.length === 2, 'Token 应该有 2 部分 (payload.signature)');
assert(parts[0].length > 0, 'payload 部分非空');
assert(parts[1].length === 64, 'signature 应该是 64 字符 hex (SHA256)');

console.log('\n=== 2. generateAdminToken payload 内容验证 ===');

// 解析 payload 验证内容
const payloadStr = Buffer.from(parts[0], 'base64').toString();
const payload = JSON.parse(payloadStr);

assertEqual(payload.type, 'admin', 'payload.type = "admin"');
assert(typeof payload.timestamp === 'number', 'payload.timestamp 是数字');
assert(payload.timestamp > 0, 'payload.timestamp 是正数');
assertEqual(payload.expiresIn, 86400000, 'payload.expiresIn = 24小时 (86400000ms)');

console.log('\n=== 3. generateAdminToken ADMIN_SECRET 未配置异常 ===');

try {
  generateAdminToken({});
  assert(false, 'ADMIN_SECRET 未配置应该抛出异常');
} catch (e) {
  assert(e.message.includes('ADMIN_SECRET 未配置'), '抛出正确的错误消息');
}

console.log('\n=== 4. verifyAdminToken 有效 Token 验证 ===');

const validToken = generateAdminToken(config);
assert(verifyAdminToken(validToken, config) === true, '有效 Token 验证通过');

console.log('\n=== 5. verifyAdminToken 空/null/undefined Token ===');

assert(verifyAdminToken('', config) === false, '空串 Token → false');
assert(verifyAdminToken(null, config) === false, 'null Token → false');
assert(verifyAdminToken(undefined, config) === false, 'undefined Token → false');

console.log('\n=== 6. verifyAdminToken 格式错误 ===');

// 不是 2 段
assert(verifyAdminToken('invalid', config) === false, '无分隔符 → false');
assert(verifyAdminToken('a', config) === false, '仅 1 段 → false');
assert(verifyAdminToken('a.b.c', config) === false, '3 段 → false');
assert(verifyAdminToken('a.b.c.d', config) === false, '4 段 → false');

console.log('\n=== 7. verifyAdminToken 签名篡改检测 ===');

const validParts = validToken.split('.');

// 篡改签名
const tamperedSig = '0'.repeat(64);
const tamperedToken1 = `${validParts[0]}.${tamperedSig}`;
assert(verifyAdminToken(tamperedToken1, config) === false, '篡改签名 → false');

// 篡改 payload
const tamperedPayload = Buffer.from(JSON.stringify({ type: 'admin', timestamp: Date.now(), expiresIn: 86400000, role: 'superadmin' })).toString('base64');
const tamperedToken2 = `${tamperedPayload}.${validParts[1]}`;
assert(verifyAdminToken(tamperedToken2, config) === false, '篡改 payload → false');

console.log('\n=== 8. verifyAdminToken payload 类型验证 ===');

// 生成非 admin 类型 Token
function generateNonAdminToken(secret) {
  const payload = { type: 'user', timestamp: Date.now(), expiresIn: 86400000 };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

const userToken = generateNonAdminToken(TEST_SECRET);
assert(verifyAdminToken(userToken, config) === false, '非 admin 类型 Token → false');

// 缺少 type 字段
function generateNoTypeToken(secret) {
  const payload = { timestamp: Date.now(), expiresIn: 86400000 };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

const noTypeToken = generateNoTypeToken(TEST_SECRET);
assert(verifyAdminToken(noTypeToken, config) === false, '缺少 type 字段 → false');

console.log('\n=== 9. verifyAdminToken 过期检测 ===');

function generateExpiredToken(secret) {
  const payload = {
    type: 'admin',
    timestamp: Date.now() - 86400000 - 1000, // 24小时 + 1秒前
    expiresIn: 86400000
  };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

const expiredToken = generateExpiredToken(TEST_SECRET);
assert(verifyAdminToken(expiredToken, config) === false, '过期 Token → false');

// 临界值测试: 刚过期的 Token
function generateJustExpiredToken(secret) {
  const payload = {
    type: 'admin',
    timestamp: Date.now() - 86400000 - 1, // 刚好超过 24小时 1ms
    expiresIn: 86400000
  };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

const justExpiredToken = generateJustExpiredToken(TEST_SECRET);
assert(verifyAdminToken(justExpiredToken, config) === false, '刚好过期 Token → false');

// 临界值测试: 即将过期的 Token 应该有效
function generateAlmostExpiredToken(secret) {
  const payload = {
    type: 'admin',
    timestamp: Date.now() - 86400000 + 1000, // 24小时前 + 1秒
    expiresIn: 86400000
  };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

const almostExpiredToken = generateAlmostExpiredToken(TEST_SECRET);
assert(verifyAdminToken(almostExpiredToken, config) === true, '即将过期 Token 应该有效');

console.log('\n=== 10. verifyAdminToken 密钥错误检测 ===');

// 使用不同密钥生成 Token
const config2 = { ADMIN_SECRET: 'different_secret_key_67890' };
const tokenWithDiffSecret = generateAdminToken(config2);
assert(verifyAdminToken(tokenWithDiffSecret, config) === false, '不同密钥生成的 Token → false');

// 密钥未配置时验证 Token
assert(verifyAdminToken(validToken, {}) === false, '密钥未配置 → false');

console.log('\n=== 11. verifyAdminToken 异常 payload 处理 ===');

// 恶意 base64 内容
const badPayload = '!!!not-valid-base64!!!';
const badToken = `${badPayload}.${crypto.createHmac('sha256', TEST_SECRET).update(badPayload).digest('hex')}`;
assert(verifyAdminToken(badToken, config) === false, '非法 base64 payload → false');

// 无效 JSON
const invalidJsonPayload = Buffer.from('not a json').toString('base64');
const invalidJsonToken = `${invalidJsonPayload}.${crypto.createHmac('sha256', TEST_SECRET).update(invalidJsonPayload).digest('hex')}`;
assert(verifyAdminToken(invalidJsonToken, config) === false, '无效 JSON payload → false');

console.log('\n=== 12. validateAdminRequest 缺少 token ===');

assertEqual(validateAdminRequest(null, config), { valid: false, error: '缺少管理员 Token' }, 'null event → { valid: false }');
assertEqual(validateAdminRequest({}, config), { valid: false, error: '缺少管理员 Token' }, '空 event → { valid: false }');
assertEqual(validateAdminRequest({ adminToken: '' }, config), { valid: false, error: '缺少管理员 Token' }, '空 adminToken → { valid: false }');

console.log('\n=== 13. validateAdminRequest 无效 token ===');

assertEqual(validateAdminRequest({ adminToken: 'invalid_token' }, config), { valid: false, error: '管理员 Token 无效或已过期' }, '无效 token → { valid: false }');
assertEqual(validateAdminRequest({ adminToken: expiredToken }, config), { valid: false, error: '管理员 Token 无效或已过期' }, '过期 token → { valid: false }');
assertEqual(validateAdminRequest({ adminToken: userToken }, config), { valid: false, error: '管理员 Token 无效或已过期' }, '非 admin 类型 token → { valid: false }');

console.log('\n=== 14. validateAdminRequest 有效 token ===');

const validResult = validateAdminRequest({ adminToken: validToken }, config);
assertEqual(validResult, { valid: true }, '有效 token → { valid: true }');

console.log('\n=== 15. Token 时序攻击防护验证 ===');

// 多次验证同一 Token 应该产生相同结果（时序攻击防护不会影响正确性）
for (let i = 0; i < 10; i++) {
  assert(verifyAdminToken(validToken, config) === true, `第 ${i + 1} 次验证有效 Token 应该成功`);
}

// 验证错误 Token 应该始终失败
for (let i = 0; i < 10; i++) {
  assert(verifyAdminToken('invalid', config) === false, `第 ${i + 1} 次验证无效 Token 应该失败`);
}

console.log('\n=== 16. 不同密钥生成的 Token 相互独立 ===');

const configA = { ADMIN_SECRET: 'secret_A_12345' };
const configB = { ADMIN_SECRET: 'secret_B_67890' };

const tokenA = generateAdminToken(configA);
const tokenB = generateAdminToken(configB);

assert(tokenA !== tokenB, '不同密钥生成不同 Token');
assert(verifyAdminToken(tokenA, configA) === true, 'Token A 能被密钥 A 验证');
assert(verifyAdminToken(tokenB, configB) === true, 'Token B 能被密钥 B 验证');
assert(verifyAdminToken(tokenA, configB) === false, 'Token A 不能被密钥 B 验证');
assert(verifyAdminToken(tokenB, configA) === false, 'Token B 不能被密钥 A 验证');

console.log('\n=== 17. Token 唯一性测试 ===');

// 同一密钥多次生成 Token 应该不同（因为 timestamp 不同）
const token1 = generateAdminToken(config);

// 稍微延迟以确保 timestamp 不同
const start = Date.now();
while (Date.now() - start < 5) { /* 等待 5ms 确保 timestamp 不同 */ }

const token2 = generateAdminToken(config);

while (Date.now() - start < 10) { /* 再等 5ms */ }

const token3 = generateAdminToken(config);

assert(token1 !== token2, '不同时间生成的 Token 应该不同');
assert(token2 !== token3, '不同时间生成的 Token 应该不同');

// 所有 Token 都应该有效
assert(verifyAdminToken(token1, config) === true, 'Token 1 有效');
assert(verifyAdminToken(token2, config) === true, 'Token 2 有效');
assert(verifyAdminToken(token3, config) === true, 'Token 3 有效');

console.log('\n=== 18. 自定义过期时间测试 ===');

function generateCustomExpireToken(secret, expiresIn) {
  const payload = { type: 'admin', timestamp: Date.now(), expiresIn };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

// 短期过期 Token (1小时)
const shortExpireToken = generateCustomExpireToken(TEST_SECRET, 3600000);
assert(verifyAdminToken(shortExpireToken, config) === true, '短期过期 Token (1小时) 应该有效');

// 长期过期 Token (7天)
const longExpireToken = generateCustomExpireToken(TEST_SECRET, 604800000);
assert(verifyAdminToken(longExpireToken, config) === true, '长期过期 Token (7天) 应该有效');

// 即将过期的短期 Token
function generateExpiredShortToken(secret) {
  const payload = { type: 'admin', timestamp: Date.now() - 3600000 - 1, expiresIn: 3600000 };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

const expiredShortToken = generateExpiredShortToken(TEST_SECRET);
assert(verifyAdminToken(expiredShortToken, config) === false, '过期的短期 Token 应该无效');

console.log('\n=== 19. 边界值测试 ===');

// 极短的过期时间 (1ms) - 需要生成一个已经过期的 Token
function generateVeryShortToken(secret) {
  const payload = { type: 'admin', timestamp: Date.now() - 10, expiresIn: 1 };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

const veryShortToken = generateVeryShortToken(TEST_SECRET);
// 这个 Token 理论上立即过期 (timestamp 在 10ms 前，expiresIn=1ms)
assert(verifyAdminToken(veryShortToken, config) === false, '极短过期时间 Token 应该立即过期');

// 零过期时间 - 需要生成一个 timestamp 在过去的 Token
// 当 expiresIn=0 时，实际使用默认值 86400000，所以需要 timestamp 在过去 24+ 小时
function generateZeroExpireToken(secret) {
  const payload = { type: 'admin', timestamp: Date.now() - 86400001, expiresIn: 0 };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

const zeroExpireToken = generateZeroExpireToken(TEST_SECRET);
// expiresIn=0 时使用默认值 86400000，timestamp 在过去 24+ 小时 → 过期
assert(verifyAdminToken(zeroExpireToken, config) === false, '零过期时间 + 旧 timestamp Token 应该过期');

console.log('\n=== 20. 签名格式验证 ===');

// 无效的 hex 签名 (不是 64 字符)
const shortSig = 'abc';
const invalidSigToken = `${parts[0]}.${shortSig}`;
assert(verifyAdminToken(invalidSigToken, config) === false, '短签名 Token → false');

// 非 hex 字符的签名
const nonHexSig = 'x'.repeat(64);
const nonHexSigToken = `${parts[0]}.${nonHexSig}`;
assert(verifyAdminToken(nonHexSigToken, config) === false, '非 hex 签名 Token → false');

summary('admin-auth.test.js');
console.log('预期: ~45 tests (全面覆盖)\n');

if (failed > 0) {
  console.error('\n❌ 失败详情:');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
}

console.log('✅ 所有测试通过!');
