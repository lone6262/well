/**
 * 管理后台配置文件
 * 请在使用前修改环境ID
 */

// 云开发环境配置
const TCB_CONFIG = {
  env: 'cloud1-d8gdi44zqfec250b5'
};

// 云函数名称配置
const CLOUD_FUNCTIONS = {
  adminLogin: 'adminLogin',
  adminGetUsers: 'adminGetUsers',
  adminGetOrders: 'adminGetOrders',
  adminUpdateOrder: 'adminUpdateOrder',
  adminGetArticles: 'adminGetArticles',
  adminSaveArticle: 'adminSaveArticle',
  adminDeleteArticle: 'adminDeleteArticle',
  adminGetStats: 'adminGetStats',
  adminGetConfig: 'adminGetConfig',
  adminUpdateConfig: 'adminUpdateConfig',
  // V1.5 新增
  adminGetRefunds: 'adminGateway',
  adminProcessRefund: 'adminGateway',
  adminGetCoupons: 'adminGateway',
  adminSaveCoupon: 'adminGateway',
  adminGetMembers: 'adminGateway',
  adminGetBills: 'adminGateway',
  adminRunBillCheck: 'adminGateway',
  adminGetRiskAlerts: 'adminGateway',
  adminReviewOrder: 'adminGateway',
};

// UI 常量
const TOAST_DISPLAY_DURATION = 3000;

// 分页配置
const PAGINATION = {
  defaultPageSize: 20,
  pageSizes: [10, 20, 50, 100]
};

// 状态映射
const STATUS_MAP = {
  order: {
    pending: { text: '待支付', class: 'badge-warning' },
    paid: { text: '已支付', class: 'badge-success' },
    refunded: { text: '已退款', class: 'badge-danger' },
    failed: { text: '失败', class: 'badge-danger' },
    closed: { text: '已关闭', class: 'badge-gray' }
  },
  article: {
    draft: { text: '草稿', class: 'badge-gray' },
    published: { text: '已发布', class: 'badge-success' },
    archived: { text: '已归档', class: 'badge-warning' }
  },
  member: {
    active: { text: '会员', class: 'badge-success' },
    expired: { text: '已过期', class: 'badge-gray' }
  }
};

// 分类映射
const CATEGORY_MAP = {
  digestive: '消化系统',
  respiratory: '呼吸系统',
  behavior: '行为异常',
  prevention: '预防保健',
  care: '特殊阶段'
};

// 订单类型映射
const ORDER_TYPE_MAP = {
  report: '报告订单',
  member_monthly: '个人月卡',
  member_yearly: '个人年卡',
  member_family_monthly: '家庭月卡',
  member_family_yearly: '家庭年卡',
  member: '会员订单',
  points: '点数包',
  bundle: '组合套餐',
};

// 退款状态映射
const REFUND_STATUS_MAP = {
  pending: { text: '待审核', class: 'badge-warning' },
  approved: { text: '已批准', class: 'badge-info' },
  rejected: { text: '已拒绝', class: 'badge-danger' },
  completed: { text: '已完成', class: 'badge-success' },
};

// 优惠券场景映射
const COUPON_SCENE_MAP = {
  new_user: '新用户',
  invite: '邀请奖励',
  followup: '回访奖励',
  renew: '续费召回',
  return: '流失回归',
  invite_milestone_5: '邀请5人',
};

// 会员类型映射
const MEMBER_TYPE_MAP = {
  monthly: '个人月卡',
  yearly: '个人年卡',
  family_monthly: '家庭月卡',
  family_yearly: '家庭年卡',
  trial: '体验会员',
};
