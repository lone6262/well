/**
 * 常量定义文件
 * 用于云函数和前端共享的常量配置
 */

// 宠物类型
const PET_TYPES = {
  CAT: 'cat',
  DOG: 'dog',
  OTHER: 'other',
};

// 宠物类型显示名称
const PET_TYPE_NAMES = {
  cat: '猫',
  dog: '狗',
  other: '其他',
};

// 风险等级
const RISK_LEVELS = {
  LOW: 'low',
  MID: 'mid',
  HIGH: 'high',
};

// 订单状态
const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUND_REQUESTED: 'refund_requested',
  REFUNDED: 'refunded',
  FAILED: 'failed',
  CLOSED: 'closed',
};

// 订单类型
const ORDER_TYPES = {
  REPORT: 'report',
  MEMBER: 'member',
  MEMBER_MONTHLY: 'member_monthly',
  MEMBER_YEARLY: 'member_yearly',
  MEMBER_FAMILY_MONTHLY: 'member_family_monthly',
  MEMBER_FAMILY_YEARLY: 'member_family_yearly',
  POINTS: 'points',
  BUNDLE: 'bundle',
};

// 会员到期时间（天）
const MEMBER_DURATION = {
  MONTH: 30, // 月卡
  QUARTER: 90, // 季卡
  YEAR: 365, // 年卡
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
  FOOD_SAFETY: 'food_safety', // V2.0 food safety DB
  KNOWLEDGE_ARTICLES: 'knowledge_articles',
  INVITE_RECORDS: 'invite_records',
  FOLLOWUP_RECORDS: 'followup_records',
  REPORT_TEMPLATES: 'report_templates',
  SYSTEM_CONFIG: 'system_config',
  // V1.5 新增
  REFUND_RECORDS: 'refund_records',
  USER_POINTS: 'user_points',
  POINT_TRANSACTIONS: 'point_transactions',
  USER_COUPONS: 'user_coupons',
  COUPONS: 'coupons',
  MEMBER_RENEW_LOG: 'member_renew_log',
  BILL_CHECK_LOGS: 'bill_check_logs',
  ANALYTICS_EVENTS: 'analytics_events',
  ERROR_LOGS: 'error_logs',
};

