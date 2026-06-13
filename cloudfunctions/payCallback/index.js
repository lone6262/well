// 微信支付回调云函数 — 生产级实现
// ==========================================
// 本云函数作为微信支付统一回调入口，处理所有支付结果的后续业务。
//
// 功能：
//   1. 微信支付签名验证（防伪造回调）
//   2. 幂等校验（同一订单多次回调只处理一次）
//   3. 金额一致性校验
//   4. 按订单类型分发后续处理：
//      - report → 更新订单状态
//      - member / member_* → 激活会员
//      - points → 点数到账
//      - bundle → 拆单处理
//   5. 支付成功订阅消息通知
//   6. 优惠券标记已使用
//
// 微信回调文档: https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pages/index.shtml
// ==========================================

const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const {
  COLLECTIONS,
  ORDER_STATUS,
  ORDER_TYPES,
  PRICES,
  POINTS_PACKS,
  MEMBER_CREDITS,
  MEMBER_STATUS,
  MEMBER_DURATION,
  MEMBER_LIMITS,
  warmupConfig,
  loadPrices
} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ============================================
// 环境配置（商户号到位后改为 false）
// ============================================
const MOCK_PAY = true;

// ============================================
// 云函数入口
// ============================================
exports.main = async (event, context) => {
  await warmupConfig(db);
  // V2.0: 价格从 DB 动态加载，覆盖硬编码默认值
  const priceConfig = await loadPrices(db);
  Object.assign(PRICES, priceConfig.prices);
  Object.assign(MEMBER_CREDITS, priceConfig.memberCredits);

  try {
    // ========================================
    // 1. 签名验证（防伪造回调）
    // ========================================
    if (!MOCK_PAY) {
      const signValid = verifyWechatPaySign(event);
      if (!signValid) {
        console.error('[payCallback] 签名验证失败，疑似伪造回调');
        return wechatResponse('FAIL', '签名验证失败');
      }
    }

    // ========================================
    // 2. 提取回调数据
    // 微信支付云函数回调为 JSON 格式：
    //   { out_trade_no, transaction_id, total_fee, result_code, ... }
    // ========================================
    const {
      out_trade_no,
      transaction_id,
      total_fee,
      result_code
    } = event;

    // 支付失败回调（用户取消或支付错误）
    if (result_code && result_code !== 'SUCCESS') {
      console.warn('[payCallback] 支付未成功:', out_trade_no, result_code);
      await handlePaymentFailed(out_trade_no);
      return wechatResponse('OK');
    }

    if (!out_trade_no) {
      console.error('[payCallback] 回调缺少 out_trade_no');
      return wechatResponse('FAIL', '缺少商户订单号');
    }

    console.log('[payCallback] 收到支付回调:', out_trade_no, transaction_id);

    // ========================================
    // 3. 查询订单
    // ========================================
    const orderResult = await db.collection(COLLECTIONS.ORDERS)
      .where({ out_trade_no })
      .limit(1)
      .get();

    if (!orderResult.data || orderResult.data.length === 0) {
      console.error('[payCallback] 订单不存在:', out_trade_no);
      return wechatResponse('FAIL', '订单不存在');
    }

    const order = orderResult.data[0];

    // ========================================
    // 4. 幂等校验：已支付订单直接返回成功
    // ========================================
    if (order.status === ORDER_STATUS.PAID) {
      console.log('[payCallback] 幂等：订单已支付，跳过处理:', out_trade_no);
      return wechatResponse('OK');
    }

    // 已关闭/已退款的订单收到回调 → 异常，记录差异
    if (order.status === ORDER_STATUS.CLOSED ||
        order.status === ORDER_STATUS.REFUNDED ||
        order.status === ORDER_STATUS.REFUND_REQUESTED) {
      console.error('[payCallback] 订单状态异常:', out_trade_no,
        'local_status:', order.status, 'wx_result:', result_code);
      await recordBillDifference(order, {
        wx_transaction_id: transaction_id,
        wx_status: 'SUCCESS',
        local_status: order.status,
        diff_type: 'status_conflict'
      });
      return wechatResponse('FAIL', '订单状态异常');
    }

    // ========================================
    // 5. 金额一致性校验
    // ========================================
    if (!MOCK_PAY && total_fee !== undefined) {
      const orderAmount = order.amount || order.pay_amount || 0;
      if (Number(total_fee) !== orderAmount) {
        console.error('[payCallback] 金额不一致:',
          'wx_amount:', total_fee,
          'order_amount:', orderAmount,
          'out_trade_no:', out_trade_no);
        await recordBillDifference(order, {
          wx_transaction_id: transaction_id,
          wx_amount: Number(total_fee),
          local_amount: orderAmount,
          diff_type: 'amount_mismatch'
        });
        // 金额不一致暂不自动修复，人工介入
        return wechatResponse('FAIL', '金额校验失败');
      }
    }

    // ========================================
    // 6. 更新订单状态为已支付（并发安全：仅更新 PENDING 状态）
    // ========================================
    const now = new Date();
    const updateResult = await db.collection(COLLECTIONS.ORDERS)
      .where({
        _id: order._id,
        status: ORDER_STATUS.PENDING
      })
      .update({
        data: {
          status: ORDER_STATUS.PAID,
          transaction_id: transaction_id || order.transaction_id || '',
          paid_at: now,
          profit: order.amount,
          updated_at: now
        }
      });

    // 并发回调或重复回调：状态已被其他进程更新，幂等返回
    if (!updateResult.stats || updateResult.stats.updated === 0) {
      console.warn('[payCallback] 订单状态已变更，跳过重复处理:', order._id);
      return wechatResponse('OK');
    }

    // ========================================
    // 7. 标记优惠券为已使用
    // ========================================
    if (order.metadata && order.metadata.coupon_user_id) {
      try {
        await db.collection(COLLECTIONS.USER_COUPONS)
          .doc(order.metadata.coupon_user_id)
          .update({
            data: {
              status: 'used',
              order_id: order._id,
              used_at: now,
              updated_at: now
            }
          });
      } catch (e) {
        // 优惠券集合可能尚未创建，静默处理
        console.warn('[payCallback] 优惠券标记失败:', e.message);
      }
    }

    // ========================================
    // 8. 按订单类型分发后续业务处理
    // ========================================
    await dispatchPostPayment(order, transaction_id);

    // V1.5: 支付成功埋点
    try {
      await cloud.callFunction({
        name: 'trackEvent',
        data: {
          eventName: 'pay_success',
          properties: {
            order_id: order._id,
            order_type: order.type,
            amount: order.amount
          }
        }
      });
    } catch (trackErr) {
      console.warn('[payCallback] 埋点记录跳过:', trackErr.message);
    }

    // ========================================
    // 9. 支付成功通知
    // ========================================
    await sendPaymentNotify(order);

    console.log('[payCallback] 处理完成:', out_trade_no, 'type:', order.type);
    return wechatResponse('OK');

  } catch (error) {
    console.error('[payCallback] 未知异常:', error.message, error.stack);
    // 未知异常返回 OK 避免微信支付平台无限重试
    // 异常订单通过人工排查 + 对账修复
    return wechatResponse('OK');
  }
};

