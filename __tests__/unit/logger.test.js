/**
 * 日志模块 (common/logger.js) 单元测试
 * TDD: RED → GREEN → REFACTOR
 * 测试 createLogger、日志级别、脱敏函数
 */

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

// ===== 导入被测模块 =====
const { createLogger, LOG_LEVELS, sanitize } = require('../../cloudfunctions/common/logger');

// ========== 测试套件 ==========

console.log('\n=== 1. LOG_LEVELS 常量定义 ===');

(function testLogLevelConstants() {
  assertEqual(LOG_LEVELS.debug, 0, 'LOG_LEVELS.debug = 0');
  assertEqual(LOG_LEVELS.info, 1, 'LOG_LEVELS.info = 1');
  assertEqual(LOG_LEVELS.warn, 2, 'LOG_LEVELS.warn = 2');
  assertEqual(LOG_LEVELS.error, 3, 'LOG_LEVELS.error = 3');
  assertEqual(LOG_LEVELS.silent, 4, 'LOG_LEVELS.silent = 4');
})();

console.log('\n=== 2. createLogger 基础功能 ===');

(function testCreateLogger() {
  // 测试创建带前缀的 logger
  const logger1 = createLogger('testModule');
  assert(logger1 !== null && typeof logger1 === 'object', 'createLogger 返回对象');
  assert(typeof logger1.debug === 'function', 'logger.debug 是函数');
  assert(typeof logger1.info === 'function', 'logger.info 是函数');
  assert(typeof logger1.warn === 'function', 'logger.warn 是函数');
  assert(typeof logger1.error === 'function', 'logger.error 是函数');

  // 测试创建不带前缀的 logger
  const logger2 = createLogger();
  assert(logger2 !== null && typeof logger2 === 'object', 'createLogger() 无参数也能工作');
})();

console.log('\n=== 3. sanitize 原始值处理 ===');

(function testSanitizePrimitives() {
  // null 和 undefined
  assertEqual(sanitize(null), null, 'sanitize(null) 返回 null');
  assertEqual(sanitize(undefined), undefined, 'sanitize(undefined) 返回 undefined');

  // 字符串（非敏感字段）
  assertEqual(sanitize('hello'), 'hello', 'sanitize(普通字符串) 返回原值');
  assertEqual(sanitize(''), '', 'sanitize(空字符串) 返回空字符串');

  // 数字
  assertEqual(sanitize(123), 123, 'sanitize(数字) 返回原值');
  assertEqual(sanitize(0), 0, 'sanitize(0) 返回 0');
  assertEqual(sanitize(-1), -1, 'sanitize(负数) 返回原值');
  assertEqual(sanitize(3.14), 3.14, 'sanitize(小数) 返回原值');

  // 布尔值
  assertEqual(sanitize(true), true, 'sanitize(true) 返回 true');
  assertEqual(sanitize(false), false, 'sanitize(false) 返回 false');
})();

console.log('\n=== 4. sanitize 敏感字段脱敏 ===');

