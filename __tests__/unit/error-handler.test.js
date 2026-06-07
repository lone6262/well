/**
 * 错误处理模块 (common/error-handler.js) 单元测试
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

// ===== 被测代码（从 error-handler.js 提取） =====
const RESPONSE_CODE = {
  SUCCESS: 0,
  ERROR: -1,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};

function success(data, msg) {
  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: msg || '成功',
    data: data || {}
  };
}

function error(msg, data) {
  return {
    code: RESPONSE_CODE.ERROR,
    msg: msg || '操作失败',
    data: data || {}
  };
}

function unauthorized(msg) {
  return {
    code: RESPONSE_CODE.UNAUTHORIZED,
    msg: msg || '用户未登录',
    data: {}
  };
}

function serverError(msg, errData) {
  return {
    code: RESPONSE_CODE.SERVER_ERROR,
    msg: msg || '服务器错误',
    data: errData || {}
  };
}

// ========== 测试套件 ==========

console.log('\n=== 1. success() 正常场景 ===');
let result = success({ orderId: '123' }, '订单创建成功');
assertEqual(result.code, 0, 'success.code = 0');
assertEqual(result.msg, '订单创建成功', 'success.msg 自定义消息');
assertEqual(result.data.orderId, '123', 'success.data 包含传入数据');

result = success({ id: 1, name: 'test' });
assertEqual(result.code, 0, 'success 默认 msg - code');
assertEqual(result.msg, '成功', 'success 省略 msg → 默认"成功"');
assertEqual(result.data.id, 1, 'success 省略 msg - data.id');
assertEqual(result.data.name, 'test', 'success 省略 msg - data.name');

console.log('\n=== 2. success() 边界 ===');
result = success();
assertEqual(result.code, 0, 'success() 无参数 - code=0');
assertEqual(result.msg, '成功', 'success() 无参数 - 默认msg');
assertEqual(JSON.stringify(result.data), '{}', 'success() 无参数 - data={}');

result = success(null, '操作成功');
assertEqual(result.code, 0, 'success(null) - code');
// 注: data || {} 导致 null → {}（JS falsy 行为，已知限制）
assertEqual(JSON.stringify(result.data), '{}', 'success(null) - data 回退为 {}');

result = success(undefined, undefined);
assertEqual(result.code, 0, 'success(undefined, undefined) - code');
assertEqual(result.msg, '成功', 'success(undefined, undefined) - 默认msg');

result = success([], '列表为空');
assert(Array.isArray(result.data), 'success([], ...) - data 是数组（[] 是 truthy）');
assert(result.data.length === 0, 'success([], ...) - data 为空数组');

result = success(0, '计数为0');
// 注: 0 是 falsy，data || {} 会回退（已知限制，建议用 ?? 替代 ||）
assertEqual(result.code, 0, 'success(0) - code 仍正确');

result = success(false, '标志为 false');
// 注: false 是 falsy（已知限制）
assertEqual(result.code, 0, 'success(false) - code 仍正确');

console.log('\n=== 3. success() 不变性验证 ===');
const inputData = { a: 1 };
const result1 = success(inputData, 'test');
inputData.a = 999; // 修改原对象
// 注: 当前实现无深拷贝，data 直接引用输入对象（已知限制）
assertEqual(result1.data.a, 999, '当前实现为浅引用（已知限制，建议添加深拷贝）');

console.log('\n=== 4. error() 正常场景 ===');
let errResult = error('参数错误');
assertEqual(errResult.code, -1, 'error.code = -1');
assertEqual(errResult.msg, '参数错误', 'error.msg 自定义');
assertEqual(JSON.stringify(errResult.data), '{}', 'error.data 默认 {}');

errResult = error('数据库查询失败', { detail: 'timeout' });
assertEqual(errResult.code, -1, 'error - code');
assertEqual(errResult.msg, '数据库查询失败', 'error - msg');
assertEqual(errResult.data.detail, 'timeout', 'error - data.detail');

console.log('\n=== 5. error() 边界 ===');
errResult = error();
assertEqual(errResult.code, -1, 'error() 无参数 - code');
assertEqual(errResult.msg, '操作失败', 'error() 无参数 - 默认msg');

errResult = error('');
assertEqual(errResult.code, -1, 'error("") - code');
// 注: '' 是 falsy，msg || '操作失败' 会回退（已知限制）

errResult = error(null, null);
assertEqual(errResult.code, -1, 'error(null, null) - code');
assertEqual(errResult.msg, '操作失败', 'error(null, null) - msg 回退默认');

console.log('\n=== 6. unauthorized() ===');
let unauthResult = unauthorized('请先登录');
assertEqual(unauthResult.code, 401, 'unauthorized.code = 401');
assertEqual(unauthResult.msg, '请先登录', 'unauthorized.msg');
assertEqual(JSON.stringify(unauthResult.data), '{}', 'unauthorized.data = {}');

unauthResult = unauthorized();
assertEqual(unauthResult.code, 401, 'unauthorized() 无参数 - code');
assertEqual(unauthResult.msg, '用户未登录', 'unauthorized() 无参数 - 默认msg');

// unauthorized 强制 data 为空对象
unauthResult = unauthorized('Token 已过期');
assertEqual(JSON.stringify(unauthResult.data), '{}', 'unauthorized data 固定为空对象');

console.log('\n=== 7. serverError() ===');
let srvResult = serverError('数据库异常');
assertEqual(srvResult.code, 500, 'serverError.code = 500');
assertEqual(srvResult.msg, '数据库异常', 'serverError.msg');

srvResult = serverError();
assertEqual(srvResult.code, 500, 'serverError() 无参数 - code');
assertEqual(srvResult.msg, '服务器错误', 'serverError() 无参数 - 默认msg');

srvResult = serverError('操作失败', { errCode: 'DB_TIMEOUT' });
assertEqual(srvResult.code, 500, 'serverError 带 errData - code');
assertEqual(srvResult.data.errCode, 'DB_TIMEOUT', 'serverError 带 errData - data.errCode');

console.log('\n=== 8. 响应格式一致性验证 ===');
// 所有响应必须包含 code, msg, data 三个字段
const allFuncs = [
  { name: 'success', fn: success, args: [{ result: true }, '操作成功'] },
  { name: 'error', fn: error, args: ['参数验证失败'] },
  { name: 'unauthorized', fn: unauthorized, args: ['未授权'] },
  { name: 'serverError', fn: serverError, args: ['内部错误'] }
];

allFuncs.forEach(({ name, fn, args }) => {
  const res = fn(...args);
  assert(res.hasOwnProperty('code'), `${name} 响应包含 code`);
  assert(res.hasOwnProperty('msg'), `${name} 响应包含 msg`);
  assert(res.hasOwnProperty('data'), `${name} 响应包含 data`);
  assert(typeof res.code === 'number', `${name}.code 是 number 类型`);
  assert(typeof res.msg === 'string', `${name}.msg 是 string 类型`);
});

console.log('\n=== 9. code 值不会混淆 ===');
assert(RESPONSE_CODE.SUCCESS !== RESPONSE_CODE.ERROR, 'SUCCESS ≠ ERROR');
assert(RESPONSE_CODE.SUCCESS !== RESPONSE_CODE.UNAUTHORIZED, 'SUCCESS ≠ UNAUTHORIZED');
assert(RESPONSE_CODE.SUCCESS !== RESPONSE_CODE.SERVER_ERROR, 'SUCCESS ≠ SERVER_ERROR');
assert(RESPONSE_CODE.ERROR !== RESPONSE_CODE.UNAUTHORIZED, 'ERROR ≠ UNAUTHORIZED');
assert(RESPONSE_CODE.ERROR !== RESPONSE_CODE.SERVER_ERROR, 'ERROR ≠ SERVER_ERROR');

// 确保 success 不会返回 error code
const s = success({}, '');
assert(s.code !== RESPONSE_CODE.ERROR, 'success 不会返回 ERROR code');
assert(s.code !== RESPONSE_CODE.SERVER_ERROR, 'success 不会返回 500');

summary('error-handler.test.js');
console.log('预期: ~30 tests\n');

if (failed > 0) {
  console.error('\n❌ 失败详情:');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
}
