// 微信支付回调云函数 — 生产级实现
// ==========================================
// 本云函数作为微信支付统一回调入口，处理所有支付结果的后续业务。
//
// 功能：
//   1. 幂等校验（同一订单多次回调只处理一次）
//   2. 金额一致性校验
//   3. 按订单类型分发后续处理：
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
const crypto = require('crypto'); // F1: 网关 HMAC 签名验证
const {
  COLLECTIONS,
  ORDER_STATUS,
  ORDER_TYPES,
  PRICES,
  POINTS_PACKS,
  MEMBER_CREDITS,
  warmupConfig,
  loadPrices,
} = require('./common/constants');
const { activateMembership } = require('./common/activation-service');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 模块级局部副本 — 由 loadPrices 在入口填充，避免直接污染模块级 MEMBER_CREDITS 常量
let dbCredits = MEMBER_CREDITS;

// ============================================
// 环境配置（商户号到位后改为 false）
// ============================================
const GATEWAY_SECRET = process.env.CALLBACK_GATEWAY_SECRET; // F1: 网关回调签名密钥，未配置时回退到字段校验

// ============================================
// 云函数入口
// ============================================

/**
 * 从数据库读取 MOCK_PAY 配置（与 createOrder 保持一致）—— F3
 * DB 读取失败时回退到环境变量（向后兼容）
 * @param {object} db - cloud.database() 实例
 * @returns {Promise<boolean>}
 */
async function loadMockPayConfig(db) {
  try {
    const result = await db.collection('system_config').doc('wechat_pay_config').get();
    if (result.data) {
      return result.data.mock_pay !== undefined
        ? result.data.mock_pay
        : process.env.MOCK_PAY === 'true';
    }
    return process.env.MOCK_PAY === 'true';
  } catch (e) {
    // DB 读取失败时，回退到环境变量（向后兼容）
    console.warn('[payCallback] MOCK_PAY DB 读取失败，回退环境变量:', e.message);
    return process.env.MOCK_PAY === 'true';
  }
}