// ============================================
// 微信支付签名验证
// ============================================

/**
 * 验证微信支付回调签名
 * 微信支付 V2 使用 MD5 签名，V3 使用 RSA 签名
 * 云函数回调场景下使用 V2 验签方式
 *
 * @param {object} event - 回调参数
 * @returns {boolean} 签名是否有效
 */
function verifyWechatPaySign(event) {
  try {
    const sign = event.sign;
    if (!sign) {
      console.error('[payCallback] 回调缺少 sign 字段');
      return false;
    }

    // 微信支付 V2 签名算法：
    // 1. 将所有非 sign 参数按字典序排序
    // 2. 拼接为 key=value&key=value 格式
    // 3. 末尾追加 &key=<商户密钥>
    // 4. MD5 后转大写与 sign 比较
    const signParams = {};
    for (const key of Object.keys(event)) {
      if (key !== 'sign' && event[key] !== undefined && event[key] !== '') {
        signParams[key] = String(event[key]);
      }
    }

    const sortedKeys = Object.keys(signParams).sort();
    const stringA = sortedKeys
      .map(k => `${k}=${signParams[k]}`)
      .join('&');

    // 商户密钥从环境变量读取（上线前配置）
    const mchKey = process.env.WECHAT_PAY_MCH_KEY || '';
    if (!mchKey) {
      console.error('[payCallback] WECHAT_PAY_MCH_KEY 未配置，拒绝回调（签名验证无法执行）');
      return false;
    }

    const stringSignTemp = stringA + '&key=' + mchKey;
    const computedSign = crypto
      .createHash('md5')
      .update(stringSignTemp)
      .digest('hex')
      .toUpperCase();

    const isValid = computedSign === sign;
    if (!isValid) {
      console.error('[payCallback] 签名不匹配:',
        'computed:', computedSign, 'received:', sign);
    }
    return isValid;

  } catch (e) {
    console.error('[payCallback] 签名验证异常:', e.message);
    return false;
  }
}