(function testSanitizeSensitiveFields() {
  // 测试所有敏感字段类型
  const testCases = [
    { key: 'openid', value: 'oxxxxxxxxxxxxxxxxxx' },
    { key: 'token', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' },
    { key: 'secret', value: 'sk-proj-xxxxx' },
    { key: 'password', value: 'MyPassword123' },
    { key: 'phone', value: '13800138000' },
    { key: 'apikey', value: 'ak-xxxxx' },
    { key: 'api_key', value: 'ak-xxxxx' },
    { key: 'adminsecret', value: 'admin_secret_key' }
  ];

  testCases.forEach(({ key, value }) => {
    const input = {};
    input[key] = value;
    const result = sanitize(input);

    assert(typeof result[key] === 'string', `${key} 脱敏后仍是字符串`);
    assert(result[key].includes('***'), `${key} 包含脱敏标记 ***`);

    // 值长度 > 4: 保留前4字符 + ***
    if (value.length > 4) {
      const expected = value.substring(0, 4) + '***';
      assertEqual(result[key], expected, `${key} 长度>4时截断（前4+***）`);
    } else {
      // 值长度 <= 4: 完整替换为 ***
      assertEqual(result[key], '***', `${key} 长度<=4时完整替换为 ***`);
    }
  });

  // 测试大小写不敏感（字段名大小写混合）
  const mixedCaseInput = {
    OpenId: 'oxxxxxxxxxxxxxxxxxx',
    TOKEN: 'Bearer xxx',
    ApiKey: 'ak-xxxxx',
    ADMIN_SECRET: 'admin_secret'
  };
  const mixedCaseResult = sanitize(mixedCaseInput);

  assert(mixedCaseResult.OpenId.includes('***'), 'OpenId 被脱敏');
  assert(mixedCaseResult.TOKEN.includes('***'), 'TOKEN 被脱敏');
  assert(mixedCaseResult.ApiKey.includes('***'), 'ApiKey 被脱敏');
  assert(mixedCaseResult.ADMIN_SECRET.includes('***'), 'ADMIN_SECRET 被脱敏');
})();

console.log('\n=== 5. sanitize 敏感字段边界条件 ===');

(function testSanitizeSensitiveBoundaries() {
  // 长度 = 4 的边界情况
  const length4Input = { password: '1234' };
  const length4Result = sanitize(length4Input);
  assertEqual(length4Result.password, '***', 'password 长度=4 时完整替换为 ***');

  // 长度 = 5 的边界情况（刚好保留1个字符 + ***）
  const length5Input = { password: '12345' };
  const length5Result = sanitize(length5Input);
  assertEqual(length5Result.password, '1234***', 'password 长度=5 时保留前4字符 + ***');

  // 空字符串
  const emptyInput = { password: '' };
  const emptyResult = sanitize(emptyInput);
  assertEqual(emptyResult.password, '***', 'password 为空字符串时替换为 ***');

  // 非字符串类型的敏感字段（如数字）
  const numberInput = { phone: 13800138000 };
  const numberResult = sanitize(numberInput);
  assertEqual(numberResult.phone, '***', 'phone 为数字时替换为 ***');

  // null 值的敏感字段
  const nullInput = { token: null };
  const nullResult = sanitize(nullInput);
  assertEqual(nullResult.token, '***', 'token 为 null 时替换为 ***');
})();

console.log('\n=== 6. sanitize 非敏感字段不脱敏 ===');

(function testSanitizeNonSensitiveFields() {
  const input = {
    userId: 'user_12345',
    orderId: 'order_67890',
    amount: 100,
    status: 'success',
    message: 'Payment completed'
  };
  const result = sanitize(input);

  assertEqual(result.userId, 'user_12345', 'userId 非敏感字段不变');
  assertEqual(result.orderId, 'order_67890', 'orderId 非敏感字段不变');
  assertEqual(result.amount, 100, 'amount 数字不变');
  assertEqual(result.status, 'success', 'status 字符串不变');
  assertEqual(result.message, 'Payment completed', 'message 字符串不变');
})();

console.log('\n=== 7. sanitize 数组处理 ===');

(function testSanitizeArray() {
  // 简单数组
  const simpleArray = [1, 2, 3, 'a', 'b'];
  const simpleResult = sanitize(simpleArray);
  assertEqual(simpleResult, simpleArray, '纯数字/字符串数组保持不变');

  // 包含敏感对象的数组
  const objectArray = [
    { name: 'Item 1', token: 'token_1' },
    { name: 'Item 2', token: 'token_2' }
  ];
  const objectResult = sanitize(objectArray);

  assertEqual(objectResult[0].name, 'Item 1', '数组[0].name 非敏感字段不变');
  assert(objectResult[0].token.includes('***'), '数组[0].token 被脱敏');
  assertEqual(objectResult[1].name, 'Item 2', '数组[1].name 非敏感字段不变');
  assert(objectResult[1].token.includes('***'), '数组[1].token 被脱敏');

  // 嵌套数组
  const nestedArray = [[1, 2], [3, 4]];
  const nestedResult = sanitize(nestedArray);
  assertEqual(nestedResult, nestedArray, '嵌套数组保持不变');
})();

console.log('\n=== 8. sanitize 嵌套对象处理 ===');

(function testSanitizeNestedObjects() {
  // 深层嵌套对象
  const nested = {
    level1: {
      level2: {
        level3: {
          openid: 'deep_openid',
          normalField: 'normal_value'
        }
      }
    }
  };
  const result = sanitize(nested);

  assert(result.level1.level2.level3.openid.includes('***'), '深层嵌套的 openid 被脱敏');
  assertEqual(result.level1.level2.level3.normalField, 'normal_value', '深层嵌套的非敏感字段不变');

  // 混合嵌套（对象 + 数组）
  const complex = {
    data: {
      users: [
        { id: 'user1', token: 'token_a' },
        { id: 'user2', token: 'token_b' }
      ],
      config: {
        apiKey: 'key_xyz',
        timeout: 5000
      }
    }
  };
  const complexResult = sanitize(complex);

  assertEqual(complexResult.data.users[0].id, 'user1', '嵌套数组中非敏感字段不变');
  assert(complexResult.data.users[0].token.includes('***'), '嵌套数组中敏感字段被脱敏');
  assert(complexResult.data.config.apiKey.includes('***'), '深层对象中敏感字段被脱敏');
  assertEqual(complexResult.data.config.timeout, 5000, '深层对象中数字不变');
})();

console.log('\n=== 9. sanitize Error 对象处理 ===');

(function testSanitizeErrorObject() {
  // Error 对象应保持不变（提取 message）
  const error = new Error('Test error message');
  const result = sanitize(error);

  assert(typeof result === 'string', 'Error 对象被转换为字符串');
  assert(result.includes('Test error message'), 'Error 对象保留 message 内容');

  // 嵌套在对象中的 Error
  const errorInObj = {
    success: false,
    error: error,
    data: { openid: 'xxx' }
  };
  const errorObjResult = sanitize(errorInObj);

  assert(typeof errorObjResult.error === 'string', '对象中的 Error 被转换为字符串');
  assert(errorObjResult.error.includes('Test error message'), '对象中的 Error 保留 message');
  assert(errorObjResult.data.openid.includes('***'), '对象中的敏感字段仍被脱敏');

  // 无 message 的 Error
  const noMessageError = new Error();
  const noMessageResult = sanitize(noMessageError);
  assert(typeof noMessageResult === 'string', '无 message 的 Error 也被转换为字符串');
})();

console.log('\n=== 10. 日志级别控制（debug 模式） ===');

(function testLogLevelDebug() {
  // 保存原始环境变量
  const originalLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'debug';

  const logger = createLogger('TEST');

  // debug 模式：所有级别都应该输出
  // 由于我们无法直接测试 console 输出，我们至少验证函数不会抛出异常
  try {
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    assert(true, 'debug 模式：所有日志级别调用不抛出异常');
  } catch (e) {
    assert(false, `debug 模式日志调用抛出异常: ${e.message}`);
  }

  // 恢复原始环境变量
  if (originalLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLevel;
  }
})();

console.log('\n=== 11. 日志级别控制（info 模式） ===');

(function testLogLevelInfo() {
  const originalLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'info';

  const logger = createLogger('TEST');

  try {
    logger.debug('debug message');  // 不应该输出
    logger.info('info message');    // 应该输出
    logger.warn('warn message');    // 应该输出
    logger.error('error message');  // 应该输出
    assert(true, 'info 模式：所有日志级别调用不抛出异常');
  } catch (e) {
    assert(false, `info 模式日志调用抛出异常: ${e.message}`);
  }

  if (originalLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLevel;
  }
})();

console.log('\n=== 12. 日志级别控制（warn 模式） ===');

(function testLogLevelWarn() {
  const originalLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'warn';

  const logger = createLogger('TEST');

  try {
    logger.debug('debug message');  // 不应该输出
    logger.info('info message');    // 不应该输出
    logger.warn('warn message');    // 应该输出
    logger.error('error message');  // 应该输出
    assert(true, 'warn 模式：所有日志级别调用不抛出异常');
  } catch (e) {
    assert(false, `warn 模式日志调用抛出异常: ${e.message}`);
  }

  if (originalLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLevel;
  }
})();

console.log('\n=== 13. 日志级别控制（error 模式） ===');

(function testLogLevelError() {
  const originalLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'error';

  const logger = createLogger('TEST');

  try {
    logger.debug('debug message');  // 不应该输出
    logger.info('info message');    // 不应该输出
    logger.warn('warn message');    // 不应该输出
    logger.error('error message');  // 应该输出
    assert(true, 'error 模式：所有日志级别调用不抛出异常');
  } catch (e) {
    assert(false, `error 模式日志调用抛出异常: ${e.message}`);
  }

  if (originalLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLevel;
  }
})();

console.log('\n=== 14. 日志级别控制（silent 模式） ===');

(function testLogLevelSilent() {
  const originalLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'silent';

  const logger = createLogger('TEST');

  try {
    logger.debug('debug message');  // 不应该输出
    logger.info('info message');    // 不应该输出
    logger.warn('warn message');    // 不应该输出
    logger.error('error message');  // error 级别总是输出（无级别检查）
    assert(true, 'silent 模式：所有日志级别调用不抛出异常');
  } catch (e) {
    assert(false, `silent 模式日志调用抛出异常: ${e.message}`);
  }

  if (originalLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLevel;
  }
})();

console.log('\n=== 15. 日志级别控制（无效级别默认 debug） ===');

(function testLogLevelInvalid() {
  const originalLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'invalid_level';

  const logger = createLogger('TEST');

  // 无效级别应回退到 debug（所有级别都输出）
  try {
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    assert(true, '无效级别回退到 debug：所有日志级别调用不抛出异常');
  } catch (e) {
    assert(false, `无效级别日志调用抛出异常: ${e.message}`);
  }

  if (originalLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLevel;
  }
})();

console.log('\n=== 16. 日志脱敏集成测试 ===');

(function testLoggerSanitizationIntegration() {
  const originalLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'info';

  const logger = createLogger('INTEGRATION');

  try {
    // 测试日志方法会自动脱敏
    logger.info('User login', {
      openid: 'oxxxxxxxxxxxxxxxxxx',
      username: 'testuser',
      token: 'Bearer secret_token'
    });

    logger.warn('Sensitive operation', {
      password: 'user_password',
      action: 'delete',
      apikey: 'ak-12345'
    });

    logger.error('Auth failed', {
      secret: 'top_secret',
      reason: 'invalid_credentials',
      phone: '13800138000'
    });

    assert(true, '日志方法自动脱敏不抛出异常');
  } catch (e) {
    assert(false, `日志脱敏集成测试抛出异常: ${e.message}`);
  }

  if (originalLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLevel;
  }
})();

console.log('\n=== 17. 边界情况：复杂对象结构 ===');

(function testSanitizeEdgeCases() {
  // 空对象
  const emptyObj = {};
  const emptyObjResult = sanitize(emptyObj);
  assertEqual(emptyObjResult, {}, '空对象保持不变');

  // 包含多种类型的混合对象
  const mixedObj = {
    stringField: 'normal_string',
    numberField: 12345,
    boolField: true,
    nullField: null,
    undefinedField: undefined,
    arrayField: [1, 2, 3],
    objectField: { nested: 'value' },
    // 只有包含敏感关键字的字段才会被脱敏
    userSecret: 'secret_value',
    emptyToken: '',
    shortKey: 'ab',
    longApiKey: 'long_secret_value'
  };
  const mixedResult = sanitize(mixedObj);

  assertEqual(mixedResult.stringField, 'normal_string', '字符串字段不变');
  assertEqual(mixedResult.numberField, 12345, '数字字段不变');
  assertEqual(mixedResult.boolField, true, '布尔字段不变');
  assertEqual(mixedResult.nullField, null, 'null 字段不变');
  assertEqual(mixedResult.undefinedField, undefined, 'undefined 字段不变');
  assertEqual(mixedResult.arrayField, [1, 2, 3], '数组字段不变');
  assertEqual(mixedResult.objectField, { nested: 'value' }, '嵌套对象不变');
  assert(mixedResult.userSecret.includes('***'), '包含secret关键字的字段被脱敏');
  assertEqual(mixedResult.emptyToken, '***', '空敏感字段替换为 ***');
  assertEqual(mixedResult.shortKey, 'ab', '非敏感字段保持不变');
  assert(mixedResult.longApiKey.includes('***'), '包含apikey关键字的字段被截断脱敏');
})();

console.log('\n=== 18. 性能测试：大对象脱敏 ===');

(function testSanitizeLargeObject() {
  // 创建包含1000个字段的大对象
  const largeObj = {};
  for (let i = 0; i < 1000; i++) {
    largeObj[`field${i}`] = i % 10 === 0 ? `sensitive_${i}` : `normal_${i}`;
  }

  try {
    const result = sanitize(largeObj);
    assert(result !== null, '大对象脱敏不返回 null');
    assert(Object.keys(result).length === 1000, '大对象脱敏后字段数量不变');
    assert(true, '大对象脱敏不抛出异常');
  } catch (e) {
    assert(false, `大对象脱敏抛出异常: ${e.message}`);
  }

  // 创建深层嵌套对象（100层）
  let deepObj = { value: 'root' };
  let current = deepObj;
  for (let i = 0; i < 100; i++) {
    current.nested = { level: i, value: `level_${i}` };
    current = current.nested;
  }

  try {
    const deepResult = sanitize(deepObj);
    assert(deepResult !== null, '深层嵌套对象脱敏不返回 null');
    assert(true, '深层嵌套对象脱敏不抛出异常');
  } catch (e) {
    assert(false, `深层嵌套对象脱敏抛出异常: ${e.message}`);
  }
})();

console.log('\n=== 19. 特殊字符和 Unicode ===');

(function testSanitizeSpecialChars() {
  const specialObj = {
    emoji: '测试表情 😀🎉',
    unicode: '中文测试',
    mixed: 'Mixed with 中文 and 🎉',
    url: 'https://example.com?param=value',
    json: '{"key":"value"}',
    openid: 'o中文🎉xxx'
  };

  const result = sanitize(specialObj);

  assertEqual(result.emoji, '测试表情 😀🎉', 'Emoji 字段不变');
  assertEqual(result.unicode, '中文测试', '中文字段不变');
  assertEqual(result.mixed, 'Mixed with 中文 and 🎉', '混合字段不变');
  assertEqual(result.url, 'https://example.com?param=value', 'URL 字段不变');
  assertEqual(result.json, '{"key":"value"}', 'JSON 字符串字段不变');
  assert(result.openid.includes('***'), '包含特殊字符的 openid 被脱敏');
})();

console.log('\n=== 20. Error 级别日志不脱敏 Error 对象 ===');

(function testErrorLevelPreservesError() {
  const originalLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'error';

  const logger = createLogger('ERROR_TEST');

  try {
    const error = new Error('Test error stack');
    // error 级别应保留 Error 对象的堆栈信息
    logger.error('Operation failed', error);
    assert(true, 'error 级别保留 Error 对象不抛出异常');
  } catch (e) {
    assert(false, `error 级别处理抛出异常: ${e.message}`);
  }

  if (originalLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLevel;
  }
})();

// ========== 测试摘要 ==========

summary('logger.test.js');
console.log('预期: 100+ tests\n');

if (failed > 0) {
  console.error('\n❌ 失败详情:');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('\n✅ 所有测试通过！');
}
