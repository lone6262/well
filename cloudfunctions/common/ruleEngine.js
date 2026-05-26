// 规则引擎配置 - 基于用户提供的风险等级规则
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
 * @param {Array<string>} symptomIds - 用户选择的症状key数组
 * @param {Object} petInfo - 宠物信息 { species, ageMonths }
 * @returns {Object} 评估结果 { riskLevel, matchedRule, action }
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
 * @param {string} riskLevel - 风险等级 (low/mid/high)
 * @returns {Object} 显示信息 { color, icon, title, description }
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

module.exports = {
  evaluateRisk,
  getRiskDisplayInfo,
  riskRules
};