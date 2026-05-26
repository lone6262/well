// 云函数入口文件
const cloud = require('wx-server-sdk');

// 本地常量定义
const COLLECTIONS = {
  USERS: 'users',
  PETS: 'pets',
  SYMPTOM_RECORDS: 'symptom_records',
  AI_CACHE: 'ai_cache',
  ORDERS: 'orders',
  HOSPITALS: 'hospitals'
};

const RESPONSE_CODE = {
  SUCCESS: 0,
  ERROR: -1,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};

// 本地规则引擎定义
const riskRules = {
  rules: [
    {
      name: "高风险-抽搐",
      symptoms: ["抽搐"],
      condition: "any",
      risk: "high",
      action: "emergency"
    },
    {
      name: "高风险-呼吸困难",
      symptoms: ["呼吸困难"],
      condition: "any",
      risk: "high",
      action: "emergency"
    },
    {
      name: "高风险-尿血或排尿困难",
      symptoms: ["尿血", "排尿困难"],
      condition: "any",
      risk: "high",
      action: "emergency"
    },
    {
      name: "高风险-呕吐+腹泻+精神萎靡",
      symptoms: ["呕吐", "腹泻", "精神萎靡"],
      condition: "all",
      risk: "high",
      action: "emergency"
    },
    {
      name: "中风险-单独呕吐",
      symptoms: ["呕吐"],
      condition: "any",
      risk: "mid"
    },
    {
      name: "中风险-单独腹泻",
      symptoms: ["腹泻"],
      condition: "any",
      risk: "mid"
    },
    {
      name: "中风险-咳嗽或打喷嚏",
      symptoms: ["咳嗽", "打喷嚏"],
      condition: "any",
      risk: "mid"
    },
    {
      name: "中风险-食欲不振",
      symptoms: ["食欲不振"],
      condition: "any",
      risk: "mid"
    },
    {
      name: "中风险-瘙痒+脱毛",
      symptoms: ["瘙痒", "脱毛"],
      condition: "all",
      risk: "mid"
    },
    {
      name: "中风险-耳垢多+甩头",
      symptoms: ["耳垢多/异味", "甩头/抓耳"],
      condition: "all",
      risk: "mid"
    },
    {
      name: "中风险-流泪多+眼睛红肿",
      symptoms: ["流泪/眼屎多", "眼睛红肿"],
      condition: "all",
      risk: "mid"
    },
    {
      name: "低风险-便秘",
      symptoms: ["便秘"],
      condition: "any",
      risk: "low"
    },
    {
      name: "低风险-流口水",
      symptoms: ["流口水"],
      condition: "any",
      risk: "low"
    },
    {
      name: "低风险-牙龈红肿",
      symptoms: ["牙龈红肿/出血"],
      condition: "any",
      risk: "low"
    },
    {
      name: "低风险-其他轻微症状",
      symptoms: [],
      condition: "default",
      risk: "low"
    }
  ]
};

/**
 * 评估宠物症状风险等级
 */
function evaluateRisk(symptomIds, petInfo = {}) {
  // 按优先级顺序匹配规则（高风险优先）
  for (let rule of riskRules.rules) {
    if (rule.condition === 'any') {
      // 任意症状匹配即触发
      if (rule.symptoms.some(symptom => symptomIds.includes(symptom))) {
        return {
          riskLevel: rule.risk,
          matchedRule: rule.name,
          action: rule.action || 'normal'
        };
      }
    } else if (rule.condition === 'all') {
      // 所有症状必须同时存在
      if (rule.symptoms.length > 0 &&
          rule.symptoms.every(symptom => symptomIds.includes(symptom))) {
        return {
          riskLevel: rule.risk,
          matchedRule: rule.name,
          action: rule.action || 'normal'
        };
      }
    } else if (rule.condition === 'default') {
      // 默认规则（当其他规则都不匹配时）
      return {
        riskLevel: rule.risk,
        matchedRule: rule.name,
        action: rule.action || 'normal'
      };
    }
  }

  // 如果没有匹配到任何规则，默认低风险
  return {
    riskLevel: 'low',
    matchedRule: '默认规则',
    action: 'normal'
  };
}

/**
 * 获取风险等级的显示信息
 */
function getRiskDisplayInfo(riskLevel) {
  const riskInfo = {
    low: {
      color: '#52c41a',  // 绿色
      icon: '🟢',
      title: '低风险',
      description: '居家观察，注意宠物状态变化'
    },
    mid: {
      color: '#faad14',  // 黄色
      icon: '🟡',
      title: '中风险',
      description: '建议线上问诊或近期就医'
    },
    high: {
      color: '#f5222d',  // 红色
      icon: '🔴',
      title: '高风险',
      description: '立即就医，不要拖延'
    }
  };

  return riskInfo[riskLevel] || riskInfo.low;
}

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 提交症状自查记录
 */
exports.main = async (event, context) => {
  const { petId, symptoms, description = '', openid } = event;

  try {
    // 1. 参数校验
    if (!openid) {
      return {
        code: RESPONSE_CODE.UNAUTHORIZED,
        msg: '用户未登录',
        data: {}
      };
    }

    if (!petId) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '请选择宠物',
        data: {}
      };
    }

    if (!symptoms || symptoms.length === 0) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '请至少选择一个症状',
        data: {}
      };
    }

    // 2. 获取宠物信息
    const petResult = await db.collection(COLLECTIONS.PETS).doc(petId).get();
    if (!petResult.data) {
      return {
        code: RESPONSE_CODE.NOT_FOUND,
        msg: '宠物信息不存在',
        data: {}
      };
    }

    const petInfo = petResult.data;
    // 验证宠物是否属于当前用户
    if (petInfo.user_id !== openid) {
      return {
        code: RESPONSE_CODE.UNAUTHORIZED,
        msg: '无权操作此宠物信息',
        data: {}
      };
    }

    // 3. 调用规则引擎评估风险
    const evaluationResult = evaluateRisk(symptoms, {
      species: petInfo.type,
      ageMonths: petInfo.age
    });

    // 4. 获取风险显示信息
    const riskDisplayInfo = getRiskDisplayInfo(evaluationResult.riskLevel);

    // 5. 保存自查记录到数据库
    const recordData = {
      user_id: openid,
      pet_id: petId,
      pet_info: {
        name: petInfo.name,
        type: petInfo.type,
        breed: petInfo.breed,
        age: petInfo.age
      },
      symptoms: symptoms,
      symptom_names: symptoms,
      description: description,
      risk_level: evaluationResult.riskLevel,
      matched_rule: evaluationResult.matchedRule,
      action: evaluationResult.action,
      ai_response: null,
      report_paid: false,
      report_url: null,
      created_at: new Date()
    };

    const insertResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS).add({
      data: recordData
    });

    // 6. 返回评估结果
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '评估完成',
      data: {
        recordId: insertResult._id,
        riskLevel: evaluationResult.riskLevel,
        riskDisplayInfo: riskDisplayInfo,
        matchedRule: evaluationResult.matchedRule,
        action: evaluationResult.action,
        petInfo: {
          name: petInfo.name,
          type: petInfo.type
        },
        createdAt: recordData.created_at
      }
    };

  } catch (error) {
    console.error('提交症状评估失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {
        error: error.message
      }
    };
  }
};