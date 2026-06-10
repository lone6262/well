// 云函数入口文件 - 严格按规则引擎文档实现
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, VALID_SYMPTOM_SET , warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { checkRateLimit } = require('./common/rate-limiter');
const { createLogger } = require('./common/logger');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const logger = createLogger('submitSymptom');

// ========== 常量定义 ==========

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

// 敏感词表（与 miniprogram/config/sensitiveWords.js 保持同步）
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

// ========== 规则引擎核心函数 ==========

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

  logger.info('=== 规则引擎开始评估 ===');
  logger.info('症状数量:', symptomCount);

  // 遍历规则数组，首个匹配即返回
  for (var i = 0; i < RISK_RULES.length; i++) {
    var rule = RISK_RULES[i];
    if (rule.test(symptomIds, description)) {
      logger.info('命中规则:', rule.name);
      return rule.result(symptomIds);
    }
  }

  // 默认低风险
  logger.info('默认低风险');
  var symptomText = symptomCount === 1 ? '单个症状' : symptomCount + '个轻微症状';
  return {
    riskLevel: 'low',
    advice: '低风险，建议继续观察。保持正常饮食饮水，记录症状变化。如症状持续或加重，请及时就医。',
    action: 'home',
    matchedRule: '低风险：' + symptomText + '未达到中高风险标准'
  };
}

/**
 * 保存记录并返回结果
 */
async function saveAndReturn(openid, petId, symptomIds, symptomNames, description, evaluationResult) {
  try {
    // 构建记录数据（使用user_id字段与其他云函数保持一致）
    const recordData = {
      user_id: openid,  // 使用user_id而非openid，与getRecordDetail保持一致
      pet_id: petId,
      symptoms: symptomIds,  // 存储症状ID列表（英文）
      symptom_names: symptomNames || symptomIds,  // 存储症状名称（中文），如果没有则使用ID
      description: description,
      risk_level: evaluationResult.riskLevel,
      matched_rule: evaluationResult.matchedRule || '规则引擎评估',  // 使用规则引擎返回的具体规则名称
      status: 'completed',
      created_at: new Date()
    };

    logger.info('=== 准备保存记录 ===');
    logger.info('记录数据:', recordData);

    // 保存到数据库
    const saveResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS).add({
      data: recordData
    });

    logger.info('✅ 记录保存成功，ID:', saveResult._id);

    // 返回结果（按文档格式，使用中文名称显示）
    const displayName = symptomNames && symptomNames.length > 0 ? symptomNames : symptomIds;
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '评估完成',
      data: {
        recordId: saveResult._id,
        riskLevel: evaluationResult.riskLevel,
        advice: evaluationResult.advice,
        action: evaluationResult.action,
        symptomSummary: displayName.join('、')  // 使用中文名称显示
      }
    };

  } catch (error) {
    logger.error('❌ 记录保存失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '系统繁忙，请重试',
      data: {}
    };
  }
}

// ========== 云函数入口 ==========

exports.main = async (event, context) => {
  await warmupConfig(db);
  logger.info('=== submitSymptom 云函数调用 ===');

  // 从前端传递的参数中获取所有数据（openid 由服务端获取，不从客户端接收）
  const { petId, symptomIds, symptomNames, description = '', token } = event;
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  if (!openid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: '用户未登录',
      data: {}
    };
  }

  // Token 验证（写入操作需验证身份）
  if (!verifyToken(token)) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: '身份验证失败，请重新登录',
      data: {}
    };
  }

  // 速率限制（写操作故障时拒绝）
  if (!await checkRateLimit(db, openid, 'submitSymptom', 10, 60000, false)) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '操作过于频繁，请稍后再试',
      data: {}
    };
  }

  try {
    // 1. 参数校验
    if (!petId) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '请选择宠物',
        data: {}
      };
    }

    if (!symptomIds || symptomIds.length === 0) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '请至少选择一个症状',
        data: {}
      };
    }

    // 1.5. 症状ID白名单校验
    const invalidIds = symptomIds.filter(function(id) { return !VALID_SYMPTOM_SET.has(id); });
    if (invalidIds.length > 0) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '无效的症状ID: ' + invalidIds.join(', '),
        data: {}
      };
    }

    // 1.6. 描述长度限制（防止大 payload 攻击）
    if (description && description.length > 10000) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '描述内容过长，请控制在10000字以内',
        data: {}
      };
    }

    // 1.7. 敏感词检查（后端校验，防止绕过前端直接调用云函数）
    if (description && description.length > 0) {
      var hasSensitive = ALL_SENSITIVE_WORDS.some(function(word) {
        return description.indexOf(word) !== -1;
      });
      if (hasSensitive) {
        return {
          code: RESPONSE_CODE.ERROR,
          msg: '描述中包含不当内容，请修改后重新提交',
          data: {}
        };
      }
    }

    // 2. 调用规则引擎评估风险
    const evaluationResult = evaluateRisk(symptomIds, description);
    logger.info('评估结果:', evaluationResult);

    // 3. 保存记录并返回结果（传递symptomNames用于显示）
    return await saveAndReturn(openid, petId, symptomIds, symptomNames, description, evaluationResult);

  } catch (error) {
    logger.error('❌ 云函数执行失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {}
    };
  }
};