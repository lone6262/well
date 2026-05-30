// 云函数入口文件 - 严格按规则引擎文档实现
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

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

// 特定症状组（用于中风险判断）
const SPECIFIC_SYMPTOMS = {
  VOMIT_GROUP: ['vomit', 'diarrhea', 'fever'],  // 呕吐、腹泻、发热
  LETHARGY: 'lethargy'  // 精神萎靡
};

// ========== 规则引擎核心函数 ==========

/**
 * 规则引擎 - 三步判断法
 * 第一步：高风险熔断检查
 * 第二步：中风险条件检查
 * 第三步：默认低风险
 */
function evaluateRisk(symptomIds, description = '') {
  const symptomCount = symptomIds.length;

  console.log('=== 规则引擎开始评估 ===');
  console.log('症状ID列表:', symptomIds);
  console.log('症状数量:', symptomCount);
  console.log('描述:', description);

  // 第一步：高风险熔断检查（优先级最高）
  const hasHighRisk = symptomIds.some(id => HIGH_RISK_SYMPTOMS.includes(id));
  if (hasHighRisk) {
    // 找到具体的高风险症状名称
    const highRiskSymptom = symptomIds.find(id => HIGH_RISK_SYMPTOMS.includes(id));
    const symptomNames = {
      'seizure': '抽搐',
      'coma': '昏迷',
      'dyspnea': '呼吸困难',
      'bleeding': '持续出血',
      'hematuria': '尿血',
      'paralysis': '瘫痪',
      'collapse': '虚脱',
      'cyanosis': '发绀'
    };

    console.log('✗ 命中高风险规则');
    return {
      riskLevel: 'high',
      advice: '高风险，建议立即就医！请勿拖延，尽快前往最近的宠物医院。',
      action: 'emergency',
      matchedRule: `检测到高风险症状：${symptomNames[highRiskSymptom] || '高风险症状'}`
    };
  }

  // 第二步：中风险条件检查
  let isMidRisk = false;
  let matchedRuleText = '';

  // R1: 症状数量 ≥3，且包含呕吐或腹泻或发热
  if (symptomCount >= 3) {
    const hasSpecificSymptom = symptomIds.some(id =>
      SPECIFIC_SYMPTOMS.VOMIT_GROUP.includes(id)
    );
    if (hasSpecificSymptom) {
      matchedRuleText = '中风险：症状数量≥3且包含呕吐/腹泻/发热';
      console.log('✓ 命中中风险规则R1');
      isMidRisk = true;
    }
  }

  // R2: 症状数量 ≥3，且描述包含关键词
  if (!isMidRisk && symptomCount >= 3) {
    const hasKeyword = MID_RISK_KEYWORDS.some(keyword =>
      description.includes(keyword)
    );
    if (hasKeyword) {
      matchedRuleText = '中风险：症状数量≥3且描述包含反复/持续/加重等关键词';
      console.log('✓ 命中中风险规则R2');
      isMidRisk = true;
    }
  }

  // R3: 症状数量 ≥4
  if (!isMidRisk && symptomCount >= 4) {
    matchedRuleText = '中风险：症状数量≥4（多系统症状）';
    console.log('✓ 命中中风险规则R3');
    isMidRisk = true;
  }

  // R4: 包含精神萎靡 + 任意2个其他症状
  if (!isMidRisk) {
    const hasLethargy = symptomIds.includes(SPECIFIC_SYMPTOMS.LETHARGY);
    if (hasLethargy && symptomCount >= 2) {
      matchedRuleText = '中风险：精神萎靡+其他症状（可能状况不佳）';
      console.log('✓ 命中中风险规则R4');
      isMidRisk = true;
    }
  }

  if (isMidRisk) {
    return {
      riskLevel: 'mid',
      advice: '中风险，建议24小时内就医观察。请记录症状变化，必要时拍照留存。',
      action: 'hospital_list',
      matchedRule: matchedRuleText || '中风险：多症状组合'
    };
  }

  // 第三步：默认低风险
  console.log('✓ 默认低风险');
  const symptomText = symptomCount === 1 ? '单个症状' : `${symptomCount}个轻微症状`;
  return {
    riskLevel: 'low',
    advice: '低风险，建议继续观察。保持正常饮食饮水，记录症状变化。如症状持续或加重，请及时就医。',
    action: 'home',
    matchedRule: `低风险：${symptomText}未达到中高风险标准`
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

    console.log('=== 准备保存记录 ===');
    console.log('记录数据:', recordData);

    // 保存到数据库
    const saveResult = await db.collection('symptom_records').add({
      data: recordData
    });

    console.log('✅ 记录保存成功，ID:', saveResult._id);

    // 返回结果（按文档格式，使用中文名称显示）
    const displayName = symptomNames && symptomNames.length > 0 ? symptomNames : symptomIds;
    return {
      code: 0,
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
    console.error('❌ 记录保存失败:', error);
    return {
      code: 500,
      msg: '系统繁忙，请重试',
      data: {
        error: error.message
      }
    };
  }
}

// ========== 云函数入口 ==========

exports.main = async (event, context) => {
  console.log('=== submitSymptom 云函数调用 ===');
  console.log('入参:', event);

  // 从前端传递的参数中获取所有数据
  const { petId, symptomIds, symptomNames, description = '', openid } = event;

  // 使用前端传递的openid，而不是重新获取
  if (!openid) {
    console.log('❌ 未获取到openid');
    return {
      code: 401,
      msg: '用户未登录',
      data: {}
    };
  }

  console.log('✅ 用户openid:', openid);

  try {
    // 1. 参数校验
    if (!petId) {
      return {
        code: 400,
        msg: '请选择宠物',
        data: {}
      };
    }

    if (!symptomIds || symptomIds.length === 0) {
      return {
        code: 400,
        msg: '请至少选择一个症状',
        data: {}
      };
    }

    // 2. 调用规则引擎评估风险
    const evaluationResult = evaluateRisk(symptomIds, description);
    console.log('评估结果:', evaluationResult);

    // 3. 保存记录并返回结果（传递symptomNames用于显示）
    return await saveAndReturn(openid, petId, symptomIds, symptomNames, description, evaluationResult);

  } catch (error) {
    console.error('❌ 云函数执行失败:', error);
    return {
      code: 500,
      msg: '服务器错误，请稍后重试',
      data: {
        error: error.message
      }
    };
  }
};