exports.main = async (event, context) => {
  await warmupConfig(db);
  // V2.0: 价格从 DB 动态加载（使用局部副本，不污染模块级全局常量，避免实例复用累积）
  const priceConfig = await loadPrices(db);
  dbCredits = priceConfig.memberCredits;

  // F3: MOCK_PAY 配置源统一为 DB（与 createOrder 一致），DB 读取失败回退环境变量
  const MOCK_PAY = await loadMockPayConfig(db);

  // S2 安全告警：真实支付模式下若未配置 CALLBACK_GATEWAY_SECRET，回调仅做弱格式校验，
  // 任何人构造合法格式的 out_trade_no 即可伪造 PAID。生产必须配置网关密钥并强制走签名校验。
  if (!MOCK_PAY && !GATEWAY_SECRET) {
    console.error(
      '[payCallback] [SECURITY] 真实支付模式未配置 CALLBACK_GATEWAY_SECRET，回调验签降级为弱格式校验，存在伪造风险，请立即配置网关密钥'
    );
  }

  // 原始回调事件日志：用于核对集成网关转发后的字段名（首个真实回调务必查看）
  console.log('[payCallback] raw event:', JSON.stringify(event));

  // 在 try 之前提取订单号，便于网关签名验证与 catch 异常补偿引用
  const out_trade_no = event.out_trade_no;

  try {
    // ========================================
    // 1. 网关身份验证（F1：防止客户端伪造支付回调）
    //    - 配置了 CALLBACK_GATEWAY_SECRET：用 HMAC-SHA256 验证网关签名
    //    - 未配置（向后兼容）：至少校验微信回调特有字段（transaction_id 或 out_trade_no 格式）
    // ========================================
    if (GATEWAY_SECRET) {
      const expectedSig = crypto
        .createHmac('sha256', GATEWAY_SECRET)
        .update((event.out_trade_no || '') + (event.transaction_id || ''))
        .digest('hex');
      if (event.gateway_signature !== expectedSig) {
        console.error('[payCallback] 非法回调来源：网关签名校验失败');
        return wechatResponse('FAIL', '非法回调来源');
      }
    } else {
      // 未配置网关密钥（向后兼容）：至少校验回调携带微信支付特有字段
      const hasTransactionId = !!event.transaction_id;
      const validOrderNo = !!(
        event.out_trade_no && /^[A-Za-z0-9_-]{6,64}$/.test(event.out_trade_no)
      );
      if (!hasTransactionId && !validOrderNo) {
        console.error('[payCallback] 非法回调来源：缺少微信支付标识字段');
        return wechatResponse('FAIL', '非法回调来源');
      }
    }

    // ========================================
    // 2. 提取回调数据
    // 集成中心网关转发的明文兼容两种形态：
    //   V2: { out_trade_no, transaction_id, total_fee, result_code }
    //   V3: { out_trade_no, transaction_id, amount:{total}, trade_state }
    // 首个真实回调务必看 raw event 日志核对实际字段。
    // ========================================
    const { transaction_id, total_fee, result_code, trade_state, amount: wxAmount } = event;

    // 统一金额字段：优先 V2 total_fee，回退 V3 amount.total
    const paidAmount =
      total_fee !== undefined
        ? Number(total_fee)
        : wxAmount && wxAmount.total !== undefined
          ? Number(wxAmount.total)
          : undefined;

    // 统一支付结果：V3 SUCCESS 或网关仅转发成功回调时均视为成功
    const payFailed =
      (result_code && result_code !== 'SUCCESS') ||
      (trade_state && !['SUCCESS', 'REFUND'].includes(trade_state));

    // 支付失败回调（用户取消或支付错误）
    if (payFailed) {
      console.warn('[payCallback] 支付未成功:', out_trade_no, result_code || trade_state);
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
    const orderResult = await db
      .collection(COLLECTIONS.ORDERS)
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
      // mock_pay 模式下订单在 createOrder 中直接标记 PAID，但 dispatchPostPayment 尚未执行。
      // 如果 dispatch_status 不是 completed，说明业务分发未完成，需要继续处理。
      if (order.dispatch_status === 'completed') {
        console.log('[payCallback] 幂等：订单已支付且已分发，跳过处理', out_trade_no);
        return wechatResponse('OK');
      }
      console.log(
        '[payCallback] 订单已支付但未分发，继续执行业务分发:',
        out_trade_no,
        'dispatch_status:',
        order.dispatch_status
      );
      // 直接跳到业务分发（跳过状态更新步骤，因为已经是 PAID）
      await dispatchPostPayment(order, transaction_id);
      try {
        await cloud.callFunction({
          name: 'trackEvent',
          data: {
            eventName: 'pay_success',
            properties: { order_id: order._id, order_type: order.type, amount: order.amount },
          },
        });
      } catch (trackErr) {
        console.warn('[payCallback] 埋点记录跳过:', trackErr.message);
      }
      await sendPaymentNotify(order);
      console.log('[payCallback] 补充分发处理完成:', out_trade_no, 'type:', order.type);
      return wechatResponse('OK');
    }

    // 已关闭/已退款的订单收到回调 → 异常，记录差异
    if (
      order.status === ORDER_STATUS.CLOSED ||
      order.status === ORDER_STATUS.REFUNDED ||
      order.status === ORDER_STATUS.REFUND_REQUESTED
    ) {
      console.error(
        '[payCallback] 订单状态异常:',
        out_trade_no,
        'local_status:',
        order.status,
        'wx_result:',
        result_code
      );
      await recordBillDifference(order, {
        wx_transaction_id: transaction_id,
        wx_status: 'SUCCESS',
        local_status: order.status,
        diff_type: 'status_conflict',
      });
      return wechatResponse('FAIL', '订单状态异常');
    }

    // ========================================
    // 5. 金额一致性校验（兼容 V2 total_fee / V3 amount.total）
    // ========================================
    if (!MOCK_PAY) {
      // F2: 真实支付模式下金额必须存在且一致，缺失即拒绝（防止绕过金额校验）
      if (paidAmount === undefined || isNaN(paidAmount)) {
        console.error('[payCallback] 回调缺少金额字段，拒绝处理:', out_trade_no);
        await recordBillDifference(order, {
          wx_transaction_id: transaction_id,
          wx_amount: null,
          local_amount: order.amount || order.pay_amount || 0,
          diff_type: 'amount_missing',
        });
        return wechatResponse('FAIL', '金额校验失败');
      }
      const orderAmount = order.amount || order.pay_amount || 0;
      if (Number(paidAmount) !== Number(orderAmount)) {
        console.error(
          '[payCallback] 金额不一致:',
          'wx_amount:',
          paidAmount,
          'order_amount:',
          orderAmount,
          'out_trade_no:',
          out_trade_no
        );
        await recordBillDifference(order, {
          wx_transaction_id: transaction_id,
          wx_amount: paidAmount,
          local_amount: orderAmount,
          diff_type: 'amount_mismatch',
        });
        // 金额不一致暂不自动修复，人工介入
        return wechatResponse('FAIL', '金额校验失败');
      }
    }

    // ========================================
    // S4 修复：transaction_id 唯一性校验（防止同一微信流水号绑定多个订单）
    // 在订单 CAS 更新前，确认该 transaction_id 未被其他订单使用
    // ========================================
    if (transaction_id && !MOCK_PAY) {
      const dupTx = await db
        .collection(COLLECTIONS.ORDERS)
        .where({ transaction_id })
        .limit(1)
        .get();
      if (dupTx.data && dupTx.data.length > 0 && dupTx.data[0]._id !== order._id) {
        console.error(
          '[payCallback] transaction_id 已被其他订单使用:',
          transaction_id,
          '当前订单:',
          order._id,
          '已冲突订单:',
          dupTx.data[0]._id
        );
        await recordBillDifference(order, {
          wx_transaction_id: transaction_id,
          conflict_order_id: dupTx.data[0]._id,
          diff_type: 'transaction_id_conflict',
        });
        // 已冲突订单已 PAID 则幂等返回；否则拒绝
        if (dupTx.data[0].status === ORDER_STATUS.PAID) {
          return wechatResponse('OK'); // 幂等
        }
        return wechatResponse('FAIL', '交易号冲突');
      }
    }

    // ========================================
    // 6. 更新订单状态为已支付（并发安全：仅更新 PENDING 状态）
    // ========================================
    const now = new Date();
    const updateResult = await db
      .collection(COLLECTIONS.ORDERS)
      .where({
        _id: order._id,
        status: ORDER_STATUS.PENDING,
      })
      .update({
        data: {
          status: ORDER_STATUS.PAID,
          transaction_id: transaction_id || order.transaction_id || '',
          dispatch_status: 'pending', // S2: 标记待分发，宕机恢复后由补偿任务识别
          paid_at: now,
          profit: order.amount,
          updated_at: now,
        },
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
        await db
          .collection(COLLECTIONS.USER_COUPONS)
          .doc(order.metadata.coupon_user_id)
          .update({
            data: {
              status: 'used',
              order_id: order._id,
              used_at: now,
              updated_at: now,
            },
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
            amount: order.amount,
          },
        },
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
    // F6: 业务未完成时返回 FAIL，触发微信支付平台重试，避免用户付款后未拿到会员/点数
    // 记录失败订单供补偿任务修复
    try {
      if (out_trade_no) {
        await db.collection('dispatch_failures').add({
          data: {
            order_id: out_trade_no,
            error: error.message,
            created_at: new Date(),
            status: 'pending',
            retry_count: 0,
          },
        });
      }
    } catch (logErr) {
      // 忽略日志写入失败，不阻塞返回
      console.warn('[payCallback] 补偿记录写入失败:', logErr.message);
    }
    // 返回 FAIL 让微信重试
    return wechatResponse('FAIL', '业务处理异常');
  }
};

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
          memberType:
            metadata.member_tier ||
            metadata.member_type ||
            (orderType === ORDER_TYPES.MEMBER_YEARLY ? 'yearly' : 'monthly'),
          orderId: order._id,
          amount: order.amount,
        });
        break;

      // --- 家庭会员 ---
      case ORDER_TYPES.MEMBER_FAMILY_MONTHLY:
      case ORDER_TYPES.MEMBER_FAMILY_YEARLY:
        await activateFamilyMember(openid, {
          memberType:
            metadata.member_tier ||
            (orderType === ORDER_TYPES.MEMBER_FAMILY_YEARLY ? 'family_yearly' : 'family_monthly'),
          orderId: order._id,
          amount: order.amount,
        });
        break;

      // --- 点数包 ---
      case ORDER_TYPES.POINTS:
        await creditPoints(openid, {
          packType: metadata.pack_type,
          pointsCount: metadata.points_count,
          expireDays: metadata.expire_days,
          orderId: order._id,
        });
        break;

      // --- 组合套餐 ---
      case ORDER_TYPES.BUNDLE:
        await processBundle(order);
        break;

      default:
        console.warn('[payCallback] 未知订单类型:', orderType, order._id);
    }

    // S2: 资源发放成功，标记分发完成（pending → completed）
    try {
      await db
        .collection(COLLECTIONS.ORDERS)
        .doc(order._id)
        .update({
          data: { dispatch_status: 'completed', dispatched_at: new Date() },
        });
    } catch (upErr) {
      console.warn('[payCallback] 分发完成状态更新异常:', order._id, upErr.message);
    }
  } catch (dispatchError) {
    // 业务分发失败不阻塞回调返回（订单状态已更新为 paid）
    // 失败的业务通过补偿任务修复
    console.error('[payCallback] 业务分发失败:', order._id, orderType, dispatchError.message);
    // S2: 标记分发失败，供补偿任务识别重发（pending → failed）
    try {
      await db
        .collection(COLLECTIONS.ORDERS)
        .doc(order._id)
        .update({
          data: {
            dispatch_status: 'failed',
            dispatch_error: dispatchError.message,
            dispatched_at: new Date(),
          },
        });
    } catch (upErr) {
      console.warn('[payCallback] 分发失败状态更新异常:', order._id, upErr.message);
    }
    await recordDispatchFailure(order, dispatchError);
  }
}