// API响应码
const RESPONSE_CODE = {
  SUCCESS: 0,
  ERROR: -1,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

// 免责声明文案
const DISCLAIMERS = {
  LAUNCH_PAGE: `重要提示

本工具仅为宠物健康风险评估参考，不能替代执业兽医的专业诊断与治疗。如宠物出现严重症状，请立即前往线下宠物医院就诊。

使用本工具即表示您已阅读并同意 [用户协议] 与 [隐私政策]。`,

  RESULT_PAGE: `免责声明

本评估结果基于您提供的症状信息，由规则引擎辅助生成，不能作为最终诊断依据。若宠物出现持续恶化、痛苦加剧或高风险提示，请务必及时就医。`,

  REPORT_PAGE: `医学免责

本报告由 AI 根据公开医学资料及平台知识库生成，仅供参考，不具备医疗诊断效力。所有治疗决策请咨询执业兽医师。平台不承担因依赖本报告而产生的任何法律责任。`,
};

// 年龄阈值（月）
const AGE_THRESHOLD = {
  KITTEN: 2, // 幼猫 < 2个月
  PUPPY: 2, // 幼犬 < 2个月
  SENIOR_CAT: 144, // 老年猫 > 12年
  SENIOR_DOG: 120, // 老年犬 > 10年
};

// 症状部位分类（用于前端显示）
const SYMPTOM_CATEGORIES = [
  {
    name: '消化系统',
    symptoms: [
      { label: '呕吐', key: '呕吐' },
      { label: '腹泻', key: '腹泻' },
      { label: '便秘', key: '便秘' },
      { label: '食欲不振', key: '食欲不振' },
    ],
  },
  {
    name: '呼吸系统',
    symptoms: [
      { label: '咳嗽', key: '咳嗽' },
      { label: '打喷嚏', key: '打喷嚏' },
      { label: '呼吸困难', key: '呼吸困难' },
    ],
  },
  {
    name: '泌尿系统',
    symptoms: [
      { label: '尿频', key: '尿频' },
      { label: '尿血', key: '尿血' },
      { label: '排尿困难', key: '排尿困难' },
    ],
  },
  {
    name: '皮肤/被毛',
    symptoms: [
      { label: '瘙痒', key: '瘙痒' },
      { label: '脱毛', key: '脱毛' },
      { label: '皮疹/红肿', key: '皮疹/红肿' },
    ],
  },
  {
    name: '眼部',
    symptoms: [
      { label: '流泪/眼屎多', key: '流泪/眼屎多' },
      { label: '眼睛红肿', key: '眼睛红肿' },
    ],
  },
  {
    name: '耳部',
    symptoms: [
      { label: '耳垢多/异味', key: '耳垢多/异味' },
      { label: '甩头/抓耳', key: '甩头/抓耳' },
    ],
  },
  {
    name: '神经/行为',
    symptoms: [
      { label: '抽搐', key: '抽搐' },
      { label: '精神萎靡', key: '精神萎靡' },
    ],
  },
  {
    name: '口腔',
    symptoms: [
      { label: '流口水', key: '流口水' },
      { label: '牙龈红肿/出血', key: '牙龈红肿/出血' },
    ],
  },
];

// 所有合法症状ID白名单（用于云函数端输入验证）
const VALID_SYMPTOM_IDS = [
  // 消化系统
  'vomit',
  'diarrhea',
  'constipation',
  'loss_appetite',
  // 呼吸系统
  'cough',
  'sneeze',
  'dyspnea',
  // 泌尿系统
  'frequent_urination',
  'hematuria',
  'difficulty_urination',
  // 皮肤/被毛
  'itch',
  'hair_loss',
  'redness',
  // 眼部
  'tearing',
  'eye_redness',
  // 耳部
  'ear_odor',
  'head_shake',
  // 神经/行为
  'seizure',
  'lethargy',
  // 口腔
  'drool',
  'gum_redness',
  // 高风险熔断词（部分未出现在前端UI但在规则引擎中引用）
  'coma',
  'bleeding',
  'paralysis',
  'collapse',
  'cyanosis',
];

// VALID_SYMPTOM_IDS 的 Set 版本，用于 O(1) 白名单查找
const VALID_SYMPTOM_SET = new Set(VALID_SYMPTOM_IDS);

// === V1.5 新增常量 ===

// 会员状态
const MEMBER_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

// 报告来源
const REPORT_SOURCE = {
  TEMPLATE: 'template',
  LLM: 'llm',
  CACHE: 'cache',
};

// 缓存 TTL（毫秒）
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

// 知识文章状态
const ARTICLE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

// 回访状态
const FOLLOWUP_STATUS = {
  PENDING: 'pending',
  IMPROVED: 'improved',
  NO_CHANGE: 'no_change',
  WORSENED: 'worsened',
};

// 价格（单位：分）
const PRICES = {
  // === AI 报告 ===
  FIRST_REPORT: 0, // 新用户首份免费
  STANDARD_REPORT: 990, // 标准报告 ¥9.90

  // === 个人会员 ===
  MEMBER_MONTHLY: 1990, // 个人月卡 ¥19.90
  MEMBER_YEARLY: 9900, // 个人年卡 ¥99.00

  // === 家庭会员 ===
  MEMBER_FAMILY_MONTHLY: 2990, // 家庭月卡 ¥29.90
  MEMBER_FAMILY_YEARLY: 19900, // 家庭年卡 ¥199.00

  // === 续费价格（非首充） ===
  RENEW_MONTHLY: 1590, // 月卡续费 ¥15.90
  RENEW_YEARLY: 8900, // 年卡续费 ¥89.00
  RENEW_FAMILY_MONTHLY: 2590, // 家庭月卡续费 ¥25.90
  RENEW_FAMILY_YEARLY: 17900, // 家庭年卡续费 ¥179.00

  // === 点数包 ===
  POINTS_PACK_3: 1990, // 3 次包 ¥19.90
  POINTS_PACK_5: 2990, // 5 次包 ¥29.90

  // === 组合套餐 ===
  BUNDLE_STARTER: 2990, // 新手礼包 ¥29.90（月卡+3次包）
  BUNDLE_ESSENTIAL: 11900, // 铲屎官必备 ¥119（年卡+5次包）
  BUNDLE_FAMILY: 3990, // 家庭尊享 ¥39.90（家庭月卡+3次包）

  // === 大额订单审核阈值 ===
  MANUAL_REVIEW_THRESHOLD: 9900, // ≥¥99 触发人工审核
};

// 会员额度
const MEMBER_CREDITS = {
  MONTHLY_REPORTS: 3, // 个人月卡每月 3 次
  YEARLY_REPORTS: 3, // 个人年卡每月 3 次
  FAMILY_MONTHLY_REPORTS: 6, // 家庭月卡每月 6 次
  FAMILY_YEARLY_REPORTS: 6, // 家庭年卡每月 6 次
  TRIAL_REPORTS: 1, // 体验会员每月 1 次
};

// 点数包规格
const POINTS_PACKS = {
  PACK_3: { count: 3, price: 1990, expire_days: 90 },
  PACK_5: { count: 5, price: 2990, expire_days: 90 },
};

// 组合套餐定义
const BUNDLES = {
  STARTER: {
    name: '新手礼包',
    items: [
      { type: 'member', tier: 'monthly' },
      { type: 'points', pack: 'PACK_3' },
    ],
    price: 2990,
    origin_price: 3980,
  },
  ESSENTIAL: {
    name: '铲屎官必备',
    items: [
      { type: 'member', tier: 'yearly' },
      { type: 'points', pack: 'PACK_5' },
    ],
    price: 11900,
    origin_price: 12890,
  },
  FAMILY: {
    name: '家庭尊享',
    items: [
      { type: 'member', tier: 'family_monthly' },
      { type: 'points', pack: 'PACK_3' },
    ],
    price: 3990,
    origin_price: 4980,
  },
};

// 会员限制
const MEMBER_LIMITS = {
  MAX_PETS_PERSONAL: 3,
  MAX_PETS_FAMILY: 5,
  MAX_FAMILY_MEMBERS: 4,
  TRIAL_DURATION_DAYS: 7,
  TRIAL_COOLDOWN_DAYS: 30,
};

// 支付超时（分钟）
const PAYMENT_TIMEOUT = 30;

// 知识文章分类
const KNOWLEDGE_CATEGORIES = {
  DIGESTIVE: 'digestive',
  RESPIRATORY: 'respiratory',
  BEHAVIOR: 'behavior',
  PREVENTION: 'prevention',
  CARE: 'care',
};

// 食物安全等级（V2.0）
const SAFETY_LEVELS = {
  SAFE: 'safe',
  CAUTION: 'caution',
  DANGER: 'danger',
};

// 年龄段
const AGE_RANGES = {
  YOUNG: 'young', // 幼宠
  ADULT: 'adult', // 成年
  SENIOR: 'senior', // 老年
};

// === 时间常量（毫秒）===
const TIME = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  CACHE_5MIN: 5 * 60 * 1000,
  CACHE_30MIN: 30 * 60 * 1000,
};

