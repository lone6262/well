/**
 * 认证模块 (common/auth.js) 单元测试
 * TDD: RED → GREEN → REFACTOR
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

// ===== 被测代码（从 auth.js 提取的纯逻辑） =====
const TOKEN_EXPIRE_DAYS = 7;

function createSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function generateTokenWithSecret(openid, userId, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    openid, userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRE_DAYS * 24 * 60 * 60
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(`${headerB64}.${payloadB64}`, secret);
  return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyTokenWithSecret(token, secret) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = createSignature(`${headerB64}.${payloadB64}`, secret);
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function authenticateWithSecret(token, openid, secret) {
  const payload = verifyTokenWithSecret(token, secret);
  return { openid, valid: !!payload, payload };
}

// ========== 测试套件 ==========

console.log('\n=== 1. createSignature 基础功能 ===');
const sig = createSignature('test.payload', 'mysecret');
assert(typeof sig === 'string', '签名应该是字符串');
assert(sig.length === 64, 'HMAC-SHA256 输出应为 64 字符 hex');
assert(sig !== createSignature('different.payload', 'mysecret'), '不同输入产生不同签名');
assert(createSignature('same.payload', 'mysecret') === createSignature('same.payload', 'mysecret'), '相同输入产生相同签名（确定性）');

// 密钥敏感性
const sig1 = createSignature('payload', 'secret1');
const sig2 = createSignature('payload', 'secret2');
assert(sig1 !== sig2, '不同密钥应产生不同签名');

console.log('\n=== 2. generateToken 结构 ===');
const SECRET = 'test_secret_v1';
const token = generateTokenWithSecret('openid_001', 'user_db_123', SECRET);
const parts = token.split('.');
assert(parts.length === 3, 'Token 应有 3 部分 (header.payload.signature)');
assert(parts[2].length === 64, '签名部分应为 64 字符 hex');

// 验证 header
const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
assertEqual(header.alg, 'HS256', 'header.alg = HS256');
assertEqual(header.typ, 'JWT', 'header.typ = JWT');

// 验证 payload
const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
assertEqual(payload.openid, 'openid_001', 'payload.openid 正确');
assertEqual(payload.userId, 'user_db_123', 'payload.userId 正确');
assert(typeof payload.iat === 'number', 'iat 是数字时间戳');
assert(typeof payload.exp === 'number', 'exp 是数字时间戳');
assert(payload.exp - payload.iat === TOKEN_EXPIRE_DAYS * 24 * 60 * 60, '过期时间 = iat + 7天');

console.log('\n=== 3. verifyToken 正常流程 ===');
const verifiedPayload = verifyTokenWithSecret(token, SECRET);
assert(verifiedPayload !== null, '有效 Token 验证成功');
assertEqual(verifiedPayload.openid, 'openid_001', '验证后 openid 一致');
assertEqual(verifiedPayload.userId, 'user_db_123', '验证后 userId 一致');

console.log('\n=== 4. verifyToken 异常输入 ===');
assert(verifyTokenWithSecret(null, SECRET) === null, 'null Token → null');
assert(verifyTokenWithSecret('', SECRET) === null, '空串 Token → null');
assert(verifyTokenWithSecret(undefined, SECRET) === null, 'undefined Token → null');
assert(verifyTokenWithSecret('invalid', SECRET) === null, '无分隔符 → null');
assert(verifyTokenWithSecret('a.b', SECRET) === null, '仅2段 → null');
assert(verifyTokenWithSecret('a.b.c.d', SECRET) === null, '4段 → null');

console.log('\n=== 5. verifyToken 篡改检测 ===');
// 修改 header
const tamperedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
const tampered1 = `${tamperedHeader}.${parts[1]}.${parts[2]}`;
assert(verifyTokenWithSecret(tampered1, SECRET) === null, '篡改 header → null');

// 修改 payload
const tamperedPayload = Buffer.from(JSON.stringify({ openid: 'hacker', userId: 'x' })).toString('base64url');
const tampered2 = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
assert(verifyTokenWithSecret(tampered2, SECRET) === null, '篡改 payload → null');

// 修改签名
const tampered3 = `${parts[0]}.${parts[1]}.${'0'.repeat(64)}`;
assert(verifyTokenWithSecret(tampered3, SECRET) === null, '篡改签名 → null');

// 不同密钥验证
assert(verifyTokenWithSecret(token, 'wrong_secret') === null, '错误密钥验证 → null');

console.log('\n=== 6. verifyToken 过期检测 ===');
function generateExpiredToken(openid, userId, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    openid, userId,
    iat: Math.floor(Date.now() / 1000) - 86400 * 365,
    exp: Math.floor(Date.now() / 1000) - 1
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(`${headerB64}.${payloadB64}`, secret);
  return `${headerB64}.${payloadB64}.${signature}`;
}

const expiredToken = generateExpiredToken('u', 'id', SECRET);
assert(verifyTokenWithSecret(expiredToken, SECRET) === null, '过期 Token → null');

// 临界值测试: 未来很久才过期的 Token 应该有效
function generateFarFutureToken(openid, userId, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    openid, userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 365 // 1年后
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(`${headerB64}.${payloadB64}`, secret);
  return `${headerB64}.${payloadB64}.${signature}`;
}
assert(verifyTokenWithSecret(generateFarFutureToken('u', 'id', SECRET), SECRET) !== null, '远期过期 Token 应有效');

console.log('\n=== 7. verifyToken 异常 payload 编码 ===');
// 恶意 base64 内容
const badPayload64 = '!!!not-valid-base64!!!';
const badToken = `${parts[0]}.${badPayload64}.${createSignature(`${parts[0]}.${badPayload64}`, SECRET)}`;
assert(verifyTokenWithSecret(badToken, SECRET) === null, '非法 base64 payload → null');

console.log('\n=== 8. authenticate 组合函数 ===');
const authResult1 = authenticateWithSecret(token, 'openid_001', SECRET);
assert(authResult1.valid === true, '有效 Token → valid=true');
assertEqual(authResult1.openid, 'openid_001', 'authenticate 返回正确的 openid');
assert(authResult1.payload !== null, '有效 Token → payload 非 null');

const authResult2 = authenticateWithSecret('bad_token', 'openid_001', SECRET);
assert(authResult2.valid === false, '无效 Token → valid=false');
assertEqual(authResult2.openid, 'openid_001', '即使 Token 无效，仍返回 openid');
assert(authResult2.payload === null, '无效 Token → payload=null');

console.log('\n=== 9. 不同用户 Token 隔离 ===');
const tokenA = generateTokenWithSecret('user_a', 'id_a', SECRET);
const tokenB = generateTokenWithSecret('user_b', 'id_b', SECRET);
const payloadA = verifyTokenWithSecret(tokenA, SECRET);
const payloadB = verifyTokenWithSecret(tokenB, SECRET);
assert(payloadA.openid !== payloadB.openid, '不同用户 Token 应有不同 openid');
assert(payloadA.userId !== payloadB.userId, '不同用户 Token 应有不同 userId');
assert(tokenA !== tokenB, '不同用户 Token 完全不同');

console.log('\n=== 10. Token 特殊字符处理 ===');
const specialOpenid = 'user_with_special_chars_!@#$%';
const tokenSpecial = generateTokenWithSecret(specialOpenid, 'id_special', SECRET);
const payloadSpecial = verifyTokenWithSecret(tokenSpecial, SECRET);
assert(payloadSpecial !== null, '特殊字符 openid 的 Token 应验证成功');
assertEqual(payloadSpecial.openid, specialOpenid, '特殊字符 openid 应正确往返');

summary('auth.test.js');
console.log('预期: ~35 tests (新模块)\n');

if (failed > 0) {
  console.error('\n❌ 失败详情:');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
}
