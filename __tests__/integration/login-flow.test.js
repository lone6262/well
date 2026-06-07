/**
 * 登录流程集成测试
 * 模拟 silentLogin → 用户创建/查找 的完整调用链
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

// ===== 核心函数（模拟云函数逻辑） =====
const TOKEN_SECRET = 'integration_test_secret';
const TOKEN_EXPIRE_DAYS = 7;

function createSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function generateToken(openid, userId) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    openid, userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRE_DAYS * 24 * 60 * 60
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(`${headerB64}.${payloadB64}`, TOKEN_SECRET);
  return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = createSignature(`${headerB64}.${payloadB64}`, TOKEN_SECRET);
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) { return null; }
}

// ===== Mock 数据库 =====
function createMockDb(users = []) {
  const data = [...users];

  return {
    _data: data,
    collection: function(name) {
      if (name === 'users') {
        const self = this;
        return {
          where: function(query) {
            const matched = self._data.filter(u => u._openid === query._openid);
            return {
              get: async () => ({ data: matched }),
              count: async () => ({ total: matched.length }),
              update: async () => ({ stats: { updated: 1 } })
            };
          },
          add: async (doc) => {
            const newUser = { _id: 'new_' + Date.now(), ...doc.data };
            self._data.push(newUser);
            return { _id: newUser._id };
          },
          doc: function(id) {
            return {
              get: async () => ({ data: self._data.find(u => u._id === id) || {} }),
              update: async (updateDoc) => {
                const user = self._data.find(u => u._id === id);
                if (user) Object.assign(user, updateDoc.data);
                return { stats: { updated: 1 } };
              }
            };
          }
        };
      }
      return {
        where: () => ({ get: async () => ({ data: [] }), count: async () => ({ total: 0 }) }),
        add: async () => ({ _id: 'mock_' + Date.now() })
      };
    },
    command: {
      gte: (d) => ({ $gte: d }),
      lt: (d) => ({ $lt: d })
    }
  };
}

// ===== 模拟 silentLogin 云函数逻辑 =====
async function silentLoginHandler(db, openid) {
  // 1. 查询用户是否已存在
  const existingResult = await db.collection('users').where({ _openid: openid }).get();

  let userId;
  if (existingResult.data && existingResult.data.length > 0) {
    // 已存在用户
    userId = existingResult.data[0]._id;
    return { isNewUser: false, userId, token: generateToken(openid, userId) };
  }

  // 2. 新用户创建
  const addResult = await db.collection('users').add({
    data: { _openid: openid, createdAt: new Date(), lastLoginAt: new Date() }
  });
  userId = addResult._id;
  return { isNewUser: true, userId, token: generateToken(openid, userId) };
}

// ========== 测试套件 ==========

console.log('\n=== 1. 新用户首次登录 ===');

async function runTests() {
  // 空数据库，新用户登录
  let db = createMockDb([]);
  let result = await silentLoginHandler(db, 'new_openid_001');

  assert(result.isNewUser === true, '新用户登录 → isNewUser=true');
  assert(typeof result.userId === 'string', '新用户获得 userId');
  assert(result.userId.length > 0, 'userId 非空');
  assert(typeof result.token === 'string', '新用户获得 token');

  // 验证 token 有效性
  let payload = verifyToken(result.token);
  assert(payload !== null, '新用户 token 验证成功');
  assertEqual(payload.openid, 'new_openid_001', 'token 中 openid 正确');
  assertEqual(payload.userId, result.userId, 'token 中 userId 正确');

  // 数据库中应有1个用户
  assert(db._data.length === 1, '数据库新增1个用户');

  console.log('\n=== 2. 老用户再次登录 ===');

  // 同一 openid 再次登录
  result = await silentLoginHandler(db, 'new_openid_001');
  assert(result.isNewUser === false, '老用户登录 → isNewUser=false');
  assert(db._data.length === 1, '老用户登录不新增记录');

  // token 中的 userId 与首次登录一致
  payload = verifyToken(result.token);
  assert(payload !== null, '老用户 token 验证成功');
  assertEqual(payload.userId, db._data[0]._id, 'userId 与数据库一致');

  console.log('\n=== 3. 多用户独立性 ===');

  // 新 openid 应该创建新用户
  let resultB = await silentLoginHandler(db, 'another_openid_002');
  assert(resultB.isNewUser === true, '不同 openid → 新用户');
  assert(db._data.length === 2, '数据库有2个用户');

  // 两个用户 token 不同
  assert(result.token !== resultB.token, '不同用户 token 不同');

  let payloadB = verifyToken(resultB.token);
  assert(payloadB.openid !== payload.openid, '不同用户 openid 不同');

  console.log('\n=== 4. Token 跨请求一致性 ===');

  // 同一用户多次登录，每次生成新 token（iat 不同）
  let r1 = await silentLoginHandler(db, 'new_openid_001');
  let p1 = verifyToken(r1.token);
  let r2 = await silentLoginHandler(db, 'new_openid_001');
  let p2 = verifyToken(r2.token);

  assert(p1 !== null && p2 !== null, '两次登录 token 都有效');
  assertEqual(p1.userId, p2.userId, '两次登录 userId 相同');
  assert(p1.iat <= p2.iat, '第二次登录 iat >= 第一次');

  console.log('\n=== 5. 边界场景：空 openid ===');

  db = createMockDb([]);
  result = await silentLoginHandler(db, '');
  assert(result.isNewUser === true, '空 openid → 仍创建新用户');
  assert(db._data.length === 1, '空 openid 用户创建成功');

  // 再次用空 openid 登录
  result = await silentLoginHandler(db, '');
  assert(result.isNewUser === false, '空 openid 第二次登录 → 老用户');

  console.log('\n=== 6. 并发安全性模拟 ===');

  // 快速两次"新"用户请求（模拟并发）
  db = createMockDb([]);
  const [rA, rB] = await Promise.all([
    silentLoginHandler(db, 'concurrent_user'),
    silentLoginHandler(db, 'concurrent_user')
  ]);

  // 两个请求都返回有效 token，但 userId 可能不同（并发无锁时）
  let vA = verifyToken(rA.token);
  let vB = verifyToken(rB.token);
  assert(vA !== null && vB !== null, '两个并发请求都返回有效 token');
  // 注意：虽然可能创建了2条记录（非原子操作），但每个 token 内部一致
  assert(vA.openid === vB.openid, '两个 token 的 openid 相同');
  console.log(`  并发结果: userA=${rA.userId}, userB=${rB.userId}, 新增用户数=${db._data.length}`);

  summary('login-flow.test.js');
  console.log('预期: ~14 tests\n');

  if (failed > 0) {
    console.error('\n❌ 失败详情:');
    errors.forEach(e => console.error(`  ${e}`));
    process.exit(1);
  }
}

runTests();