// === AI 模型配置 ===
const AI_CONFIG = {
  TEMPERATURE: 0.7, // 生成温度
  MAX_TOKENS: 4000, // 最大令牌数
  TIMEOUT_MS: 30000, // 请求超时（30秒）
  API_PORT: 443, // API端口
  CACHE_CLEANUP_PROBABILITY: 0.01, // 缓存清理概率（1%）
};

// === 地图搜索配置 ===
const MAP_SEARCH = {
  EARTH_RADIUS: 6371000, // 地球半径（米）
  DEFAULT_RADIUS: 5000, // 默认搜索半径 5 公里
  PAGE_SIZE: 20, // 腾讯地图 API 每页结果数
  TIMEOUT_MS: 10000, // HTTP 请求超时（10秒）
};

// === 排行榜配置 ===
const RANKING_CONFIG = {
  TOP_N: 20, // Top N 排行
  BATCH_SIZE: 100, // 批量查询大小
  MAX_QUERY_LIMIT: 100, // 最大查询限制
};

// === 限流配置 ===
const RATE_LIMIT = {
  WINDOW_MS: 60000, // 时间窗口（1分钟）
  MAX_REQUESTS: 10, // 最大请求数
  DAILY_MAX_INVITES: 50, // 每日最大邀请数
};