// ============================================
// 会员激活
// ============================================

/**
 * 激活/续费/升级个人会员
 * 委托统一激活服务 common/activation-service.js（isFamily=false），与 createOrder 兜底共用同一实现，消除逻辑漂移
 */
async function activateMember(openid, params) {
  await activateMembership({
    db,
    _,
    dbCredits,
    openid,
    memberType: params.memberType,
    orderId: params.orderId,
    isFamily: false,
  });
}

/**
 * 激活/续费/升级家庭会员
 * 委托统一激活服务 common/activation-service.js（isFamily=true）
 */
async function activateFamilyMember(openid, params) {
  await activateMembership({
    db,
    _,
    dbCredits,
    openid,
    memberType: params.memberType,
    orderId: params.orderId,
    isFamily: true,
  });
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

  // S3 修复：幂等检查 — 同一订单的点数只发放一次，防止重复回调用 _.inc 叠加点数
  if (orderId) {
    const existing = await db
      .collection(COLLECTIONS.POINT_TRANSACTIONS)
      .where({ order_id: orderId, type: 'purchase' })
      .limit(1)
      .get();
    if (existing.data && existing.data.length > 0) {
      console.log('[payCallback] 点数已发放过，跳过:', orderId);
      return;
    }
  }

  const now = new Date();
  const expireAt = new Date(now.getTime() + (expireDays || 90) * 24 * 60 * 60 * 1000);

  // 查找或创建用户点数记录
  const existingResult = await db
    .collection(COLLECTIONS.USER_POINTS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  let balanceAfter;
  if (existingResult.data && existingResult.data.length > 0) {
    const record = existingResult.data[0];
    const newExpire =
      record.expire_at && new Date(record.expire_at) > now ? new Date(record.expire_at) : expireAt;
    balanceAfter = (record.balance || 0) + pointsCount;
    await db
      .collection(COLLECTIONS.USER_POINTS)
      .doc(record._id)
      .update({
        data: {
          balance: _.inc(pointsCount),
          total_purchased: _.inc(pointsCount),
          expire_at: newExpire,
          updated_at: now,
        },
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
        updated_at: now,
      },
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
      created_at: now,
    },
  });

  console.log('[payCallback] 点数已到账: +' + pointsCount + '，订单:', orderId);
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
        const subResult = await db.collection(COLLECTIONS.ORDERS).doc(sub.order_id).get();
        if (subResult.data) {
          await db
            .collection(COLLECTIONS.ORDERS)
            .doc(sub.order_id)
            .update({
              data: {
                status: ORDER_STATUS.PAID,
                paid_at: now,
                updated_at: now,
              },
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
    const result = await db
      .collection(COLLECTIONS.ORDERS)
      .where({ out_trade_no: outTradeNo, status: ORDER_STATUS.PENDING })
      .update({
        data: {
          status: ORDER_STATUS.FAILED,
          updated_at: new Date(),
        },
      });
    if (result.stats && result.stats.updated > 0) {
      console.log('[payCallback] 订单标记为支付失败:', outTradeNo);

      // V1.5: 支付失败埋点
      try {
        const failedOrderResult = await db
          .collection(COLLECTIONS.ORDERS)
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
              out_trade_no: outTradeNo,
            },
          },
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
        page =
          'pages/ai-report/index?recordId=' + ((order.metadata && order.metadata.record_id) || '');
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
    await cloud
      .callFunction({
        name: 'sendPaymentNotification',
        data: {
          openid: order.user_id,
          templateType,
          data: {
            page,
            templateData: {
              thing1: { value: (order.description || '健康报告').substring(0, 20) },
              amount2: { value: amountDisplay },
              time3: { value: new Date().toLocaleString('zh-CN') },
            },
          },
        },
      })
      .catch((e) => {
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
        diff_orders: [
          {
            order_id: order._id,
            out_trade_no: order.out_trade_no,
            local_status: order.status,
            local_amount: order.amount,
            ...diff,
          },
        ],
        total_order_count: 1,
        total_amount: order.amount || 0,
        created_at: new Date(),
      },
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
        created_at: new Date(),
      },
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
