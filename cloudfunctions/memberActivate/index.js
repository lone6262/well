// 会员激活/续费云函数 - 模拟支付模式
// 商户号到位后将 MOCK_PAY 改为 false 即可切换真实支付
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  ORDER_STATUS,
  ORDER_TYPES,
  PRICES,
  MEMBER_STATUS,
  MEMBER_DURATION,
  MEMBER_CREDITS,
  MEMBER_LIMITS
, warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { checkRateLimit } = require('./common/rate-limiter');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MOCK_PAY = true; // 模拟支付模式，商户号到位后改为 false

// 会员类型 → 订单类型映射
const MEMBER_TYPE_TO_ORDER = {
  monthly: ORDER_TYPES.MEMBER_MONTHLY,
  yearly: ORDER_TYPES.MEMBER_YEARLY,
  family_monthly: ORDER_TYPES.MEMBER_FAMILY_MONTHLY,
  family_yearly: ORDER_TYPES.MEMBER_FAMILY_YEARLY
};

/**
 * 会员激活/续费
 * 支持新开通、续费、过期重新开通
 *
 * @param {string} type - 会员类型 'monthly' | 'yearly'
 * @returns {object} 会员信息和订单信息
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  let OPENID_OBJ = cloud.getWXContext();
  let openid = OPENID_OBJ.OPENID;
  let memberType = event.type;
  let token = event.token;

  // Token 验证（财务操作需验证身份）
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败，请重新登录', data: {} };
  }

  // 速率限制（写操作故障时拒绝）
  if (!await checkRateLimit(db, openid, 'memberActivate', 3, 60000, false)) {
    return { code: RESPONSE_CODE.ERROR, msg: '操作过于频繁，请稍后再试', data: {} };
  }

  // 1. 参数校验
  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  const VALID_TYPES = ['monthly', 'yearly', 'family_monthly', 'family_yearly'];
  if (!VALID_TYPES.includes(memberType)) {
    return { code: RESPONSE_CODE.ERROR, msg: '会员类型参数无效', data: {} };
  }

  // 2. 确定价格、时长和产品类型
  const isFamily = memberType.startsWith('family_');
  const isYearly = memberType.includes('yearly');
  const orderType = MEMBER_TYPE_TO_ORDER[memberType] || ORDER_TYPES.MEMBER_MONTHLY;
  const durationDays = isYearly ? MEMBER_DURATION.YEAR : MEMBER_DURATION.MONTH;

  // 根据会员类型取对应价格
  const PRICE_MAP = {
    monthly: PRICES.MEMBER_MONTHLY,
    yearly: PRICES.MEMBER_YEARLY,
    family_monthly: PRICES.MEMBER_FAMILY_MONTHLY,
    family_yearly: PRICES.MEMBER_FAMILY_YEARLY
  };
  const RENEW_PRICE_MAP = {
    monthly: PRICES.RENEW_MONTHLY,
    yearly: PRICES.RENEW_YEARLY,
    family_monthly: PRICES.RENEW_FAMILY_MONTHLY,
    family_yearly: PRICES.RENEW_FAMILY_YEARLY
  };
  const CREDITS_MAP = {
    monthly: MEMBER_CREDITS.MONTHLY_REPORTS,
    yearly: MEMBER_CREDITS.YEARLY_REPORTS,
    family_monthly: MEMBER_CREDITS.FAMILY_MONTHLY_REPORTS,
    family_yearly: MEMBER_CREDITS.FAMILY_YEARLY_REPORTS
  };

  try {
    // 3. 查询现有会员记录（含 active 和 expired）
    let existingResult = await db.collection(COLLECTIONS.MEMBERS)
      .where({ user_id: openid })
      .limit(1)
      .get();

    let existingMember = (existingResult.data && existingResult.data.length > 0)
      ? existingResult.data[0]
      : null;
    let isActiveMember = existingMember && existingMember.status === MEMBER_STATUS.ACTIVE;

    // 4. 计算过期时间
    let now = new Date();
    let expireDate;
    if (isActiveMember) {
      // 续费：从当前过期时间和现在中取较晚者，再加上时长
      let currentExpire = new Date(existingMember.expire_date);
      let baseDate = currentExpire > now ? currentExpire : now;
      expireDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    } else {
      // 新开通或过期重新开通：从现在起算
      expireDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    }

    // 根据会员类型确定每月报告额度
    let reportCreditsTotal = isYearly ? MEMBER_CREDITS.YEARLY_REPORTS : MEMBER_CREDITS.MONTHLY_REPORTS;

    // 5. 下次额度重置时间（从开通日对齐，如1月5日开通 -> 2月5日重置）
    // 续费时保持原 start_date 的日期对齐，新开通用当天
    let resetBase = (existingMember && existingMember.start_date)
      ? new Date(existingMember.start_date)
      : now;
    let startDay = resetBase.getDate();
    let resetMonth = now.getMonth() + 1;
    let resetYear = now.getFullYear();
    if (resetMonth > 11) {
      resetMonth = 0;
      resetYear += 1;
    }
    let maxDay = new Date(resetYear, resetMonth + 1, 0).getDate();
    let resetDay = Math.min(startDay, maxDay);
    let nextResetAt = new Date(resetYear, resetMonth, resetDay, now.getHours(), now.getMinutes(), now.getSeconds());

    // 6. 检查是否有未完成的会员订单（仅拦截 pending 状态）
    let pendingOrderResult = await db.collection(COLLECTIONS.ORDERS)
      .where({
        user_id: openid,
        type: _.in([ORDER_TYPES.MEMBER, ORDER_TYPES.MEMBER_MONTHLY, ORDER_TYPES.MEMBER_YEARLY]),
        status: ORDER_STATUS.PENDING
      })
      .limit(1)
      .get();

    if (pendingOrderResult.data && pendingOrderResult.data.length > 0) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '已有进行中的会员订单',
        data: { orderId: pendingOrderResult.data[0]._id }
      };
    }

    // 7. 创建会员记录或更新现有记录
    let memberId;
    if (existingMember) {
      // 更新现有记录（续费或过期重开）
      await db.collection(COLLECTIONS.MEMBERS).doc(existingMember._id).update({
        data: {
          type: memberType,
          status: MEMBER_STATUS.ACTIVE,
          expire_date: expireDate,
          report_credits_total: reportCreditsTotal,
          report_credits_used: 0,
          report_credits_reset_at: nextResetAt,
          updated_at: now
        }
      });
      memberId = existingMember._id;
    } else {
      // 新建会员记录
      let memberResult = await db.collection(COLLECTIONS.MEMBERS).add({
        data: {
          user_id: openid,
          type: memberType,
          status: MEMBER_STATUS.ACTIVE,
          start_date: now,
          expire_date: expireDate,
          report_credits_total: reportCreditsTotal,
          report_credits_used: 0,
          report_credits_reset_at: nextResetAt,
          auto_renew: false,
          created_at: now,
          updated_at: now
        }
      });
      memberId = memberResult._id;
    }

    // 8. 确定价格（续费使用续费价，首充使用原价）
    const price = isActiveMember
      ? (RENEW_PRICE_MAP[memberType] || PRICE_MAP[memberType])
      : PRICE_MAP[memberType];

    // 9. 创建订单
    let outTradeNo = 'WELL_MEMBER_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    let orderResult = await db.collection(COLLECTIONS.ORDERS).add({
      data: {
        user_id: openid,
        type: orderType,
        status: ORDER_STATUS.PAID,
        amount: price,
        out_trade_no: outTradeNo,
        transaction_id: MOCK_PAY ? 'MOCK_' + outTradeNo : '',
        description: (isYearly ? '年卡会员' : '月卡会员') + (isActiveMember ? '续费' : '开通'),
        metadata: {
          member_type: memberType,
          member_id: memberId,
          is_renewal: !!isActiveMember,
          duration_days: durationDays,
          mock_pay: MOCK_PAY
        },
        paid_at: now,
        created_at: now,
        updated_at: now
      }
    });

    // 9. 同步更新 users 集合
    let userResult = await db.collection(COLLECTIONS.USERS)
      .where({ user_id: openid })
      .limit(1)
      .get();

    if (userResult.data && userResult.data.length > 0) {
      await db.collection(COLLECTIONS.USERS).doc(userResult.data[0]._id).update({
        data: { isMember: true, memberExpire: expireDate, updated_at: now }
      });
    } else {
      // 新用户无记录时创建
      await db.collection(COLLECTIONS.USERS).add({
        data: {
          user_id: openid,
          isMember: true,
          memberExpire: expireDate,
          first_report_used: false,
          invite_reward_credits: 0,
          created_at: now,
          updated_at: now
        }
      });
    }

    // 10. 返回结果
    let daysRemaining = Math.ceil((expireDate - now) / (24 * 60 * 60 * 1000));

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: isActiveMember ? '续费成功' : '开通成功',
      data: {
        is_member: true,
        type: memberType,
        expire_date: expireDate,
        days_remaining: daysRemaining,
        report_credits_total: reportCreditsTotal,
        report_credits_remaining: reportCreditsTotal,
        order_id: orderResult._id
      }
    };

  } catch (error) {
    console.error('会员激活失败', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '操作失败，请稍后重试', data: {} };
  }
};