// === V1.5 Phase 4 邀请系统常量 ===

// 邀请状态
const INVITE_STATUS = {
  PENDING: 'pending', // 被邀请人尚未完成首次自查
  REWARDED: 'rewarded', // 双方已获得奖励
  EXPIRED: 'expired', // 超过7天未完成自查
};

// 邀请奖励配置
const INVITE_CONFIG = {
  REWARD_CREDITS: 1, // 每次成功邀请奖励的报告额度
  TRIAL_THRESHOLD: 3, // 邀请3人获得7天体验
  TRIAL_DAYS: 7, // 体验天数
  MAX_REWARDS_PER_MONTH: 10, // 每人每月最多10次奖励
  MAX_INVITES_PER_DAY: 50, // 每人每天最多50次邀请
  EXPIRE_DAYS: 7, // 邀请过期天数
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
  token_secret: 'TOKEN_SECRET',
  tencent_map_key: 'TENCENT_MAP_KEY',
  deepseek_api_key: 'DEEPSEEK_API_KEY',
  deepseek_base_url: 'DEEPSEEK_BASE_URL',
  deepseek_model: 'DEEPSEEK_MODEL',
  admin_secret: 'ADMIN_SECRET',
};

// SERVER_CONFIG 初始全空 — 依赖 warmupConfig(db) 从数据库填充
const SERVER_CONFIG = {
  TOKEN_SECRET: '',
  TENCENT_MAP_KEY: '',
  DEEPSEEK_API_KEY: '',
  DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
  DEEPSEEK_MODEL: 'deepseek-chat',
  ADMIN_SECRET: '',
};

// 是否已从数据库加载过配置
let _configWarmedUp = false;
let _warmupPromise = null;

// 是否已从数据库加载过价格配置
let _pricesLoaded = false;
let _dbPrices = null;

