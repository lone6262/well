// 风控检查 — 在 createOrder 前调用
// 频率限制、大额审核、防刷量
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  ORDER_TYPES,
  PRICES,
  warmupConfig,
  loadPrices,
} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// === 风控阈值 ===
const RISK_LIMITS = {
  // 单用户每日限制
  DAILY_REPORT_ORDERS: 20,       // 每日 AI 报告下单上限
  DAILY_MEMBER_ORDERS: 5,        // 每日会员/点数包下单上限
  DAILY_TOTAL_ORDERS: 30,        // 每日总支付订单上限
  // 大额审核阈值
  MANUAL_REVIEW_THRESHOLD: PRICES.MANUAL_REVIEW_THRESHOLD, // ≥9900 分（¥99）
  // 邀请刷量阈值
  INVITE_BURST_THRESHOLD: 10,    // 1 小时内邀请 ≥10 人触发审核
  INVITE_BURST_WINDOW_MS: 60 * 60 * 1000,
};

/**
 * 风控检查入口
 *
 * @param {string} userId     - 用户 openid
 * @param {string} orderType  - 订单类型 (ORDER_TYPES 中的值)
 * @param {number} amount     - 订单金额（分）
 * @returns {object} { code, msg, data: { passed, reason, need_manual_review } }
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  // V2.0: 价格从 DB 动态加载，覆盖硬编码默认值
  const priceConfig = await loadPrices(db);
  Object.assign(PRICES, priceConfig.prices);
  RISK_LIMITS.MANUAL_REVIEW_THRESHOLD = PRICES.MANUAL_REVIEW_THRESHOLD;
  const { OPENID } = cloud.getWXContext();
  const { userId, orderType, amount } = event;

  const targetUserId = userId || OPENID;

  if (!targetUserId || !orderType) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '参数不完整',
      data: { passed: false, reason: 'missing_params' },
    };
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // === 1. 频率限制检查 ===
    const frequencyCheck = await checkFrequency(targetUserId, orderType, todayStart);
    if (!frequencyCheck.passed) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: frequencyCheck.reason,
        data: { passed: false, reason: frequencyCheck.reason },
      };
    }

    // === 2. 大额订单审核 ===
    let needManualReview = false;
    if (amount && amount >= RISK_LIMITS.MANUAL_REVIEW_THRESHOLD) {
      needManualReview = true;
    }

    // === 3. 支付刷量检测 ===
    const fraudCheck = await checkPaymentFraud(targetUserId, todayStart);
    if (!fraudCheck.passed) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '触发风控限制，请联系客服',
        data: { passed: false, reason: fraudCheck.reason },
      };
    }

    // === 4. 邀请刷量检测（仅检查邀请场景，由 processInviteReward 调用） ===
    if (event.checkInviteFraud) {
      const inviteCheck = await checkInviteFraud(targetUserId);
      if (!inviteCheck.passed) {
        return {
          code: RESPONSE_CODE.ERROR,
          msg: '邀请行为异常，已冻结奖励待人工审核',
          data: { passed: false, reason: inviteCheck.reason },
        };
      }
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '风控检查通过',
      data: {
        passed: true,
        need_manual_review: needManualReview,
      },
    };
  } catch (error) {
    console.error('[checkRiskControl] 风控检查异常:', error.message);
    // 风控异常时拒绝，遵循 fail-closed 原则防止绕过
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '风控服务暂时不可用，请稍后重试',
      data: { passed: false, reason: 'risk_control_error', error: error.message },
    };
  }
};

/**
 * 频率限制检查
 * 按订单类型统计用户今日下单数
 */
