// 管理后台配置 — ES Module

export const TCB_CONFIG = {
  env: 'cloud1-d8gdi44zqfec250b5'
};

export const CLOUD_FUNCTIONS = {
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

export const TOAST_DISPLAY_DURATION = 3000;

export const PAGINATION = {
  defaultPageSize: 20,
  pageSizes: [10, 20, 50, 100]
};

export const STATUS_MAP = {
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

export const CATEGORY_MAP = {
  digestive: '消化系统',
  respiratory: '呼吸系统',
  behavior: '行为异常',
  prevention: '预防保健',
  care: '特殊阶段'
};

export const ORDER_TYPE_MAP = {
  report: '报告订单',
  member_monthly: '个人月卡',
  member_yearly: '个人年卡',
  member_family_monthly: '家庭月卡',
  member_family_yearly: '家庭年卡',
  member: '会员订单',
  points: '点数包',
  bundle: '组合套餐',
};

export const REFUND_STATUS_MAP = {
  pending: { text: '待审核', class: 'badge-warning' },
  approved: { text: '已批准', class: 'badge-info' },
  rejected: { text: '已拒绝', class: 'badge-danger' },
  completed: { text: '已完成', class: 'badge-success' },
};

export const COUPON_SCENE_MAP = {
  new_user: '新用户',
  invite: '邀请奖励',
  followup: '回访奖励',
  renew: '续费召回',
  return: '流失回归',
  invite_milestone_5: '邀请5人',
};

export const MEMBER_TYPE_MAP = {
  monthly: '个人月卡',
  yearly: '个人年卡',
  family_monthly: '家庭月卡',
  family_yearly: '家庭年卡',
  trial: '体验会员',
};