/** 价格 DB key → PRICES/MEMBER_CREDITS 属性名映射 */
const PRICE_DB_KEY_MAP = {
  first_report: 'FIRST_REPORT',
  standard_report: 'STANDARD_REPORT',
  member_monthly: 'MEMBER_MONTHLY',
  member_yearly: 'MEMBER_YEARLY',
  member_family_monthly: 'MEMBER_FAMILY_MONTHLY',
  member_family_yearly: 'MEMBER_FAMILY_YEARLY',
  renew_monthly: 'RENEW_MONTHLY',
  renew_yearly: 'RENEW_YEARLY',
  renew_family_monthly: 'RENEW_FAMILY_MONTHLY',
  renew_family_yearly: 'RENEW_FAMILY_YEARLY',
  monthly_reports: 'MONTHLY_REPORTS',
  yearly_reports: 'YEARLY_REPORTS',
  family_monthly_reports: 'FAMILY_MONTHLY_REPORTS',
  family_yearly_reports: 'FAMILY_YEARLY_REPORTS',
  trial_reports: 'TRIAL_REPORTS',
};

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
    return;
  }

  _warmupPromise = (async () => {
    try {
      // 超时保护：数据库查询超过 3 秒则放弃
      const queryPromise = db
        .collection('system_config')
        .where({
          key: db.command.in(Object.keys(CONFIG_KEY_MAP)),
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

      // 验证必需字段是否加载成功
      const requiredFields = ['TOKEN_SECRET'];
      const missingFields = requiredFields.filter(function (field) {
        return !SERVER_CONFIG[field];
      });
      if (missingFields.length > 0) {
        console.error(
          '[constants] 必需配置缺失:',
          missingFields.join(', '),
          '— 部分功能可能不可用'
        );
      }

      _configWarmedUp = true;
    } catch (e) {
      console.error('[constants] system_config 查询失败，服务可能不可用:', e.message);
      // 失败时不标记 _configWarmedUp，允许下次调用重试
    }
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

/**
 * 从数据库 system_config 加载价格配置
 * 以 DB 值为准，未配置的 key 回退到 PRICES/MEMBER_CREDITS 硬编码默认值
 * 幂等操作 — 多次调用只执行一次数据库查询
 *
 * @param {object} db — cloud.database() 实例
 * @returns {object} { prices: {...}, memberCredits: {...} }
 */
async function loadPrices(db, opts) {
  const forceReload = opts && opts.forceReload;
  if (!forceReload && _pricesLoaded && _dbPrices) return _dbPrices;
  if (!db) {
    _pricesLoaded = true;
    _dbPrices = {
      prices: Object.assign({}, PRICES),
      memberCredits: Object.assign({}, MEMBER_CREDITS),
    };
    return _dbPrices;
  }

  // 复用 warmupConfig 的 promise 机制，避免并发重复查询
  try {
    const queryPromise = db
      .collection('system_config')
      .where({
        key: db.command.in(Object.keys(PRICE_DB_KEY_MAP)),
      })
      .get();

    const timeoutPromise = new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('loadPrices 数据库查询超时'));
      }, WARMUP_TIMEOUT_MS);
    });

    const { data } = await Promise.race([queryPromise, timeoutPromise]);

    // 以硬编码值为基准
    const mergedPrices = Object.assign({}, PRICES);
    const mergedCredits = Object.assign({}, MEMBER_CREDITS);

    if (data && data.length > 0) {
      for (const item of data) {
        const propName = PRICE_DB_KEY_MAP[item.key];
        if (propName && item.value != null) {
          const numValue = parseInt(item.value, 10);
          if (!isNaN(numValue) && numValue >= 0) {
            // 判断属于 PRICES 还是 MEMBER_CREDITS
            if (
              propName === 'MONTHLY_REPORTS' ||
              propName === 'YEARLY_REPORTS' ||
              propName === 'FAMILY_MONTHLY_REPORTS' ||
              propName === 'FAMILY_YEARLY_REPORTS' ||
              propName === 'TRIAL_REPORTS'
            ) {
              mergedCredits[propName] = numValue;
            } else {
              mergedPrices[propName] = numValue;
            }
          }
        }
      }
      console.log(`[constants] ✅ 已从数据库加载 ${data.length} 项价格配置`);
    }
    _dbPrices = { prices: mergedPrices, memberCredits: mergedCredits };
    _pricesLoaded = true;
    return _dbPrices;
  } catch (e) {
    console.warn('[constants] 价格配置查询失败，使用硬编码默认值:', e.message);
    _dbPrices = {
      prices: Object.assign({}, PRICES),
      memberCredits: Object.assign({}, MEMBER_CREDITS),
    };
    // 失败时不标记 _pricesLoaded，允许数据库恢复后重新加载
    return _dbPrices;
  }
}

/**
 * 重置价格加载状态（仅用于测试 / 配置变更后强制刷新）
 */
function resetPrices() {
  _pricesLoaded = false;
  _dbPrices = null;
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
  POINTS_PACKS,
  BUNDLES,
  MEMBER_LIMITS,
  PAYMENT_TIMEOUT,
  KNOWLEDGE_CATEGORIES,
  SAFETY_LEVELS,
  AGE_RANGES,
  // 时间常量
  TIME,
  // AI 配置
  AI_CONFIG,
  // 地图搜索配置
  MAP_SEARCH,
  // 排行榜配置
  RANKING_CONFIG,
  // 限流配置
  RATE_LIMIT,
  // Phase 4 新增
  INVITE_STATUS,
  INVITE_CONFIG,
  // 服务端密钥
  SERVER_CONFIG,
  warmupConfig,
  loadPrices,
  resetPrices,
};