async function checkFrequency(userId, orderType, todayStart) {
  const baseQuery = {
    user_id: userId,
    created_at: _.gte(todayStart),
    status: _.in(['pending', 'paid']),
  };

  // 统计今日总订单数
  const totalResult = await db.collection(COLLECTIONS.ORDERS)
    .where(baseQuery)
    .count();

  if (totalResult.total >= RISK_LIMITS.DAILY_TOTAL_ORDERS) {
    console.warn(`[checkRiskControl] 用户 ${userId} 今日总订单超限: ${totalResult.total}`);
    return { passed: false, reason: '今日下单次数已达上限，请明天再试' };
  }

  // 按类型检查
  const isReportOrder = [ORDER_TYPES.REPORT].includes(orderType);
  const isMemberOrPointsOrder = [
    ORDER_TYPES.MEMBER,
    ORDER_TYPES.MEMBER_MONTHLY,
    ORDER_TYPES.MEMBER_YEARLY,
    ORDER_TYPES.MEMBER_FAMILY_MONTHLY,
    ORDER_TYPES.MEMBER_FAMILY_YEARLY,
    ORDER_TYPES.POINTS,
    ORDER_TYPES.BUNDLE,
  ].includes(orderType);

  if (isReportOrder) {
    const reportResult = await db.collection(COLLECTIONS.ORDERS)
      .where({
        ...baseQuery,
        type: ORDER_TYPES.REPORT,
      })
      .count();

    if (reportResult.total >= RISK_LIMITS.DAILY_REPORT_ORDERS) {
      console.warn(`[checkRiskControl] 用户 ${userId} 今日报告订单超限: ${reportResult.total}`);
      return { passed: false, reason: '今日报告下单次数已达上限' };
    }
  }

  if (isMemberOrPointsOrder) {
    const memberResult = await db.collection(COLLECTIONS.ORDERS)
      .where({
        ...baseQuery,
        type: _.in([
          ORDER_TYPES.MEMBER,
          ORDER_TYPES.MEMBER_MONTHLY,
          ORDER_TYPES.MEMBER_YEARLY,
          ORDER_TYPES.MEMBER_FAMILY_MONTHLY,
          ORDER_TYPES.MEMBER_FAMILY_YEARLY,
          ORDER_TYPES.POINTS,
          ORDER_TYPES.BUNDLE,
        ]),
      })
      .count();

    if (memberResult.total >= RISK_LIMITS.DAILY_MEMBER_ORDERS) {
      console.warn(`[checkRiskControl] 用户 ${userId} 今日会员/点数包订单超限: ${memberResult.total}`);
      return { passed: false, reason: '今日购买次数已达上限' };
    }
  }

  return { passed: true };
}

/**
 * 支付刷量检测
 * 检测短时间大量低价订单的异常模式
 */
async function checkPaymentFraud(userId, todayStart) {
  // 查询今日所有已完成支付的订单
  const paidOrders = await db.collection(COLLECTIONS.ORDERS)
    .where({
      user_id: userId,
      status: 'paid',
      created_at: _.gte(todayStart),
    })
    .limit(50)
    .get();

  if (!paidOrders.data || paidOrders.data.length === 0) {
    return { passed: true };
  }

  // 检测低价刷量：大量 ¥1 订单
  const lowPriceOrders = paidOrders.data.filter(o => (o.amount || 0) <= 100);
  if (lowPriceOrders.length >= 5) {
    console.warn(`[checkRiskControl] 用户 ${userId} 低价刷量嫌疑: ${lowPriceOrders.length} 笔`);
    return { passed: false, reason: 'payment_fraud_low_price' };
  }

  // 检测密集下单：5 分钟内 ≥10 笔
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentOrders = paidOrders.data.filter(o => new Date(o.created_at) >= fiveMinutesAgo);
  if (recentOrders.length >= 10) {
    console.warn(`[checkRiskControl] 用户 ${userId} 密集下单嫌疑: 5分钟内 ${recentOrders.length} 笔`);
    return { passed: false, reason: 'payment_fraud_burst' };
  }

  return { passed: true };
}

/**
 * 邀请刷量检测
 * 1 小时内邀请 ≥10 人 → 冻结奖励
 */
async function checkInviteFraud(userId) {
  const oneHourAgo = new Date(Date.now() - RISK_LIMITS.INVITE_BURST_WINDOW_MS);

  const inviteResult = await db.collection(COLLECTIONS.INVITE_RECORDS)
    .where({
      inviter_id: userId,
      created_at: _.gte(oneHourAgo),
    })
    .count();

  if (inviteResult.total >= RISK_LIMITS.INVITE_BURST_THRESHOLD) {
    console.warn(`[checkRiskControl] 用户 ${userId} 邀请刷量嫌疑: 1小时内 ${inviteResult.total} 人`);
    return { passed: false, reason: 'invite_fraud_burst' };
  }

  return { passed: true };
}
