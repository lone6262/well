/**
 * 报告模板引擎 (common/report-engine.js) 单元测试
 * TDD: RED → GREEN → REFACTOR
 * 测试 generateCacheKey, getAgeRange, fillTemplate 三个纯逻辑函数
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

// ===== 被测代码（从 report-engine.js 提取纯逻辑） =====
const AGE_THRESHOLD = { KITTEN: 2, SENIOR_CAT: 144, SENIOR_DOG: 120 };
const AGE_RANGES = { YOUNG: 'young', ADULT: 'adult', SENIOR: 'senior' };

function generateCacheKey(symptomIds, petType, ageRange) {
  if (!Array.isArray(symptomIds) || symptomIds.length === 0) {
    throw new Error('symptomIds must be a non-empty array');
  }
  if (!petType || !ageRange) {
    throw new Error('petType and ageRange are required');
  }
  const sorted = [...symptomIds].sort();
  const raw = sorted.join(',') + ':' + petType + ':' + ageRange;
  return crypto.createHash('md5').update(raw, 'utf8').digest('hex');
}

function getAgeRange(ageMonths, petType) {
  if (typeof ageMonths !== 'number' || ageMonths < 0) {
    return AGE_RANGES.ADULT;
  }
  if (ageMonths < AGE_THRESHOLD.KITTEN) {
    return AGE_RANGES.YOUNG;
  }
  const seniorThreshold = petType === 'dog' ? AGE_THRESHOLD.SENIOR_DOG : AGE_THRESHOLD.SENIOR_CAT;
  if (ageMonths > seniorThreshold) {
    return AGE_RANGES.SENIOR;
  }
  return AGE_RANGES.ADULT;
}

function fillTemplate(obj, variables) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match;
    });
  }
  if (Array.isArray(obj)) {
    return obj.map(item => fillTemplate(item, variables));
  }
  if (typeof obj === 'object') {
    const result = {};
    Object.keys(obj).forEach(key => { result[key] = fillTemplate(obj[key], variables); });
    return result;
  }
  return obj;
}

// ========== 1. generateCacheKey 测试 ==========
console.log('\n=== 1. generateCacheKey ===');

let key1 = generateCacheKey(['vomit', 'diarrhea', 'fever'], 'cat', 'adult');
assert(typeof key1 === 'string', 'cacheKey 是字符串');
assert(key1.length === 32, 'MD5 hex 长度为 32');

// 确定性: 相同输入 → 相同 key
let key2 = generateCacheKey(['vomit', 'diarrhea', 'fever'], 'cat', 'adult');
assertEqual(key1, key2, '相同输入产生相同 key（确定性）');

// 不同症状 → 不同 key
let key3 = generateCacheKey(['cough', 'sneeze'], 'cat', 'adult');
assert(key1 !== key3, '不同症状 ID 产生不同 key');

// 不同 petType → 不同 key
let key4 = generateCacheKey(['vomit', 'diarrhea', 'fever'], 'dog', 'adult');
assert(key1 !== key4, '不同 petType 产生不同 key');

// 不同 ageRange → 不同 key
let key5 = generateCacheKey(['vomit', 'diarrhea', 'fever'], 'cat', 'senior');
assert(key1 !== key5, '不同 ageRange 产生不同 key');

// 症状顺序无关（自动排序）
let key6 = generateCacheKey(['fever', 'vomit', 'diarrhea'], 'cat', 'adult');
assertEqual(key1, key6, '症状顺序不同但集合相同 → 相同 key');

// 单个症状
let key7 = generateCacheKey(['seizure'], 'dog', 'young');
assert(typeof key7 === 'string', '单个症状也能生成 key');
assert(key7.length === 32, '单症状 key 长度 32');

console.log('\n=== 2. generateCacheKey 错误处理 ===');

try { generateCacheKey([], 'cat', 'adult'); assert(false, '空数组应抛异常'); }
catch (e) { assert(e.message.includes('non-empty'), '空数组异常消息正确'); }

try { generateCacheKey(null, 'cat', 'adult'); assert(false, 'null 应抛异常'); }
catch (e) { assert(e.message.includes('non-empty'), 'null 异常消息正确'); }

try { generateCacheKey(['vomit'], '', 'adult'); assert(false, '空 petType 应抛异常'); }
catch (e) { assert(e.message.includes('required'), '空 petType 异常消息正确'); }

try { generateCacheKey(['vomit'], 'cat', ''); assert(false, '空 ageRange 应抛异常'); }
catch (e) { assert(e.message.includes('required'), '空 ageRange 异常消息正确'); }

try { generateCacheKey('not_an_array', 'cat', 'adult'); assert(false, '非数组应抛异常'); }
catch (e) { assert(true, '非数组正确抛异常'); }

console.log('\n=== 3. getAgeRange ===');

// 猫的年龄分段
assertEqual(getAgeRange(0, 'cat'), 'young', '猫 0个月 → young');
assertEqual(getAgeRange(1, 'cat'), 'young', '猫 1个月 → young');
assertEqual(getAgeRange(2, 'cat'), 'adult', '猫 2个月 → adult（等于阈值）');
assertEqual(getAgeRange(12, 'cat'), 'adult', '猫 12个月 → adult');
assertEqual(getAgeRange(60, 'cat'), 'adult', '猫 5岁 → adult');
assertEqual(getAgeRange(144, 'cat'), 'adult', '猫 144个月（=阈值）→ adult');
assertEqual(getAgeRange(145, 'cat'), 'senior', '猫 145个月（>12年）→ senior');
assertEqual(getAgeRange(200, 'cat'), 'senior', '猫 200个月 → senior');

// 狗的年龄分段
assertEqual(getAgeRange(0, 'dog'), 'young', '狗 0个月 → young');
assertEqual(getAgeRange(1, 'dog'), 'young', '狗 1个月 → young');
assertEqual(getAgeRange(2, 'dog'), 'adult', '狗 2个月 → adult');
assertEqual(getAgeRange(120, 'dog'), 'adult', '狗 120个月（=阈值）→ adult');
assertEqual(getAgeRange(121, 'dog'), 'senior', '狗 121个月（>10年）→ senior');
assertEqual(getAgeRange(180, 'dog'), 'senior', '狗 180个月 → senior');

// 猫狗老年阈值不同
assertEqual(getAgeRange(130, 'cat'), 'adult', '130个月 猫 → adult（猫12年=144）');
assertEqual(getAgeRange(130, 'dog'), 'senior', '130个月 狗 → senior（狗10年=120）');

console.log('\n=== 4. getAgeRange 边界 ===');

assertEqual(getAgeRange(-1, 'cat'), 'adult', '负数月龄 → adult（安全默认）');
assertEqual(getAgeRange(-100, 'dog'), 'adult', '大负数 → adult');
assertEqual(getAgeRange(null, 'cat'), 'adult', 'null → adult');
assertEqual(getAgeRange(undefined, 'dog'), 'adult', 'undefined → adult');
assertEqual(getAgeRange('12', 'cat'), 'adult', '字符串 → adult（非number）');
assertEqual(getAgeRange(NaN, 'cat'), 'adult', 'NaN → adult');
assertEqual(getAgeRange(Infinity, 'dog'), 'senior', 'Infinity > 阈值 → senior');

// petType 对其他宠物类型
assertEqual(getAgeRange(36, 'rabbit'), 'adult', '未知宠物类型 → adult（按猫阈值）');
assertEqual(getAgeRange(145, 'rabbit'), 'senior', '未知宠物类型高龄 → senior（按猫阈值）');

console.log('\n=== 5. fillTemplate 基础替换 ===');

const template1 = '{{pet_name}}是一只{{pet_type_name}}，症状包括{{symptom_name}}。';
const vars1 = { pet_name: '小白', pet_type_name: '猫咪', symptom_name: '呕吐、腹泻' };
const filled1 = fillTemplate(template1, vars1);
assertEqual(filled1, '小白是一只猫咪，症状包括呕吐、腹泻。', '基础模板替换');

// 无占位符的字符串
assertEqual(fillTemplate('普通文本', vars1), '普通文本', '无占位符文本原样返回');
assertEqual(fillTemplate('', vars1), '', '空字符串返回空');

console.log('\n=== 6. fillTemplate 对象和数组 ===');

const templateObj = {
  title: '{{pet_name}}的健康报告',
  sections: [
    { name: '概述', content: '{{pet_name}}总体状况{{assessment}}' },
    { name: '建议', items: ['{{advice_1}}', '{{advice_2}}'] }
  ]
};
const vars2 = { pet_name: '旺财', assessment: '良好', advice_1: '多喝水', advice_2: '定期检查' };

const filledObj = fillTemplate(templateObj, vars2);

assertEqual(filledObj.title, '旺财的健康报告', '对象 - title 替换');
assertEqual(filledObj.sections[0].content, '旺财总体状况良好', '嵌套对象 - content 替换');
assertEqual(filledObj.sections[1].items[0], '多喝水', '数组 - advice_1 替换');
assertEqual(filledObj.sections[1].items[1], '定期检查', '数组 - advice_2 替换');

// 原模板对象不应被修改
assertEqual(templateObj.title, '{{pet_name}}的健康报告', '原模板对象未被修改（不变性）');

console.log('\n=== 7. fillTemplate 未匹配变量保留 ===');

const template2 = '{{known}} + {{unknown}}';
assertEqual(fillTemplate(template2, { known: '已知' }), '已知 + {{unknown}}', '未匹配占位符保留原样');

const template3 = '{{a}}{{b}}{{c}}';
assertEqual(fillTemplate(template3, { a: '1', c: '3' }), '1{{b}}3', '部分匹配保留未匹配项');

console.log('\n=== 8. fillTemplate 特殊值和类型 ===');

// null/undefined 原样返回
assertEqual(fillTemplate(null, vars1), null, 'null 返回 null');
assertEqual(fillTemplate(undefined, vars1), undefined, 'undefined 返回 undefined');

// 数字不变
assertEqual(fillTemplate(42, vars1), 42, '数字原样返回');
assertEqual(fillTemplate(0, vars1), 0, '0 原样返回');

// 布尔不变
assertEqual(fillTemplate(true, vars1), true, 'true 原样返回');
assertEqual(fillTemplate(false, vars1), false, 'false 原样返回');

// 变量值为非字符串（自动转字符串）
const varsNum = { count: 10, price: 9.99, isVip: true };
assertEqual(fillTemplate('{{count}}次', varsNum), '10次', '数字变量自动转字符串');
assertEqual(fillTemplate('{{price}}元', varsNum), '9.99元', '浮点变量自动转字符串');
assertEqual(fillTemplate('{{isVip}}', varsNum), 'true', '布尔变量自动转字符串');

console.log('\n=== 9. fillTemplate 深层嵌套不变性 ===');

const deepObj = { level1: { level2: { text: '{{greeting}}' } } };
const filledDeep = fillTemplate(deepObj, { greeting: '你好' });
assertEqual(deepObj.level1.level2.text, '{{greeting}}', '深层嵌套原对象未修改');
assertEqual(filledDeep.level1.level2.text, '你好', '深层嵌套新对象已替换');

summary('report-engine.test.js');
console.log('预期: ~35 tests\n');

if (failed > 0) {
  console.error('\n❌ 失败详情:');
  errors.forEach(e => console.error(`  ${e}`));
  process.exit(1);
}
