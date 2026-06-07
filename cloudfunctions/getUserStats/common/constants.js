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
  REFUNDED: 'refunded',
  FAILED: 'failed',
  CLOSED: 'closed'
};

// 订单类型
const ORDER_TYPES = {
  REPORT: 'report',
  MEMBER: 'member',
  MEMBER_MONTHLY: 'member_monthly',
  MEMBER_YEARLY: 'member_yearly'
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
  HOSPITALS: 'hospitals',
  MEMBERS: 'members',
  KNOWLEDGE_ARTICLES: 'knowledge_articles',
  INVITE_RECORDS: 'invite_records',
  FOLLOWUP_RECORDS: 'followup_records',
  REPORT_TEMPLATES: 'report_templates',
  SYSTEM_CONFIG: 'system_config'
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

// 所有合法症状ID白名单（用于云函数端输入验证）
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
  // 高风险熔断词（部分未出现在前端UI但在规则引擎中引用）
  'coma', 'bleeding', 'paralysis', 'collapse', 'cyanosis'
];

// VALID_SYMPTOM_IDS 的 Set 版本，用于 O(1) 白名单查找
const VALID_SYMPTOM_SET = new Set(VALID_SYMPTOM_IDS);

// === V1.5 新增常量 ===

// 会员状态
const MEMBER_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
};

// 报告来源
const REPORT_SOURCE = {
  TEMPLATE: 'template',
  LLM: 'llm',
  CACHE: 'cache'
};

// 缓存 TTL（毫秒）
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

// 知识文章状态
const ARTICLE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

// 回访状态
const FOLLOWUP_STATUS = {
  PENDING: 'pending',
  IMPROVED: 'improved',
  NO_CHANGE: 'no_change',
  WORSENED: 'worsened'
};

// 价格（单位：分）
const PRICES = {
  FIRST_REPORT: 100,       // 新用户首份 ¥1.00
  STANDARD_REPORT: 990,    // 标准报告 ¥9.90
  MEMBER_MONTHLY: 1990,    // 月卡 ¥19.90
  MEMBER_YEARLY: 9900      // 年卡 ¥99.00
};

// 会员额度
const MEMBER_CREDITS = {
  MONTHLY_REPORTS: 5,      // 月卡每月5次AI报告
  YEARLY_REPORTS: 15       // 年卡每月15次AI报告
};

// 支付超时（分钟）
const PAYMENT_TIMEOUT = 30;

// 知识文章分类
const KNOWLEDGE_CATEGORIES = {
  DIGESTIVE: 'digestive',
  RESPIRATORY: 'respiratory',
  BEHAVIOR: 'behavior',
  PREVENTION: 'prevention',
  CARE: 'care'
};

// 年龄段
const AGE_RANGES = {
  YOUNG: 'young',     // 幼宠
  ADULT: 'adult',     // 成年
  SENIOR: 'senior'    // 老年
};

// === 时间常量（毫秒）===
const TIME = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  CACHE_5MIN: 5 * 60 * 1000,
  CACHE_30MIN: 30 * 60 * 1000
};

// === V1.5 Phase 4 邀请系统常量 ===

// 邀请状态
const INVITE_STATUS = {
  PENDING: 'pending',       // 被邀请人尚未完成首次自查
  REWARDED: 'rewarded',     // 双方已获得奖励
  EXPIRED: 'expired'        // 超过7天未完成自查
};

// 邀请奖励配置
const INVITE_CONFIG = {
  REWARD_CREDITS: 1,           // 每次成功邀请奖励的报告额度
  TRIAL_THRESHOLD: 3,          // 邀请3人获得7天体验
  TRIAL_DAYS: 7,               // 体验天数
  MAX_REWARDS_PER_MONTH: 10,   // 每人每月最多10次奖励
  MAX_INVITES_PER_DAY: 50,     // 每人每天最多50次邀请
  EXPIRE_DAYS: 7               // 邀请过期天数
};

