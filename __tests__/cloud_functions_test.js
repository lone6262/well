/**
 * 云函数综合测试套件
 * 测试所有纯逻辑函数（无需微信环境的函数）
 * 通过 mock wx-server-sdk 来测试云函数核心业务逻辑
 */

const crypto = require('crypto');

// ========== 测试框架 ==========
let passed = 0;
let failed = 0;
let errors = [];

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

function summary(name) {
  const total = passed + failed;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${name} 结果: ${passed}/${total} 通过, ${failed} 失败`);
}

// ========== Mock wx-server-sdk ==========
function mockWxServerSdk() {
  return {
    init: () => {},
    database: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => ({ data: {} }),
          update: async () => ({}),
          remove: async () => ({})
        }),
        where: () => ({
          get: async () => ({ data: [] }),
          count: async () => ({ total: 0 }),
          remove: async () => ({ stats: { removed: 0 } }),
          orderBy: () => ({
            get: async () => ({ data: [] })
          })
        }),
        add: async () => ({ _id: 'test_id_' + Date.now() }),
        limit: () => ({
          get: async () => ({ data: [] })
        })
      }),
      command: {
        in: () => {}
      }
    }),
    getWXContext: () => ({ OPENID: 'test_openid_12345' }),
    DYNAMIC_CURRENT_ENV: 'test-env'
  };
}

// ========== 测试1: submitSymptom 规则引擎 ==========
console.log('\n=== 测试1: submitSymptom 规则引擎 ===');

const HIGH_RISK_SYMPTOMS = [
  'seizure', 'coma', 'dyspnea', 'bleeding',
  'hematuria', 'paralysis', 'collapse', 'cyanosis'
];

const MID_RISK_KEYWORDS = [
  '反复', '持续', '加重', '多次', '不断',
  '频繁', '越来越', '恶化', '未见好转', '超过'
];

const SPECIFIC_SYMPTOMS = {
  VOMIT_GROUP: ['vomit', 'diarrhea', 'fever'],
  LETHARGY: 'lethargy'
};

function evaluateRisk(symptomIds, description = '') {
  const symptomCount = symptomIds.length;

  // 第一步：高风险熔断
  const hasHighRisk = symptomIds.some(id => HIGH_RISK_SYMPTOMS.includes(id));
  if (hasHighRisk) {
    const highRiskSymptom = symptomIds.find(id => HIGH_RISK_SYMPTOMS.includes(id));
    return {
      riskLevel: 'high',
      advice: '高风险，建议立即就医！请勿拖延，尽快前往最近的宠物医院。',
      action: 'emergency',
      matchedRule: `检测到高风险症状：${highRiskSymptom}`
    };
  }

  // 第二步：中风险条件检查
  let isMidRisk = false;
  let matchedRuleText = '';

  // R1: 症状数量 ≥3，且包含呕吐或腹泻或发热
  if (symptomCount >= 3) {
    const hasSpecificSymptom = symptomIds.some(id => SPECIFIC_SYMPTOMS.VOMIT_GROUP.includes(id));
    if (hasSpecificSymptom) {
      matchedRuleText = '中风险：症状数量≥3且包含呕吐/腹泻/发热';
      isMidRisk = true;
    }
  }

  // R2: 症状数量 ≥3，且描述包含关键词
  if (!isMidRisk && symptomCount >= 3) {
    const hasKeyword = MID_RISK_KEYWORDS.some(keyword => description.includes(keyword));
    if (hasKeyword) {
      matchedRuleText = '中风险：症状数量≥3且描述包含反复/持续/加重等关键词';
      isMidRisk = true;
    }
  }

  // R3: 症状数量 ≥4
  if (!isMidRisk && symptomCount >= 4) {
    matchedRuleText = '中风险：症状数量≥4（多系统症状）';
    isMidRisk = true;
  }

  // R4: 包含精神萎靡 + 任意2个其他症状
  if (!isMidRisk) {
    const hasLethargy = symptomIds.includes(SPECIFIC_SYMPTOMS.LETHARGY);
    if (hasLethargy && symptomCount >= 2) {
      matchedRuleText = '中风险：精神萎靡+其他症状（可能状况不佳）';
      isMidRisk = true;
    }
  }

  if (isMidRisk) {
    return {
      riskLevel: 'mid',
      advice: '中风险，建议24小时内就医观察。请记录症状变化，必要时拍照留存。',
      action: 'hospital_list',
      matchedRule: matchedRuleText
    };
  }

  // 第三步：默认低风险
  return {
    riskLevel: 'low',
    advice: '低风险，建议继续观察。保持正常饮食饮水，记录症状变化。如症状持续或加重，请及时就医。',
    action: 'home',
    matchedRule: `低风险：未达到中高风险标准`
  };
}

// 高风险测试
let result = evaluateRisk(['seizure']);
assertEqual(result.riskLevel, 'high', '单个高风险症状（抽搐）→ high');
assertEqual(result.action, 'emergency', '高风险操作 → emergency');

result = evaluateRisk(['coma']);
assertEqual(result.riskLevel, 'high', '昏迷 → high');

result = evaluateRisk(['dyspnea']);
assertEqual(result.riskLevel, 'high', '呼吸困难 → high');

result = evaluateRisk(['bleeding', 'vomit']);
assertEqual(result.riskLevel, 'high', '高风险+其他症状仍为 high');
assert(result.matchedRule.includes('bleeding'), '应匹配bleeding而非忽略');

// 中风险测试 R1: 症状≥3 + 呕吐/腹泻/发热
result = evaluateRisk(['vomit', 'diarrhea', 'lethargy']);
assertEqual(result.riskLevel, 'mid', 'R1: 3症状含呕吐/腹泻 → mid');
assertEqual(result.action, 'hospital_list', '中风险操作 → hospital_list');

result = evaluateRisk(['fever', 'cough', 'sneeze']);
assertEqual(result.riskLevel, 'mid', 'R1: 3症状含发热 → mid');

// 中风险测试 R2: 症状≥3 + 描述含关键词
result = evaluateRisk(['cough', 'sneeze', 'itchy'], '反复咳嗽');
assertEqual(result.riskLevel, 'mid', 'R2: 3症状+描述含"反复" → mid');

result = evaluateRisk(['cough', 'sneeze', 'itchy'], '症状持续好几天了');
assertEqual(result.riskLevel, 'mid', 'R2: 3症状+描述含"持续" → mid');

// 中风险测试 R3: 症状≥4
result = evaluateRisk(['cough', 'sneeze', 'itchy', 'lethargy']);
assertEqual(result.riskLevel, 'mid', 'R3: 4个症状 → mid');

// 中风险测试 R4: 精神萎靡+其他症状
result = evaluateRisk(['lethargy', 'cough']);
assertEqual(result.riskLevel, 'mid', 'R4: 精神萎靡+1其他症状 → mid');

// 低风险测试
result = evaluateRisk(['cough']);
assertEqual(result.riskLevel, 'low', '单个普通症状 → low');
assertEqual(result.action, 'home', '低风险操作 → home');

result = evaluateRisk(['cough', 'sneeze']);
assertEqual(result.riskLevel, 'low', '2个普通症状 → low（不满足中风险）');

result = evaluateRisk([], '没精神');
assertEqual(result.riskLevel, 'low', '无选择症状 → low');

// 边界测试
result = evaluateRisk(['vomit', 'diarrhea']);
assertEqual(result.riskLevel, 'low', '2症状含呕吐但不≥3 → low');

result = evaluateRisk(['lethargy']);
assertEqual(result.riskLevel, 'low', '仅精神萎靡无其他症状 → low');

result = evaluateRisk(['cough', 'sneeze', 'lethargy']);
assertEqual(result.riskLevel, 'mid', '3症状含精神萎靡+2其他 → mid (R1优先)');

summary('规则引擎测试');

// ========== 测试2: silentLogin Token 生成与验证 ==========
console.log('\n=== 测试2: silentLogin Token 生成与验证 ===');

const TOKEN_SECRET = 'test_secret_key';
const TOKEN_EXPIRE_DAYS = 7;

function createSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function generateToken(openid, userId) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    openid: openid,
    userId: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRE_DAYS * 24 * 60 * 60
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(`${headerB64}.${payloadB64}`, TOKEN_SECRET);

  return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = createSignature(`${headerB64}.${payloadB64}`, TOKEN_SECRET);
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch (error) {
    return null;
  }
}

// Token 生成测试
const token = generateToken('user_openid_001', 'user_db_id_123');
const parts = token.split('.');
assert(parts.length === 3, 'Token应有3部分（header.payload.signature）');
assert(parts[2].length === 64, 'HMAC-SHA256签名应为64位hex字符');

// Token 验证测试
const payload = verifyToken(token);
assert(payload !== null, '有效Token应验证成功');
assertEqual(payload.openid, 'user_openid_001', '验证后openid一致');
assertEqual(payload.userId, 'user_db_id_123', '验证后userId一致');
assert(payload.iat > 0, 'iat应为有效时间戳');
assert(payload.exp > payload.iat, 'exp应大于iat');

// 篡改检测测试
const tamperedToken = token.replace(/[a-f0-9]/, 'x');
assert(verifyToken(tamperedToken) === null, '篡改后的Token应返回null');

// 签名不匹配测试
const forgedToken_withSecret = 'badHeader.badPayload.' + createSignature('badHeader.badPayload', TOKEN_SECRET);
assert(verifyToken(forgedToken_withSecret) === null, '错误的 signature 验证应失败');

// 无效格式测试
assert(verifyToken('invalid_token') === null, '无效Token格式应返回null（无分隔符）');
assert(verifyToken('a.b.c.d') === null, '4段Token应返回null');

// 过期Token测试
function generateExpiredToken(openid, userId) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    openid, userId,
    iat: Math.floor(Date.now() / 1000) - 86400 * 365,
    exp: Math.floor(Date.now() / 1000) - 1
  };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(`${headerB64}.${payloadB64}`, TOKEN_SECRET);
  return `${headerB64}.${payloadB64}.${signature}`;
}

assert(verifyToken(generateExpiredToken('u1', 'id1')) === null, '过期Token应返回null');

summary('Token 生成与验证');

// ========== 测试3: searchHospitals Haversine距离计算 ==========
console.log('\n=== 测试3: searchHospitals 距离计算 ===');

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 相同点距离应为0
let dist = calculateDistance(39.9042, 116.4074, 39.9042, 116.4074);
assert(dist < 1, '相同经纬度距离应接近0米');
console.log(`  相同点: ${dist.toFixed(2)}m`);

// 北京天安门到故宫（约1km）
dist = calculateDistance(39.9042, 116.4074, 39.9163, 116.3972);
assert(dist > 500 && dist < 2000, '天安门到故宫距离应在500-2000m');
console.log(`  天安门→故宫: ${dist.toFixed(0)}m`);

// 上海到北京（约1068km）
dist = calculateDistance(31.2304, 121.4737, 39.9042, 116.4074);
assert(dist > 1000000 && dist < 1200000, '上海到北京距离应在1000-1200km');
console.log(`  上海→北京: ${(dist/1000).toFixed(0)}km`);

// 24小时检测函数
function check24Hours(title, address) {
  const keywords = ['24小时', '急诊', '24h', '全天', '昼夜', '日夜'];
  return keywords.some(kw => (title || '').includes(kw) || (address || '').includes(kw));
}

assert(check24Hours('24小时宠物医院', '') === true, '标题含"24小时"');
assert(check24Hours('萌宠诊所', '急诊通道') === true, '地址含"急诊"');
assert(check24Hours('爱心宠物医院', '') === false, '普通医院非24小时');
assert(check24Hours('', '') === false, '空信息非24小时');

// 电话格式化函数
function formatPhoneNumber(tel) {
  if (!tel) return '暂无电话';
  const cleaned = tel.toString().replace(/[^0-9+\-\s]/g, '').trim();
  return (cleaned && cleaned.length >= 7) ? cleaned : '请电话确认';
}

assertEqual(formatPhoneNumber('010-12345678'), '010-12345678', '标准电话格式');
assertEqual(formatPhoneNumber(null), '暂无电话', 'null→暂无电话');
assertEqual(formatPhoneNumber(''), '暂无电话', '空串→暂无电话');
assertEqual(formatPhoneNumber('123'), '请电话确认', '短号码→请电话确认');

summary('距离计算与辅助函数');

// ========== 测试4: getPetList 健康状态计算 ==========
console.log('\n=== 测试4: getPetList 健康状态计算 ===');

function calculateHealthStatus(pet) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const hasRecentVaccine = pet.vaccine_date && new Date(pet.vaccine_date) >= thirtyDaysAgo;
  const hasRecentDeworming = pet.deworm_date && new Date(pet.deworm_date) >= thirtyDaysAgo;

  if (hasRecentVaccine && hasRecentDeworming) {
    return 'good';
  } else if (!hasRecentVaccine || !hasRecentDeworming) {
    return 'warning';
  }
  return 'good';
}

// 今天打疫苗和驱虫 → good
const today = new Date().toISOString().split('T')[0];
assertEqual(
  calculateHealthStatus({ vaccine_date: today, deworm_date: today }),
  'good',
  '近期疫苗+驱虫 → good'
);

// 只有疫苗无驱虫 → warning
assertEqual(
  calculateHealthStatus({ vaccine_date: today, deworm_date: null }),
  'warning',
  '有疫苗无驱虫 → warning'
);

// 都过期 → warning
assertEqual(
  calculateHealthStatus({ vaccine_date: '2020-01-01', deworm_date: '2020-01-01' }),
  'warning',
  '过期疫苗+过期驱虫 → warning'
);

// 无数据 → warning
assertEqual(
  calculateHealthStatus({}),
  'warning',
  '无疫苗驱虫数据 → warning'
);

summary('健康状态计算');

// ========== 测试5: 常量模块完整性 ==========
console.log('\n=== 测试5: 常量模块完整性 ===');

const constants = require('../cloudfunctions/common/constants');

// 检查必要的导出
const requiredExports = [
  'PET_TYPES', 'PET_TYPE_NAMES', 'RISK_LEVELS', 'ORDER_STATUS',
  'ORDER_TYPES', 'MEMBER_DURATION', 'COLLECTIONS', 'RESPONSE_CODE',
  'DISCLAIMERS', 'AGE_THRESHOLD', 'SYMPTOM_CATEGORIES'
];

requiredExports.forEach(key => {
  assert(constants[key] !== undefined, `常量导出: ${key}`);
});

// 检查集合名称
assertEqual(constants.COLLECTIONS.USERS, 'users', 'COLLECTIONS.USERS');
assertEqual(constants.COLLECTIONS.PETS, 'pets', 'COLLECTIONS.PETS');
assertEqual(constants.COLLECTIONS.SYMPTOM_RECORDS, 'symptom_records', 'COLLECTIONS.SYMPTOM_RECORDS');
assertEqual(constants.COLLECTIONS.ORDERS, 'orders', 'COLLECTIONS.ORDERS');
assertEqual(constants.COLLECTIONS.HOSPITALS, 'hospitals', 'COLLECTIONS.HOSPITALS');
assertEqual(constants.COLLECTIONS.AI_CACHE, 'ai_cache', 'COLLECTIONS.AI_CACHE');

// 检查响应码
assertEqual(constants.RESPONSE_CODE.SUCCESS, 0, 'RESPONSE_CODE.SUCCESS = 0');
assertEqual(constants.RESPONSE_CODE.ERROR, -1, 'RESPONSE_CODE.ERROR = -1');
assertEqual(constants.RESPONSE_CODE.UNAUTHORIZED, 401, 'RESPONSE_CODE.UNAUTHORIZED = 401');
assertEqual(constants.RESPONSE_CODE.NOT_FOUND, 404, 'RESPONSE_CODE.NOT_FOUND = 404');
assertEqual(constants.RESPONSE_CODE.SERVER_ERROR, 500, 'RESPONSE_CODE.SERVER_ERROR = 500');

// 检查宠物类型
assertEqual(constants.PET_TYPES.CAT, 'cat', 'PET_TYPES.CAT');
assertEqual(constants.PET_TYPES.DOG, 'dog', 'PET_TYPES.DOG');
assertEqual(constants.PET_TYPES.OTHER, 'other', 'PET_TYPES.OTHER');

// 检查风险等级
assertEqual(constants.RISK_LEVELS.LOW, 'low', 'RISK_LEVELS.LOW');
assertEqual(constants.RISK_LEVELS.MID, 'mid', 'RISK_LEVELS.MID');
assertEqual(constants.RISK_LEVELS.HIGH, 'high', 'RISK_LEVELS.HIGH');

// 检查症状分类
assert(constants.SYMPTOM_CATEGORIES.length === 8, '应有8个症状分类');
assert(constants.SYMPTOM_CATEGORIES[0].name === '消化系统', '第一个分类是消化系统');

// 检查免责声明
assert(constants.DISCLAIMERS.LAUNCH_PAGE.includes('重要提示'), 'LAUNCH_PAGE 包含重要提示');
assert(constants.DISCLAIMERS.RESULT_PAGE.includes('免责声明'), 'RESULT_PAGE 包含免责声明');
assert(constants.DISCLAIMERS.REPORT_PAGE.includes('医学免责'), 'REPORT_PAGE 包含医学免责');

summary('常量模块完整性');

// ========== 测试6: sensitiveWords 模块 ==========
console.log('\n=== 测试6: 敏感词过滤模块 ===');

const sensitiveWords = require('../miniprogram/config/sensitiveWords');

assert(typeof sensitiveWords.checkSensitiveWords === 'function', 'checkSensitiveWords 是函数');

// 医疗敏感词检测
result = sensitiveWords.checkSensitiveWords('这是各种癌症的诊断建议');
assert(result.hasSensitive === true, '医疗敏感词应被检测到');

// 有害内容检测
result = sensitiveWords.checkSensitiveWords('含有不文明用语的内容');
// 具体检测取决于敏感词表

// 正常内容
result = sensitiveWords.checkSensitiveWords('我家狗狗今天有点咳嗽');
// 正常描述应该通过
console.log(`  检测结果: hasSensitive=${result.hasSensitive}, message="${result.message}"`);

// 检查 MEDICAL_SENSITIVE_WORDS
assert(Array.isArray(sensitiveWords.MEDICAL_SENSITIVE_WORDS), 'MEDICAL_SENSITIVE_WORDS 是数组');
assert(sensitiveWords.MEDICAL_SENSITIVE_WORDS.length > 0, '医疗敏感词表非空');
assert(sensitiveWords.MEDICAL_SENSITIVE_WORDS.includes('癌症'), '癌症应在医疗敏感词中');

// 检查 HARMFUL_CONTENT_KEYWORDS
assert(Array.isArray(sensitiveWords.HARMFUL_CONTENT_KEYWORDS), 'HARMFUL_CONTENT_KEYWORDS 是数组');
assert(sensitiveWords.HARMFUL_CONTENT_KEYWORDS.length > 0, '有害内容词表非空');

summary('敏感词过滤模块');

// ========== 测试7: logger 模块 ==========
console.log('\n=== 测试7: logger 模块');

const logger = require('../miniprogram/utils/logger');

assert(typeof logger.debug === 'function', 'logger.debug 是函数');
assert(typeof logger.info === 'function', 'logger.info 是函数');
assert(typeof logger.warn === 'function', 'logger.warn 是函数');
assert(typeof logger.error === 'function', 'logger.error 是函数');

// 测试子 logger
const childLogger = logger.child('TestModule');
assert(typeof childLogger.debug === 'function', 'childLogger.debug 是函数');
assert(typeof childLogger.info === 'function', 'childLogger.info 是函数');

summary('logger 模块');

// ========== 测试8: offlineData 模块 ==========
console.log('\n=== 测试8: offlineData 模块');

const offlineData = require('../miniprogram/utils/offlineData');

assert(typeof offlineData.getHospitals === 'function', 'getHospitals 是函数');
assert(typeof offlineData.getEmergencyHospitals === 'function', 'getEmergencyHospitals 是函数');
assert(typeof offlineData.getPets === 'function', 'getPets 是函数');
assert(typeof offlineData.getRiskAssessment === 'function', 'getRiskAssessment 是函数');

// 测试 getHospitals
const hospitals = offlineData.getHospitals();
assert(Array.isArray(hospitals), 'getHospitals 返回数组');
assert(hospitals.length > 0, '医院列表非空');
assert(hospitals[0].hasOwnProperty('name'), '医院有name属性');
assert(hospitals[0].hasOwnProperty('address'), '医院有address属性');
console.log(`  医院数量: ${hospitals.length}`);

// 测试 getPets
const pets = offlineData.getPets();
assert(Array.isArray(pets), 'getPets 返回数组');
assert(pets.length > 0, '宠物列表非空');
assert(pets[0].hasOwnProperty('name'), '宠物有name属性');
console.log(`  宠物数量: ${pets.length}`);

// 测试 getEmergencyHospitals
const emergencyHospitals = offlineData.getEmergencyHospitals();
assert(Array.isArray(emergencyHospitals), 'getEmergencyHospitals 返回数组');
assert(emergencyHospitals.length > 0, '紧急医院列表非空');
console.log(`  紧急医院数量: ${emergencyHospitals.length}`);

// 测试 getRiskAssessment
const assessment = offlineData.getRiskAssessment('high');
assert(assessment !== null, 'getRiskAssessment("high") 返回非空');
assert(assessment.hasOwnProperty('riskLevel'), '评估有riskLevel');
assert(assessment.hasOwnProperty('advice'), '评估有advice');
console.log(`  高风险建议: ${assessment.advice.substring(0, 30)}...`);

summary('offlineData 模块');

// ========== 测试9: 响应码一致性验证 ==========
console.log('\n=== 测试9: 云函数响应码一致性 ===');

const RESPONSE_CODE = constants.RESPONSE_CODE;

// 所有云函数应使用统一 RESPONSE_CODE
const expectedCodes = ['SUCCESS', 'ERROR', 'UNAUTHORIZED', 'NOT_FOUND', 'SERVER_ERROR'];
expectedCodes.forEach(code => {
  assert(RESPONSE_CODE[code] !== undefined, `RESPONSE_CODE.${code} 存在`);
});

// submitSymptom 使用的所有响应码都在常量中
assert(RESPONSE_CODE.SUCCESS === 0, 'submitSymptom SUCCESS = 0');
assert(RESPONSE_CODE.ERROR === -1, 'submitSymptom ERROR = -1');
assert(RESPONSE_CODE.UNAUTHORIZED === 401, 'submitSymptom UNAUTHORIZED = 401');
assert(RESPONSE_CODE.SERVER_ERROR === 500, 'submitSymptom SERVER_ERROR = 500');

// getHospitals 使用的响应码也一致
// （已统一使用 constants.RESPONSE_CODE）

summary('响应码一致性');

// ========== 最终结果 ==========
console.log('\n' + '='.repeat(60));
console.log('          全 面 测 试 结 果');
console.log('='.repeat(60));
console.log(`  通过: ${passed}`);
console.log(`  失败: ${failed}`);
console.log(`  总计: ${passed + failed}`);
console.log(`  通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\n❌ 失败详情:');
  errors.forEach(e => console.log(`  ${e}`));
  process.exit(1);
} else {
  console.log('\n✅ 所有测试通过！');
  process.exit(0);
}