// ============================================
// 支付后业务分发
// ============================================

/**
 * 根据订单类型执行支付后业务处理
 *
 * @param {object} order - 订单记录
 * @param {string} transactionId - 微信支付流水号
 */
async function dispatchPostPayment(order, transactionId) {
  const orderType = order.type;
  const openid = order.user_id;
  const metadata = order.metadata || {};

  console.log('[payCallback] 分发业务处理:', orderType);

  try {
    switch (orderType) {

      // --- 报告订单 ---
      case ORDER_TYPES.REPORT:
        // 报告订单的核心业务在 createOrder 中已处理
        // payCallback 只需确认支付状态，额度已在 createOrder 中预扣
        console.log('[payCallback] 报告订单支付确认:', order._id);
        break;

      // --- 个人会员（月卡/年卡）---
      case ORDER_TYPES.MEMBER:
      case ORDER_TYPES.MEMBER_MONTHLY:
      case ORDER_TYPES.MEMBER_YEARLY:
        await activateMember(openid, {
          memberType: metadata.member_type || (orderType === ORDER_TYPES.MEMBER_YEARLY ? 'yearly' : 'monthly'),
          orderId: order._id,
          amount: order.amount
        });
        break;

      // --- 家庭会员 ---
      case ORDER_TYPES.MEMBER_FAMILY_MONTHLY:
      case ORDER_TYPES.MEMBER_FAMILY_YEARLY:
        await activateFamilyMember(openid, {
          memberType: orderType === ORDER_TYPES.MEMBER_FAMILY_YEARLY ? 'family_yearly' : 'family_monthly',
          orderId: order._id,
          amount: order.amount
        });
        break;

      // --- 点数包 ---
      case ORDER_TYPES.POINTS:
        await creditPoints(openid, {
          packType: metadata.pack_type,
          pointsCount: metadata.points_count,
          expireDays: metadata.expire_days,
          orderId: order._id
        });
        break;

      // --- 组合套餐 ---
      case ORDER_TYPES.BUNDLE:
        await processBundle(order);
        break;

      default:
        console.warn('[payCallback] 未知订单类型:', orderType, order._id);
    }
  } catch (dispatchError) {
    // 业务分发失败不阻塞回调返回（订单状态已更新为 paid）
    // 失败的业务通过补偿任务修复
    console.error('[payCallback] 业务分发失败:', order._id, orderType, dispatchError.message);
    await recordDispatchFailure(order, dispatchError);
  }
}

// ============================================
// 会员激活
// ============================================

/**
 * 激活/续费个人会员
 * 支持新开通、续费、过期后重新开通
 *
 * @param {string} openid - 用户 openid
 * @param {object} params - { memberType, orderId, amount }
 */