// ============================================
// 服务端密钥配置（仅云函数可见，不会暴露到前端）
//
// 密钥加载策略：
//   唯一来源 — 数据库 system_config 集合
//   首次部署需调用 dbInit 传入所有密钥写入数据库
//
// 使用方式：
//   const { SERVER_CONFIG, warmupConfig } = require('./common/constants');
//   exports.main = async (event, context) => {
//     await warmupConfig(db);  // ← 每个云函数入口加这一行
//     // ... 正常使用 SERVER_CONFIG.TOKEN_SECRET 等
//   };
//
// 注意：warmupConfig 之前 SERVER_CONFIG 全为空，
// 调用 dbInit 之前所有云函数会因为缺密钥而拒绝服务。
// ============================================

// 密钥 key 映射：数据库 key → SERVER_CONFIG 属性名
const CONFIG_KEY_MAP = {
  'token_secret':     'TOKEN_SECRET',
  'tencent_map_key':  'TENCENT_MAP_KEY',
  'deepseek_api_key': 'DEEPSEEK_API_KEY',
  'deepseek_base_url':'DEEPSEEK_BASE_URL',
  'deepseek_model':   'DEEPSEEK_MODEL',
  'admin_secret':     'ADMIN_SECRET'
};

// SERVER_CONFIG 初始全空 — 依赖 warmupConfig(db) 从数据库填充
const SERVER_CONFIG = {
  TOKEN_SECRET: '',
  TENCENT_MAP_KEY: '',
  DEEPSEEK_API_KEY: '',
  DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
  DEEPSEEK_MODEL: 'deepseek-chat',
  ADMIN_SECRET: ''
};

// 是否已从数据库加载过配置
let _configWarmedUp = false;
let _warmupPromise = null;

/** warmupConfig 数据库查询超时时间（毫秒） */
const WARMUP_TIMEOUT_MS = 3000;

/**
 * 从数据库 system_config 刷新密钥到 SERVER_CONFIG
 * 幂等操作 — 多次调用只执行一次数据库查询
 * 带有 3 秒超时保护，防止数据库故障阻塞所有云函数
 *
 * @param {object} db — cloud.database() 实例
 */
async function warmupConfig(db) {
  if (_configWarmedUp) return;
  if (_warmupPromise) return _warmupPromise;

  if (!db) {
    console.warn('[constants] db 未传入，无法加载配置，服务可能不可用');
    _configWarmedUp = true;
    return;
  }

  _warmupPromise = (async () => {
    try {
      // 超时保护：数据库查询超过 3 秒则放弃
      const queryPromise = db.collection('system_config')
        .where({
          key: db.command.in(Object.keys(CONFIG_KEY_MAP))
        })
        .get();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('warmupConfig 数据库查询超时')), WARMUP_TIMEOUT_MS)
      );

      const { data } = await Promise.race([queryPromise, timeoutPromise]);

      if (data && data.length > 0) {
        for (const item of data) {
          const propName = CONFIG_KEY_MAP[item.key];
          if (propName && item.value) {
            SERVER_CONFIG[propName] = item.value;
          }
        }
        console.log(`[constants] ✅ 已从数据库加载 ${data.length} 项配置`);
      } else {
        console.warn('[constants] system_config 无配置数据，服务可能不可用');
      }
    } catch (e) {
      console.error('[constants] system_config 查询失败，服务可能不可用:', e.message);
    }
    _configWarmedUp = true;
  })();

  return _warmupPromise;
}

/**
 * 重置配置加载状态（仅用于测试）
 */
function resetConfig() {
  _configWarmedUp = false;
  _warmupPromise = null;
}

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
  SYMPTOM_CATEGORIES,
  VALID_SYMPTOM_IDS,
  VALID_SYMPTOM_SET,
  // V1.5 新增
  MEMBER_STATUS,
  REPORT_SOURCE,
  CACHE_TTL,
  ARTICLE_STATUS,
  FOLLOWUP_STATUS,
  PRICES,
  MEMBER_CREDITS,
  PAYMENT_TIMEOUT,
  KNOWLEDGE_CATEGORIES,
  AGE_RANGES,
  // 时间常量
  TIME,
  // Phase 4 新增
  INVITE_STATUS,
  INVITE_CONFIG,
  // 服务端密钥
  SERVER_CONFIG,
  warmupConfig
};
