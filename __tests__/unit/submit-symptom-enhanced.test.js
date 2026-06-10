/**
 * submitSymptom 云函数增强测试 - V1.5 新功能
 * TDD: RED → GREEN → REFACTOR
 *
 * 测试覆盖：
 * 1. evaluateRisk 规则引擎（策略模式）
 * 2. VALID_SYMPTOM_SET 白名单校验
 * 3. 敏感词检查（医疗 + 有害内容）
 * 4. 描述长度限制
 */

// ===== 测试框架 =====
let passed = 0, failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    errors.push(`FAIL: ${message}`);
    console.error(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    const msg = `${message} - 期望: ${JSON.stringify(expected)}, 实际: ${JSON.stringify(actual)}`;
    errors.push(`FAIL: ${msg}`);
    console.error(`  ✗ ${msg}`);
  }
}

function assertNotEqual(actual, unexpected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(unexpected)) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    const msg = `${message} - 不应等于: ${JSON.stringify(unexpected)}, 实际: ${JSON.stringify(actual)}`;
    errors.push(`FAIL: ${msg}`);
    console.error(`  ✗ ${msg}`);
  }
}

function summary(name) {
  const total = passed + failed;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${name}: ${passed}/${total} 通过, ${failed} 失败`);
  if (failed > 0) {
    console.log('\n失败详情:');
    errors.forEach(err => console.error(`  ${err}`));
  }
  return failed === 0;
}

// ===== 被测代码（从 submitSymptom/index.js 提取纯逻辑） =====

// 高风险症状ID列表（熔断词表）
const HIGH_RISK_SYMPTOMS = [
  'seizure',           // 抽搐
  'coma',             // 昏迷
  'dyspnea',          // 呼吸困难
  'bleeding',         // 持续出血
  'hematuria',        // 尿血
  'paralysis',        // 瘫痪
  'collapse',         // 虚脱
  'cyanosis'          // 发绀
];

// 中风险关键词（用于描述文本分析）
const MID_RISK_KEYWORDS = [
  '反复', '持续', '加重', '多次', '不断',
  '频繁', '越来越', '恶化', '未见好转', '超过'
];

// 敏感词表（医疗 + 有害内容）
const MEDICAL_SENSITIVE_WORDS = [
  '激素', '抗生素', '处方药', '剧毒', '致命',
  '癌症', '肿瘤', '安乐死', '人药', '自行用药',
  '自己开药', '自己打针', '毒药', '老鼠药', '禁用药物'
];
const HARMFUL_CONTENT_KEYWORDS = [
  '赌博', '赌场', '博彩', '诈骗', '传销',
  '色情', '毒品', '枪支', '暴力'
];
const ALL_SENSITIVE_WORDS = MEDICAL_SENSITIVE_WORDS.concat(HARMFUL_CONTENT_KEYWORDS);

// 特定症状组（用于中风险判断）
const SPECIFIC_SYMPTOMS = {
  VOMIT_GROUP: ['vomit', 'diarrhea', 'fever'],  // 呕吐、腹泻、发热
  LETHARGY: 'lethargy'  // 精神萎靡
};

// 高风险症状中文名称映射
const HIGH_RISK_NAMES = {
  'seizure': '抽搐', 'coma': '昏迷', 'dyspnea': '呼吸困难',
  'bleeding': '持续出血', 'hematuria': '尿血', 'paralysis': '瘫痪',
  'collapse': '虚脱', 'cyanosis': '发绀'
};

// 规则数组：按优先级从高到低排列，首个匹配的规则决定风险等级
const RISK_RULES = [
  // 高风险：熔断词
  {
    name: 'high-risk-circuit-breaker',
    test: function(ids) { return ids.some(function(id) { return HIGH_RISK_SYMPTOMS.includes(id); }); },
    result: function(ids) {
      var matched = ids.find(function(id) { return HIGH_RISK_SYMPTOMS.includes(id); });
      return {
        riskLevel: 'high',
        advice: '高风险，建议立即就医！请勿拖延，尽快前往最近的宠物医院。',
        action: 'emergency',
        matchedRule: '检测到高风险症状：' + (HIGH_RISK_NAMES[matched] || '高风险症状')
      };
    }
  },
  // 中风险R1: 症状≥3且包含呕吐/腹泻/发热
  {
    name: 'mid-R1-specific-symptoms',
    test: function(ids) {
      return ids.length >= 3 && ids.some(function(id) { return SPECIFIC_SYMPTOMS.VOMIT_GROUP.includes(id); });
    },
    result: function() {
      return { riskLevel: 'mid', advice: '中风险，建议24小时内就医观察。请记录症状变化，必要时拍照留存。', action: 'hospital_list', matchedRule: '中风险：症状数量≥3且包含呕吐/腹泻/发热' };
    }
  },
  // 中风险R2: 症状≥3且描述含关键词
  {
    name: 'mid-R2-keywords',
    test: function(ids, desc) {
      return ids.length >= 3 && MID_RISK_KEYWORDS.some(function(kw) { return desc.includes(kw); });
    },
    result: function() {
      return { riskLevel: 'mid', advice: '中风险，建议24小时内就医观察。请记录症状变化，必要时拍照留存。', action: 'hospital_list', matchedRule: '中风险：症状数量≥3且描述包含反复/持续/加重等关键词' };
    }
  },
  // 中风险R3: 症状≥4
  {
    name: 'mid-R3-multi-system',
    test: function(ids) { return ids.length >= 4; },
    result: function() {
      return { riskLevel: 'mid', advice: '中风险，建议24小时内就医观察。请记录症状变化，必要时拍照留存。', action: 'hospital_list', matchedRule: '中风险：症状数量≥4（多系统症状）' };
    }
  },
  // 中风险R4: 精神萎靡+任意其他症状
  {
    name: 'mid-R4-lethargy',
    test: function(ids) {
      return ids.includes(SPECIFIC_SYMPTOMS.LETHARGY) && ids.length >= 2;
    },
    result: function() {
      return { riskLevel: 'mid', advice: '中风险，建议24小时内就医观察。请记录症状变化，必要时拍照留存。', action: 'hospital_list', matchedRule: '中风险：精神萎靡+其他症状（可能状况不佳）' };
    }
  }
];

/**
 * 规则引擎 - 策略模式
 * 按优先级遍历规则数组，首个匹配的规则决定风险等级，无匹配则默认低风险
 */
function evaluateRisk(symptomIds, description) {
  description = description || '';
  var symptomCount = symptomIds.length;

  // 遍历规则数组，首个匹配即返回
  for (var i = 0; i < RISK_RULES.length; i++) {
    var rule = RISK_RULES[i];
    if (rule.test(symptomIds, description)) {
      return rule.result(symptomIds);
    }
  }

  // 默认低风险
  var symptomText = symptomCount === 1 ? '单个症状' : symptomCount + '个轻微症状';
  return {
    riskLevel: 'low',
    advice: '低风险，建议继续观察。保持正常饮食饮水，记录症状变化。如症状持续或加重，请及时就医。',
    action: 'home',
    matchedRule: '低风险：' + symptomText + '未达到中高风险标准'
  };
}

/**
 * 白名单校验函数（模拟云函数中的逻辑）
 */
function validateSymptomIds(symptomIds, validSet) {
  var invalidIds = symptomIds.filter(function(id) { return !validSet.has(id); });
  return {
    valid: invalidIds.length === 0,
    invalidIds: invalidIds
  };
}

/**
 * 敏感词检查函数（模拟云函数中的逻辑）
 */
function checkSensitiveWords(description, sensitiveWords) {
  if (!description || description.length === 0) {
    return { hasSensitive: false, matchedWord: null };
  }

  var matchedWord = null;
  var hasSensitive = sensitiveWords.some(function(word) {
    if (description.indexOf(word) !== -1) {
      matchedWord = word;
      return true;
    }
    return false;
  });

  return { hasSensitive: hasSensitive, matchedWord: matchedWord };
}

/**
 * 描述长度校验函数（模拟云函数中的逻辑）
 */
function validateDescriptionLength(description, maxLength) {
  if (!description) {
    return { valid: true, length: 0 };
  }

  var length = description.length;
  return {
    valid: length <= maxLength,
    length: length,
    maxLength: maxLength
  };
}

// 合法症状ID白名单（从 constants.js 复制）
const VALID_SYMPTOM_IDS = [
  // 消化系统
  'vomit', 'diarrhea', 'constipation', 'loss_appetite',
  // 呼吸系统
  'cough', 'sneeze', 'dyspnea',
  // 泌尿系统
  'frequent_urination', 'hematuria', 'difficulty_urination',
  // 皮肤/被毛
  'itch', 'hair_loss', 'redness',
  // 眼部
  'tearing', 'eye_redness',
  // 耳部
  'ear_odor', 'head_shake',
  // 神经/行为
  'seizure', 'lethargy',
  // 口腔
  'drool', 'gum_redness',
  // 高风险熔断词
  'coma', 'bleeding', 'paralysis', 'collapse', 'cyanosis',
  // 特定症状组（用于中风险判断）
  'fever'  // 发热（属于SPECIFIC_SYMPTOMS.VOMIT_GROUP）
];

const VALID_SYMPTOM_SET = new Set(VALID_SYMPTOM_IDS);

// ========== 1. evaluateRisk 规则引擎测试 ==========

console.log('\n=== 1. evaluateRisk 规则引擎测试 ===');

// 1.1 高风险熔断词测试
console.log('\n--- 1.1 高风险熔断词测试 ---');

var highRiskTests = [
  { ids: ['seizure'], expectedName: '抽搐' },
  { ids: ['coma'], expectedName: '昏迷' },
  { ids: ['dyspnea'], expectedName: '呼吸困难' },
  { ids: ['bleeding'], expectedName: '持续出血' },
  { ids: ['hematuria'], expectedName: '尿血' },
  { ids: ['paralysis'], expectedName: '瘫痪' },
  { ids: ['collapse'], expectedName: '虚脱' },
  { ids: ['cyanosis'], expectedName: '发绀' }
];

highRiskTests.forEach(function(testCase) {
  var result = evaluateRisk(testCase.ids, '');
  assertEqual(result.riskLevel, 'high', `${testCase.ids[0]} → 高风险`);
  assertEqual(result.action, 'emergency', `${testCase.ids[0]} → action=emergency`);
  assert(result.matchedRule.indexOf(testCase.expectedName) !== -1, `${testCase.ids[0]} → 规则名称包含"${testCase.expectedName}"`);
});

// 高风险 + 其他症状混合
var mixResult = evaluateRisk(['vomit', 'seizure', 'diarrhea'], '');
assertEqual(mixResult.riskLevel, 'high', '混合症状包含高风险 → 高风险优先');
assertEqual(mixResult.action, 'emergency', '混合症状 → emergency');

// 1.2 中风险R1测试：症状≥3且包含呕吐/腹泻/发热
console.log('\n--- 1.2 中风险R1测试（≥3症状 + 呕吐/腹泻/发热） ---');

var midR1Tests = [
  { ids: ['vomit', 'diarrhea', 'fever'], desc: '' },
  { ids: ['vomit', 'cough', 'sneeze'], desc: '' },
  { ids: ['diarrhea', 'itch', 'hair_loss'], desc: '' },
  { ids: ['fever', 'lethargy', 'vomit'], desc: '' }
];

midR1Tests.forEach(function(testCase) {
  var result = evaluateRisk(testCase.ids, testCase.desc);
  assertEqual(result.riskLevel, 'mid', `症状${testCase.ids.length}个含特定症状 → 中风险`);
  assertEqual(result.action, 'hospital_list', '中风险 → hospital_list');
  assert(result.matchedRule.indexOf('呕吐/腹泻/发热') !== -1, '规则名称包含"呕吐/腹泻/发热"');
});

// 1.3 中风险R2测试：症状≥3且描述含关键词
console.log('\n--- 1.3 中风险R2测试（≥3症状 + 关键词） ---');

var midR2Tests = [
  { ids: ['cough', 'sneeze', 'itch'], desc: '症状反复出现', keyword: '反复' },
  { ids: ['cough', 'sneeze', 'itch'], desc: '持续咳嗽', keyword: '持续' },
  { ids: ['lethargy', 'drool', 'ear_odor'], desc: '症状越来越严重', keyword: '越来越' },
  { ids: ['cough', 'sneeze', 'hair_loss'], desc: '多次治疗未见好转', keyword: '多次' }
];

midR2Tests.forEach(function(testCase) {
  var result = evaluateRisk(testCase.ids, testCase.desc);
  assertEqual(result.riskLevel, 'mid', `症状${testCase.ids.length}个含关键词"${testCase.keyword}" → 中风险`);
  assertEqual(result.action, 'hospital_list', '中风险 → hospital_list');
  assert(result.matchedRule.indexOf('反复/持续/加重') !== -1, `规则名称包含"反复/持续/加重"（实际: ${result.matchedRule}）`);
});

// 1.4 中风险R3测试：症状≥4
console.log('\n--- 1.4 中风险R3测试（≥4症状） ---');

var midR3Tests = [
  { ids: ['cough', 'sneeze', 'itch', 'hair_loss'], shouldTriggerR3: true },
  { ids: ['cough', 'sneeze', 'itch', 'hair_loss', 'redness'], shouldTriggerR3: true },  // 5个症状
  { ids: ['frequent_urination', 'difficulty_urination', 'tearing', 'eye_redness', 'ear_odor', 'head_shake'], shouldTriggerR3: true }  // 6个症状
];

midR3Tests.forEach(function(testCase) {
  var result = evaluateRisk(testCase.ids, '');
  assertEqual(result.riskLevel, 'mid', `症状${testCase.ids.length}个 → 中风险`);
  assertEqual(result.action, 'hospital_list', '中风险 → hospital_list');
  if (testCase.shouldTriggerR3) {
    assert(result.matchedRule.indexOf('≥4') !== -1, `规则名称包含"≥4"（实际: ${result.matchedRule}）`);
  }
});

// 1.5 中风险R4测试：精神萎靡+任意其他症状
console.log('\n--- 1.5 中风险R4测试（精神萎靡+其他症状） ---');

var midR4Tests = [
  ['lethargy', 'vomit'],
  ['lethargy', 'diarrhea'],
  ['lethargy', 'cough'],
  ['lethargy', 'itch', 'hair_loss']
];

midR4Tests.forEach(function(testCase) {
  var result = evaluateRisk(testCase, '');
  assertEqual(result.riskLevel, 'mid', `精神萎靡+${testCase.length-1}个其他症状 → 中风险`);
  assertEqual(result.action, 'hospital_list', '中风险 → hospital_list');
  assert(result.matchedRule.indexOf('精神萎靡') !== -1, '规则名称包含"精神萎靡"');
});

// 1.6 低风险测试
console.log('\n--- 1.6 低风险测试 ---');

// 单个症状
var singleSymptom = ['vomit'];
var singleResult = evaluateRisk(singleSymptom, '');
assertEqual(singleResult.riskLevel, 'low', '单个症状 → 低风险');
assertEqual(singleResult.action, 'home', '低风险 → home');
assert(singleResult.matchedRule.indexOf('单个症状') !== -1, '规则名称包含"单个症状"');

// 2-3个普通症状
var twoSymptoms = ['cough', 'sneeze'];
var twoResult = evaluateRisk(twoSymptoms, '');
assertEqual(twoResult.riskLevel, 'low', '2个普通症状 → 低风险');
assertEqual(twoResult.action, 'home', '低风险 → home');

// 1.7 规则优先级测试
console.log('\n--- 1.7 规则优先级测试 ---');

// 高优先级：高风险 > 中风险
var priority1 = evaluateRisk(['seizure', 'vomit', 'diarrhea', 'fever'], '症状持续加重');
assertEqual(priority1.riskLevel, 'high', '高风险规则优先（同时满足高+中）');
assertEqual(priority1.action, 'emergency', '高风险优先 → emergency');

// 中风险R1 > R2（都有特定症状和关键词，R1优先）
var priority2 = evaluateRisk(['vomit', 'diarrhea', 'fever'], '症状反复');
assertEqual(priority2.riskLevel, 'mid', '满足R1和R2，R1优先');
assert(priority2.matchedRule.indexOf('呕吐/腹泻/发热') !== -1, 'R1优先触发');

// 中风险R2 > R3（3个症状+关键词 vs 4个症状）
var priority3 = evaluateRisk(['cough', 'sneeze', 'itch'], '症状持续加重');
assertEqual(priority3.riskLevel, 'mid', '3症状+关键词触发R2');
assert(priority3.matchedRule.indexOf('反复/持续/加重') !== -1, 'R2触发');

// 边界测试：精神萎靡单独不触发中风险
var lethargySingle = evaluateRisk(['lethargy'], '');
assertEqual(lethargySingle.riskLevel, 'low', '精神萎靡单独症状 → 低风险（需要≥2个症状）');

// ========== 2. VALID_SYMPTOM_SET 白名单校验测试 ==========

console.log('\n=== 2. 白名单校验测试 ===');

// 2.1 合法症状ID测试
console.log('\n--- 2.1 合法症状ID测试 ---');

var validTests = [
  ['vomit'],
  ['diarrhea'],
  ['fever'],
  ['cough', 'sneeze', 'itch'],
  ['seizure', 'coma', 'dyspnea']
];

validTests.forEach(function(testCase) {
  var result = validateSymptomIds(testCase, VALID_SYMPTOM_SET);
  assert(result.valid, `合法症状ID [${testCase.join(', ')}] → 通过校验`);
  assertEqual(result.invalidIds.length, 0, '无效ID列表为空');
});

// 2.2 非法症状ID测试
console.log('\n--- 2.2 非法症状ID测试 ---');

var invalidTests = [
  ['fake_symptom'],
  ['invalid_id'],
  ['xxx', 'yyy'],
  ['hack', 'injection', 'attack']
];

invalidTests.forEach(function(testCase) {
  var result = validateSymptomIds(testCase, VALID_SYMPTOM_SET);
  assert(!result.valid, `非法症状ID [${testCase.join(', ')}] → 被拦截`);
  assert(result.invalidIds.length > 0, '无效ID列表不为空');
});

// 2.3 混合合法+非法症状ID测试
console.log('\n--- 2.3 混合合法+非法症状ID测试 ---');

var mixedTests = [
  { ids: ['vomit', 'fake_id'], expectedInvalid: ['fake_id'] },
  { ids: ['diarrhea', 'cough', 'hack'], expectedInvalid: ['hack'] },
  { ids: ['cough', 'xxx', 'yyy'], expectedInvalid: ['xxx', 'yyy'] }
];

mixedTests.forEach(function(testCase) {
  var result = validateSymptomIds(testCase.ids, VALID_SYMPTOM_SET);
  assert(!result.valid, `混合症状ID [${testCase.ids.join(', ')}] → 被拦截（含非法）`);
  assertEqual(result.invalidIds, testCase.expectedInvalid, `非法ID被正确识别: ${testCase.expectedInvalid.join(', ')}`);
});

// ========== 3. 敏感词检查测试 ==========

console.log('\n=== 3. 敏感词检查测试 ===');

// 3.1 医疗敏感词测试
console.log('\n--- 3.1 医疗敏感词测试 ---');

var medicalTests = [
  { desc: '使用了激素治疗', expectedWord: '激素' },
  { desc: '开了抗生素', expectedWord: '抗生素' },
  { desc: '需要处方药', expectedWord: '处方药' },
  { desc: '接触剧毒物质', expectedWord: '剧毒' },
  { desc: '致命危险', expectedWord: '致命' },
  { desc: '疑似癌症', expectedWord: '癌症' },
  { desc: '发现肿瘤', expectedWord: '肿瘤' },
  { desc: '安乐死', expectedWord: '安乐死' },
  { desc: '使用了人药', expectedWord: '人药' },
  { desc: '自行用药', expectedWord: '自行用药' },
  { desc: '自己开药', expectedWord: '自己开药' },
  { desc: '自己打针', expectedWord: '自己打针' },
  { desc: '误食毒药', expectedWord: '毒药' },
  { desc: '误食老鼠药', expectedWord: '老鼠药' },
  { desc: '使用禁用药物', expectedWord: '禁用药物' }
];

medicalTests.forEach(function(testCase) {
  var result = checkSensitiveWords(testCase.desc, MEDICAL_SENSITIVE_WORDS);
  assert(result.hasSensitive, `描述"${testCase.desc}" → 触发敏感词检测`);
  assertEqual(result.matchedWord, testCase.expectedWord, `匹配到敏感词: ${testCase.expectedWord}`);
});

// 3.2 有害内容关键词测试
console.log('\n--- 3.2 有害内容关键词测试 ---');

var harmfulTests = [
  { desc: '赌博网站', expectedWord: '赌博' },
  { desc: '去赌场', expectedWord: '赌场' },
  { desc: '博彩平台', expectedWord: '博彩' },
  { desc: '诈骗信息', expectedWord: '诈骗' },
  { desc: '传销组织', expectedWord: '传销' },
  { desc: '色情内容', expectedWord: '色情' },
  { desc: '涉及毒品', expectedWord: '毒品' },
  { desc: '购买枪支', expectedWord: '枪支' },
  { desc: '暴力倾向', expectedWord: '暴力' }
];

harmfulTests.forEach(function(testCase) {
  var result = checkSensitiveWords(testCase.desc, HARMFUL_CONTENT_KEYWORDS);
  assert(result.hasSensitive, `描述"${testCase.desc}" → 触发敏感词检测`);
  assertEqual(result.matchedWord, testCase.expectedWord, `匹配到关键词: ${testCase.expectedWord}`);
});

// 3.3 正常描述测试（不应被拦截）
console.log('\n--- 3.3 正常描述测试（不应被拦截） ---');

var normalTests = [
  '宠物偶尔咳嗽',
  '食欲不振',
  '精神状态一般',
  '大便正常',
  '饮水适量',
  '有时呕吐',
  '经常抓耳',
  '眼部有分泌物',
  '皮肤有点痒',
  '牙龈轻微红肿'
];

normalTests.forEach(function(testCase) {
  var result = checkSensitiveWords(testCase, ALL_SENSITIVE_WORDS);
  assert(!result.hasSensitive, `正常描述"${testCase}" → 不应被拦截`);
  assertEqual(result.matchedWord, null, '未匹配到敏感词');
});

// 3.4 空描述和null处理
console.log('\n--- 3.4 空描述和null处理 ---');

var emptyResult1 = checkSensitiveWords('', ALL_SENSITIVE_WORDS);
assert(!emptyResult1.hasSensitive, '空字符串 → 不触发敏感词');
assertEqual(emptyResult1.matchedWord, null, '空字符串未匹配');

var emptyResult2 = checkSensitiveWords(null, ALL_SENSITIVE_WORDS);
assert(!emptyResult2.hasSensitive, 'null → 不触发敏感词');
assertEqual(emptyResult2.matchedWord, null, 'null未匹配');

// 3.5 大小写敏感测试（中文无大小写，但验证逻辑正确性）
console.log('\n--- 3.5 敏感词边界测试 ---');

var caseTests = [
  { desc: '激素激素激素', expectedWord: '激素' },  // 重复
  { desc: '抗生抗生素', expectedWord: '抗生素' },  // 包含
  { desc: '处方药处方药处方药', expectedWord: '处方药' }  // 多次
];

caseTests.forEach(function(testCase) {
  var result = checkSensitiveWords(testCase.desc, MEDICAL_SENSITIVE_WORDS);
  assert(result.hasSensitive, `描述"${testCase.desc}" → 触发敏感词检测`);
});

// ========== 4. 描述长度限制测试 ==========

console.log('\n=== 4. 描述长度限制测试 ===');

const MAX_DESC_LENGTH = 10000;

// 4.1 正常长度测试
console.log('\n--- 4.1 正常长度测试 ---');

var normalLengthTests = [
  '',
  '正常描述',
  'a'.repeat(100),
  'a'.repeat(1000),
  'a'.repeat(5000),
  'a'.repeat(9999),
  'a'.repeat(10000)  // 边界值：刚好等于限制
];

normalLengthTests.forEach(function(testCase) {
  var result = validateDescriptionLength(testCase, MAX_DESC_LENGTH);
  assert(result.valid, `长度${testCase.length}字符 → 通过校验`);
  assertEqual(result.length, testCase.length, `长度值正确: ${testCase.length}`);
});

// 4.2 超长描述测试
console.log('\n--- 4.2 超长描述测试 ---');

var tooLongTests = [
  'a'.repeat(10001),
  'a'.repeat(15000),
  'a'.repeat(20000),
  'a'.repeat(50000)
];

tooLongTests.forEach(function(testCase) {
  var result = validateDescriptionLength(testCase, MAX_DESC_LENGTH);
  assert(!result.valid, `长度${testCase.length}字符 → 被拦截（超过${MAX_DESC_LENGTH}）`);
  assertEqual(result.length, testCase.length, `长度值正确: ${testCase.length}`);
});

// 4.3 null和undefined处理
console.log('\n--- 4.3 null和undefined处理 ---');

var nullResult = validateDescriptionLength(null, MAX_DESC_LENGTH);
assert(nullResult.valid, 'null → 通过校验');
assertEqual(nullResult.length, 0, 'null长度为0');

var undefinedResult = validateDescriptionLength(undefined, MAX_DESC_LENGTH);
assert(undefinedResult.valid, 'undefined → 通过校验');
assertEqual(undefinedResult.length, 0, 'undefined长度为0');

// ========== 5. 综合场景测试 ==========

console.log('\n=== 5. 综合场景测试 ===');

// 5.1 完整流程：高风险 + 白名单 + 长度 + 敏感词
console.log('\n--- 5.1 高风险完整流程 ---');

var highRiskScenario = {
  symptomIds: ['seizure', 'vomit'],
  description: '宠物抽搐，精神状态不佳'
};

var validCheck1 = validateSymptomIds(highRiskScenario.symptomIds, VALID_SYMPTOM_SET);
assert(validCheck1.valid, '症状ID白名单校验通过');

var lengthCheck1 = validateDescriptionLength(highRiskScenario.description, MAX_DESC_LENGTH);
assert(lengthCheck1.valid, '描述长度校验通过');

var sensitiveCheck1 = checkSensitiveWords(highRiskScenario.description, ALL_SENSITIVE_WORDS);
assert(!sensitiveCheck1.hasSensitive, '无敏感词');

var riskEval1 = evaluateRisk(highRiskScenario.symptomIds, highRiskScenario.description);
assertEqual(riskEval1.riskLevel, 'high', '综合评估 → 高风险');

// 5.2 完整流程：中风险 + 敏感词拦截
console.log('\n--- 5.2 中风险+敏感词拦截 ---');

var sensitiveScenario = {
  symptomIds: ['vomit', 'diarrhea', 'fever'],
  description: '使用了抗生素治疗'
};

var validCheck2 = validateSymptomIds(sensitiveScenario.symptomIds, VALID_SYMPTOM_SET);
assert(validCheck2.valid, '症状ID白名单校验通过');

var sensitiveCheck2 = checkSensitiveWords(sensitiveScenario.description, ALL_SENSITIVE_WORDS);
assert(sensitiveCheck2.hasSensitive, '触发敏感词拦截');
assertEqual(sensitiveCheck2.matchedWord, '抗生素', '匹配到敏感词: 抗生素');

// 5.3 完整流程：低风险 + 超长描述拦截
console.log('\n--- 5.3 低风险+超长描述拦截 ---');

var longDescScenario = {
  symptomIds: ['cough'],
  description: 'a'.repeat(15000)
};

var validCheck3 = validateSymptomIds(longDescScenario.symptomIds, VALID_SYMPTOM_SET);
assert(validCheck3.valid, '症状ID白名单校验通过');

var lengthCheck3 = validateDescriptionLength(longDescScenario.description, MAX_DESC_LENGTH);
assert(!lengthCheck3.valid, '超长描述被拦截');

var riskEval3 = evaluateRisk(longDescScenario.symptomIds, longDescScenario.description);
assertEqual(riskEval3.riskLevel, 'low', '风险评估为低风险（但长度校验先拦截）');

// 5.4 完整流程：非法症状ID拦截
console.log('\n--- 5.4 非法症状ID拦截 ---');

var invalidIdScenario = {
  symptomIds: ['vomit', 'hack_injection'],
  description: '正常描述'
};

var validCheck4 = validateSymptomIds(invalidIdScenario.symptomIds, VALID_SYMPTOM_SET);
assert(!validCheck4.valid, '非法症状ID被拦截');
assertEqual(validCheck4.invalidIds, ['hack_injection'], '识别出非法ID: hack_injection');

// ========== 总结 ==========

console.log('\n' + '='.repeat(60));
console.log('测试总结');
console.log('='.repeat(60));

var allPassed = summary('submitSymptom 增强测试');

if (allPassed) {
  console.log('\n所有测试通过！');
  console.log('覆盖范围：');
  console.log('  ✓ evaluateRisk 规则引擎（高/中/低风险，优先级）');
  console.log('  ✓ VALID_SYMPTOM_SET 白名单校验');
  console.log('  ✓ 敏感词检查（医疗 + 有害内容）');
  console.log('  ✓ 描述长度限制');
  console.log('  ✓ 综合场景测试');
} else {
  console.log('\n存在失败的测试，请检查实现。');
  process.exit(1);
}