async function activateMember(openid, params) {
  const { memberType } = params;
  const isYearly = memberType === 'yearly';
  const durationDays = isYearly ? MEMBER_DURATION.YEAR : MEMBER_DURATION.MONTH;
  const reportCredits = isYearly
    ? MEMBER_CREDITS.YEARLY_REPORTS
    : MEMBER_CREDITS.MONTHLY_REPORTS;
  const now = new Date();

  // 查询现有会员记录
  const existingResult = await db.collection(COLLECTIONS.MEMBERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  const existingMember = (existingResult.data && existingResult.data.length > 0)
    ? existingResult.data[0]
    : null;

  const isActive = existingMember && existingMember.status === MEMBER_STATUS.ACTIVE;

  // 计算到期日期
  let expireDate;
  if (isActive && existingMember.expire_date) {
    const currentExpire = new Date(existingMember.expire_date);
    const baseDate = currentExpire > now ? currentExpire : now;
    expireDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  } else {
    expireDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  // 计算额度重置时间（按开通日对齐）
  const resetBase = (existingMember && existingMember.start_date)
    ? new Date(existingMember.start_date)
    : now;
  const startDay = resetBase.getDate();
  let resetMonth = now.getMonth();
  let resetYear = now.getFullYear();
  resetMonth += 1;
  if (resetMonth > 11) { resetMonth = 0; resetYear += 1; }
  const maxDay = new Date(resetYear, resetMonth + 1, 0).getDate();
  const resetDay = Math.min(startDay, maxDay);
  const nextResetAt = new Date(resetYear, resetMonth, resetDay,
    now.getHours(), now.getMinutes(), now.getSeconds());

  // 更新或创建会员记录
  if (existingMember) {
    await db.collection(COLLECTIONS.MEMBERS).doc(existingMember._id).update({
      data: {
        type: memberType,
        status: MEMBER_STATUS.ACTIVE,
        expire_date: expireDate,
        report_credits_total: reportCredits,
        report_credits_used: 0,
        report_credits_reset_at: nextResetAt,
        updated_at: now
      }
    });
  } else {
    await db.collection(COLLECTIONS.MEMBERS).add({
      data: {
        user_id: openid,
        type: memberType,
        status: MEMBER_STATUS.ACTIVE,
        start_date: now,
        expire_date: expireDate,
        report_credits_total: reportCredits,
        report_credits_used: 0,
        report_credits_reset_at: nextResetAt,
        auto_renew: false,
        created_at: now,
        updated_at: now
      }
    });
  }

  // 同步 users 集合的会员标记
  await syncUserMemberStatus(openid, true, expireDate);
}

/**
 * 激活家庭会员
 */
async function activateFamilyMember(openid, params) {
  const isYearly = params.memberType === 'family_yearly';
  const durationDays = isYearly ? MEMBER_DURATION.YEAR : MEMBER_DURATION.MONTH;
  const reportCredits = MEMBER_CREDITS.FAMILY_YEARLY_REPORTS; // 家庭会员固定 6 次
  const now = new Date();

  const existingResult = await db.collection(COLLECTIONS.MEMBERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  const existingMember = (existingResult.data && existingResult.data.length > 0)
    ? existingResult.data[0] : null;

  const isActive = existingMember && existingMember.status === MEMBER_STATUS.ACTIVE;

  let expireDate;
  if (isActive && existingMember.expire_date) {
    const currentExpire = new Date(existingMember.expire_date);
    const baseDate = currentExpire > now ? currentExpire : now;
    expireDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  } else {
    expireDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  const startDate = (existingMember && existingMember.start_date)
    ? new Date(existingMember.start_date) : now;
  const startDay = startDate.getDate();
  let resetMonth = now.getMonth() + 1;
  let resetYear = now.getFullYear();
  if (resetMonth > 11) { resetMonth = 0; resetYear += 1; }
  const maxDay = new Date(resetYear, resetMonth + 1, 0).getDate();
  const nextResetAt = new Date(resetYear, resetMonth,
    Math.min(startDay, maxDay),
    now.getHours(), now.getMinutes(), now.getSeconds());

  const memberData = {
    type: params.memberType,
    status: MEMBER_STATUS.ACTIVE,
    expire_date: expireDate,
    report_credits_total: reportCredits,
    report_credits_used: 0,
    report_credits_reset_at: nextResetAt,
    family_member_ids: existingMember ? (existingMember.family_member_ids || []) : [],
    family_max_pet: MEMBER_LIMITS.MAX_PETS_FAMILY,
    family_credits_total: reportCredits,
    family_credits_used: 0,
    family_credits_reset_at: nextResetAt,
    updated_at: now
  };

  if (existingMember) {
    await db.collection(COLLECTIONS.MEMBERS).doc(existingMember._id).update({
      data: memberData
    });
  } else {
    await db.collection(COLLECTIONS.MEMBERS).add({
      data: {
        user_id: openid,
        start_date: now,
        auto_renew: false,
        created_at: now,
        ...memberData
      }
    });
  }

  await syncUserMemberStatus(openid, true, expireDate);
}

/**
 * 同步 users 集合的会员状态标记
 */
async function syncUserMemberStatus(openid, isMember, expireDate) {
  const now = new Date();
  const userResult = await db.collection(COLLECTIONS.USERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  if (userResult.data && userResult.data.length > 0) {
    await db.collection(COLLECTIONS.USERS).doc(userResult.data[0]._id).update({
      data: {
        isMember: isMember,
        memberExpire: expireDate,
        updated_at: now
      }
    });
  } else {
    await db.collection(COLLECTIONS.USERS).add({
      data: {
        user_id: openid,
        isMember: isMember,
        memberExpire: expireDate,
        first_report_used: false,
        invite_reward_credits: 0,
        created_at: now,
        updated_at: now
      }
    });
  }
}

// ============================================
// 点数到账
// ============================================

/**
 * 点数包支付成功后，点数到账
 *
 * @param {string} openid - 用户 openid
 * @param {object} params - { packType, pointsCount, expireDays, orderId }
 */
async function creditPoints(openid, params) {
  const { pointsCount, expireDays, orderId } = params;
  const now = new Date();
  const expireAt = new Date(now.getTime() + (expireDays || 90) * 24 * 60 * 60 * 1000);

  // 查找或创建用户点数记录
  const existingResult = await db.collection(COLLECTIONS.USER_POINTS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  let balanceAfter;
  if (existingResult.data && existingResult.data.length > 0) {
    const record = existingResult.data[0];
    const newExpire = record.expire_at && new Date(record.expire_at) > now
      ? new Date(record.expire_at) : expireAt;
    balanceAfter = (record.balance || 0) + pointsCount;
    await db.collection(COLLECTIONS.USER_POINTS).doc(record._id).update({
      data: {
        balance: _.inc(pointsCount),
        total_purchased: _.inc(pointsCount),
        expire_at: newExpire,
        updated_at: now
      }
    });
  } else {
    balanceAfter = pointsCount;
    await db.collection(COLLECTIONS.USER_POINTS).add({
      data: {
        user_id: openid,
        balance: pointsCount,
        total_purchased: pointsCount,
        total_used: 0,
        expire_at: expireAt,
        created_at: now,
        updated_at: now
      }
    });
  }

  // 记录交易流水
  await db.collection(COLLECTIONS.POINT_TRANSACTIONS).add({
    data: {
      user_id: openid,
      type: 'purchase',
      amount: pointsCount,
      order_id: orderId,
      balance_after: balanceAfter,
      created_at: now
    }
  });

  console.log('[payCallback] 点数已到账:', openid, '+', pointsCount);
}

// ============================================
// 套餐拆单处理
// ============================================

/**
 * 处理组合套餐支付成功
 * 套餐包含子订单（会员 + 点数包），分别激活
 *
 * @param {object} order - 套餐主订单
 */
async function processBundle(order) {
  const bundleType = order.metadata && order.metadata.bundle_type;
  console.log('[payCallback] 套餐订单处理:', order._id, bundleType);

  // 查找子订单
  if (order.sub_orders && order.sub_orders.length > 0) {
    const now = new Date();
    for (const sub of order.sub_orders) {
      try {
        const subResult = await db.collection(COLLECTIONS.ORDERS)
          .doc(sub.order_id).get();
        if (subResult.data) {
          await db.collection(COLLECTIONS.ORDERS).doc(sub.order_id).update({
            data: {
              status: ORDER_STATUS.PAID,
              paid_at: now,
              updated_at: now
            }
          });
          // 递归处理子订单业务
          await dispatchPostPayment(subResult.data, order.transaction_id);
        }
      } catch (e) {
        console.error('[payCallback] 子订单处理失败:', sub.order_id, e.message);
      }
    }
  }
}

// ============================================
// 支付失败处理
// ============================================

/**
 * 处理支付失败回调
 * 将 pending 订单标记为 failed（保留记录供分析）
 */
async function handlePaymentFailed(outTradeNo) {
  try {
    const result = await db.collection(COLLECTIONS.ORDERS)
      .where({ out_trade_no: outTradeNo, status: ORDER_STATUS.PENDING })
      .update({
        data: {
          status: ORDER_STATUS.FAILED,
          updated_at: new Date()
        }
      });
    if (result.stats && result.stats.updated > 0) {
      console.log('[payCallback] 订单标记为支付失败:', outTradeNo);

      // V1.5: 支付失败埋点
      try {
        const failedOrderResult = await db.collection(COLLECTIONS.ORDERS)
          .where({ out_trade_no: outTradeNo })
          .limit(1)
          .get();
        const failedOrder = failedOrderResult.data && failedOrderResult.data[0];
        await cloud.callFunction({
          name: 'trackEvent',
          data: {
            eventName: 'pay_fail',
            properties: {
              order_id: failedOrder ? failedOrder._id : '',
              order_type: failedOrder ? failedOrder.type : '',
              amount: failedOrder ? failedOrder.amount : 0,
              out_trade_no: outTradeNo
            }
          }
        });
      } catch (trackErr) {
        console.warn('[payCallback] 支付失败埋点跳过:', trackErr.message);
      }
    }
  } catch (e) {
    console.error('[payCallback] 支付失败处理异常:', e.message);
  }
}

// ============================================
// 支付成功通知
// ============================================

/**
 * 发送支付成功订阅消息通知
 * 通过 sendPaymentNotification 云函数发送
 */
async function sendPaymentNotify(order) {
  try {
    let templateType;
    let page;
    const amountDisplay = '¥' + ((order.amount || 0) / 100).toFixed(2);

    switch (order.type) {
      case ORDER_TYPES.REPORT:
        templateType = 'PAY_SUCCESS';
        page = 'pages/ai-report/index?recordId=' + (order.metadata && order.metadata.record_id || '');
        break;
      case ORDER_TYPES.MEMBER:
      case ORDER_TYPES.MEMBER_MONTHLY:
      case ORDER_TYPES.MEMBER_YEARLY:
      case ORDER_TYPES.MEMBER_FAMILY_MONTHLY:
      case ORDER_TYPES.MEMBER_FAMILY_YEARLY:
        templateType = 'MEMBER_ACTIVATED';
        page = 'pages/member/status';
        break;
      case ORDER_TYPES.POINTS:
        templateType = 'PAY_SUCCESS';
        page = 'pages/points/index';
        break;
      default:
        return; // 不需要通知
    }

    // 云函数内调用另一个云函数
    await cloud.callFunction({
      name: 'sendPaymentNotification',
      data: {
        openid: order.user_id,
        templateType,
        data: {
          page,
          templateData: {
            thing1: { value: (order.description || '健康报告').substring(0, 20) },
            amount2: { value: amountDisplay },
            time3: { value: new Date().toLocaleString('zh-CN') }
          }
        }
      }
    }).catch(e => {
      // 通知发送失败不影响主流程
      console.warn('[payCallback] 通知发送失败:', e.message);
    });

  } catch (e) {
    console.warn('[payCallback] 通知构建失败:', e.message);
  }
}

// ============================================
// 异常记录
// ============================================

/**
 * 记录对账差异（金额不一致 / 状态冲突）
 */
async function recordBillDifference(order, diff) {
  try {
    await db.collection(COLLECTIONS.BILL_CHECK_LOGS).add({
      data: {
        bill_date: new Date().toISOString().substring(0, 10),
        diff_orders: [{
          order_id: order._id,
          out_trade_no: order.out_trade_no,
          local_status: order.status,
          local_amount: order.amount,
          ...diff
        }],
        total_order_count: 1,
        total_amount: order.amount || 0,
        created_at: new Date()
      }
    });
  } catch (e) {
    console.error('[payCallback] 差异记录写入失败:', e.message);
  }
}

/**
 * 记录业务分发失败（补偿任务修复）
 */
async function recordDispatchFailure(order, error) {
  try {
    await db.collection(COLLECTIONS.ERROR_LOGS).add({
      data: {
        function: 'payCallback',
        operation: 'dispatchPostPayment',
        order_id: order._id,
        out_trade_no: order.out_trade_no,
        order_type: order.type,
        error: error.message || String(error),
        created_at: new Date()
      }
    });
  } catch (e) {
    // 日志写入失败不阻塞
  }
}

// ============================================
// 微信支付响应格式
// ============================================

/**
 * 返回微信支付要求的标准响应格式
 * 微信支付平台要求返回 XML/JSON，收到 SUCCESS 后不再重试
 *
 * @param {string} code - 'OK' | 'FAIL'
 * @param {string} [msg] - 失败时的原因
 * @returns {object} 微信支付回调响应
 */
function wechatResponse(code, msg) {
  if (code === 'OK') {
    return { errcode: 0, errmsg: 'OK' };
  }
  return { errcode: -1, errmsg: msg || 'FAIL' };
}
