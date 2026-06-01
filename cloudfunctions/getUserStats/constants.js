/**
 * 常量定义文件
 * 用于云函数和前端共享的常量配置
 */

// 宠物类型
const PET_TYPES = {
  CAT: 'cat',
  DOG: 'dog',
  OTHER: 'other'
};

// 宠物类型显示名称
const PET_TYPE_NAMES = {
  cat: '猫',
  dog: '狗',
  other: '其他'
};

// 风险等级
const RISK_LEVELS = {
  LOW: 'low',
  MID: 'mid',
  HIGH: 'high'
};

// 订单状态
const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded'
};

// 订单类型
const ORDER_TYPES = {
  REPORT: 'report',
  MEMBER: 'member'
};

// 会员到期时间（天）
const MEMBER_DURATION = {
  MONTH: 30,    // 月卡
  QUARTER: 90,  // 季卡
  YEAR: 365     // 年卡
};

// 数据库集合名称
const COLLECTIONS = {
  USERS: 'users',
  PETS: 'pets',
  SYMPTOM_RECORDS: 'symptom_records',
  AI_CACHE: 'ai_cache',
  ORDERS: 'orders',
  HOSPITALS: 'hospitals'
};

// API响应码
const RESPONSE_CODE = {
  SUCCESS: 0,
  ERROR: -1,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};

// 免责声明文案
const DISCLAIMERS = {
  LAUNCH_PAGE: `重要提示

本工具仅为宠物健康风险评估参考，不能替代执业兽医的专业诊断与治疗。如宠物出现严重症状，请立即前往线下宠物医院就诊。

使用本工具即表示您已阅读并同意 [用户协议] 与 [隐私政策]。`,

  RESULT_PAGE: `免责声明

本评估结果基于您提供的症状信息，由规则引擎辅助生成，不能作为最终诊断依据。若宠物出现持续恶化、痛苦加剧或高风险提示，请务必及时就医。`,

  REPORT_PAGE: `医学免责

本报告由 AI 根据公开医学资料及平台知识库生成，仅供参考，不具备医疗诊断效力。所有治疗决策请咨询执业兽医师。平台不承担因依赖本报告而产生的任何法律责任。`
};

// 年龄阈值（月）
const AGE_THRESHOLD = {
  KITTEN: 2,        // 幼猫 < 2个月
  PUPPY: 2,         // 幼犬 < 2个月
  SENIOR_CAT: 144,  // 老年猫 > 12年
  SENIOR_DOG: 120   // 老年犬 > 10年
};

// 症状部位分类（用于前端显示）
const SYMPTOM_CATEGORIES = [
  {
    name: "消化系统",
    symptoms: [
      { label: "呕吐", key: "呕吐" },
      { label: "腹泻", key: "腹泻" },
      { label: "便秘", key: "便秘" },
      { label: "食欲不振", key: "食欲不振" }
    ]
  },
  {
    name: "呼吸系统",
    symptoms: [
      { label: "咳嗽", key: "咳嗽" },
      { label: "打喷嚏", key: "打喷嚏" },
      { label: "呼吸困难", key: "呼吸困难" }
    ]
  },
  {
    name: "泌尿系统",
    symptoms: [
      { label: "尿频", key: "尿频" },
      { label: "尿血", key: "尿血" },
      { label: "排尿困难", key: "排尿困难" }
    ]
  },
  {
    name: "皮肤/被毛",
    symptoms: [
      { label: "瘙痒", key: "瘙痒" },
      { label: "脱毛", key: "脱毛" },
      { label: "皮疹/红肿", key: "皮疹/红肿" }
    ]
  },
  {
    name: "眼部",
    symptoms: [
      { label: "流泪/眼屎多", key: "流泪/眼屎多" },
      { label: "眼睛红肿", key: "眼睛红肿" }
    ]
  },
  {
    name: "耳部",
    symptoms: [
      { label: "耳垢多/异味", key: "耳垢多/异味" },
      { label: "甩头/抓耳", key: "甩头/抓耳" }
    ]
  },
  {
    name: "神经/行为",
    symptoms: [
      { label: "抽搐", key: "抽搐" },
      { label: "精神萎靡", key: "精神萎靡" }
    ]
  },
  {
    name: "口腔",
    symptoms: [
      { label: "流口水", key: "流口水" },
      { label: "牙龈红肿/出血", key: "牙龈红肿/出血" }
    ]
  }
];

module.exports = {
  PET_TYPES,
  PET_TYPE_NAMES,
  RISK_LEVELS,
  ORDER_STATUS,
  ORDER_TYPES,
  MEMBER_DURATION,
  COLLECTIONS,
  RESPONSE_CODE,
  DISCLAIMERS,
  AGE_THRESHOLD,
  SYMPTOM_CATEGORIES
};