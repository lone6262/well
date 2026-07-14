// 管理员审核退款并执行微信退款
// 审批通过后调用微信退款 API，回滚用户资源
// 修复：S1 退款并发竞态保护（CAS 加锁）、W4 回滚额度防负数、W5 退款金额一致性校验
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { COLLECTIONS, RESPONSE_CODE, ORDER_STATUS, warmupConfig, SERVER_CONFIG } = require('./common/constants');
const { validateAdminRequest } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { refundId, approved, adminSecret, token } = event;

  // 管理员鉴权：优先验证 adminToken，兼容 adminSecret 恒定时间比较
  const authResult = validateAdminRequest(event);
  if (!authResult.valid) {
    const expectedSecret = SERVER_CONFIG.ADMIN_SECRET;
    if (!adminSecret || !expectedSecret) {
      return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '管理员鉴权失败', data: {} };
    }
    const providedBuf = Buffer.from(adminSecret);
    const expectedBuf = Buffer.from(expectedSecret);
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '管理员鉴权失败', data: {} };
    }
  }

  if (!refundId) {
    return { code: RESPONSE_CODE.ERROR, msg: '退款记录ID不能为空', data: {} };
  }

  // S1: 标记退款资金是否已实际退还（决定异常处理时能否安全回滚到 pending）
  let refundApiSucceeded = false;

  try {
    // 查询退款记录
    const refundResult = await db.collection('refund_records').doc(refundId).get();
    const refund = refundResult.data;

    // 快速预检（非原子，仅做早退优化；真正的并发保护依赖下方 CAS）
    if (!refund || refund.status !== 'pending') {
      return { code: RESPONSE_CODE.ERROR, msg: '退款记录不存在或已处理', data: {} };
    }

    if (!approved) {
      // 拒绝退款：S1 CAS 原子更新 pending → rejected，防止与审批请求并发冲突
      const rejectResult = await db.collection('refund_records')
        .where({ _id: refundId, status: 'pending' })
        .update({
          data: {
            status: 'rejected',
            reviewer: 'admin',
            reviewed_at: new Date()
          }
        });
      if (!rejectResult.stats || rejectResult.stats.updated === 0) {
        return { code: RESPONSE_CODE.ERROR, msg: '退款记录不存在或已处理', data: {} };
      }
      // 恢复订单状态为已支付
      await db.collection(COLLECTIONS.ORDERS).doc(refund.order_id).update({
        data: { status: ORDER_STATUS.PAID, updated_at: new Date() }
      });
      return { code: RESPONSE_CODE.SUCCESS, msg: '退款已拒绝', data: {} };
    }

    // ===== S1 修复：CAS 加锁 — 原子地将 pending 改为 processing =====
    // 条件更新确保只有一个请求能抢到锁（status 仍为 pending 才成功），消除读-写竞态
    const lockResult = await db.collection('refund_records')
      .where({ _id: refundId, status: 'pending' })
      .update({
        data: {
          status: 'processing',
          reviewer: 'admin',
          processing_at: new Date(),
          updated_at: new Date()
        }
      });

    if (!lockResult.stats || lockResult.stats.updated === 0) {
      // 未抢到锁：已被其他请求处理或状态已变更
      return { code: RESPONSE_CODE.ERROR, msg: '退款记录已处理或状态已变更', data: {} };
    }

    // 查询订单信息
    const orderResult = await db.collection(COLLECTIONS.ORDERS).doc(refund.order_id).get();
    const order = orderResult.data;

    if (!order) {
      // 回滚锁，恢复为 pending 以允许重试
      await restoreRefundPending(refundId);
      return { code: RESPONSE_CODE.ERROR, msg: '订单不存在', data: {} };
    }

    // ===== W5 修复：退款金额一致性校验 =====
    if (refund.amount > order.amount) {
      await restoreRefundPending(refundId);
      return { code: RESPONSE_CODE.ERROR, msg: '退款金额不能超过订单金额', data: {} };
    }
    const totalRefunded = (order.refund_amount || 0) + refund.amount;
    if (totalRefunded > order.amount) {
      await restoreRefundPending(refundId);
      return { code: RESPONSE_CODE.ERROR, msg: '累计退款超过订单金额', data: {} };
    }

    // 读取支付配置，判断是否 mock 模式（与 createOrder/payCallback 统一逻辑）
    let isMockPay;
    try {
      const payConfigDoc = await db.collection(COLLECTIONS.SYSTEM_CONFIG).doc('wechat_pay_config').get();
      isMockPay = payConfigDoc.data ? payConfigDoc.data.mock_pay === true : (process.env.MOCK_PAY === 'true');
    } catch (cfgErr) {
      console.warn('[processRefund] 支付配置读取失败，回退环境变量 MOCK_PAY:', cfgErr.message);
      isMockPay = process.env.MOCK_PAY === 'true';
    }

    // 执行微信退款：mock 模式直接成功，真实模式调用集成函数（F5 已恢复真实退款 API）
    let refundTransactionId;
    if (isMockPay) {
      // Mock 模式：直接成功（测试用）
      refundTransactionId = 'mock_refund_' + Date.now();
      console.log('[processRefund] mock 模式，跳过真实退款');
    } else {
      // 真实退款：调用集成中心云函数（与 createOrder 中 INTEGRATION_FUNCTION 一致）
      const INTEGRATION_FUNCTION = 'Mewora-1r02jkm1-demo-scfweb';
      try {
        const refundRes = await cloud.callFunction({
          name: INTEGRATION_FUNCTION,
          data: {
            action: '/wx-pay/refund',
            params: {
              out_trade_no: order.out_trade_no,
              out_refund_no: 'WELL_RF_' + Date.now(),
              amount: { refund: refund.amount, total: order.amount, currency: 'CNY' }
            }
          }
        });
        const refundResult = refundRes.result || refundRes;
        if (!refundResult || refundResult.code !== 0) {
          throw new Error('微信退款失败: ' + (refundResult ? refundResult.msg : '未知错误'));
        }
        refundTransactionId = (refundResult.data && refundResult.data.refund_id)
          ? refundResult.data.refund_id
          : 'refund_' + Date.now();
      } catch (refundError) {
        console.error('[processRefund] 退款失败:', refundError.message);
        // S1: 退款失败，恢复状态为 pending 以允许重试
        await restoreRefundPending(refundId);
        return { code: RESPONSE_CODE.ERROR, msg: '退款失败: ' + refundError.message, data: {} };
      }
    }

    // ===== 退款资金已实际退还，后续异常不再回滚到 pending（避免重复退款）=====
    refundApiSucceeded = true;

    // 更新退款记录为 completed
    await db.collection('refund_records').doc(refundId).update({
      data: {
        status: 'completed',
        reviewer: 'admin',
        reviewed_at: new Date(),
        transaction_id: refundTransactionId
      }
    });

    // 更新订单状态
    await db.collection(COLLECTIONS.ORDERS).doc(refund.order_id).update({
      data: {
        status: ORDER_STATUS.REFUNDED,
        refund_amount: _.inc(refund.amount),
        updated_at: new Date()
      }
    });

    // 回滚用户资源
    await rollbackUserResources(order);

    // 发送退款成功通知（非阻塞）
    try {
      await cloud.callFunction({
        name: 'sendPaymentNotification',
        data: {
          openid: refund.user_id,
          templateType: 'REFUND_SUCCESS',
          data: {
            productName: order.description || '健康报告',
            amountDisplay: (refund.amount / 100).toFixed(2),
            page: 'pages/order/detail?id=' + order._id,
          },
        },
      });
    } catch (notifyErr) {
      console.warn('[processRefund] 退款通知发送失败:', notifyErr.message);
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '退款成功',
      data: { refundTransactionId, amount: refund.amount }
    };

  } catch (error) {
    console.error('[processRefund] 失败:', error.message);
    // S1: 异常回滚状态——仅在退款资金尚未退还时恢复为 pending，允许重试；
    // 若退款已执行但后续更新失败，则保留 processing 状态供人工核查（不回滚以防重复退款）
    if (!refundApiSucceeded) {
      await restoreRefundPending(refundId);
    } else {
      console.error('[processRefund] 退款已执行但后续更新失败，需人工核查');
    }
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '退款操作失败，请稍后重试', data: {} };
  }
};

// S1 辅助：将退款记录从 processing 恢复为 pending（仅在退款资金未实际退还时调用，允许重试）
async function restoreRefundPending(refundId) {
  try {
    await db.collection('refund_records')
      .where({ _id: refundId, status: 'processing' })
      .update({ data: { status: 'pending', updated_at: new Date() } });
  } catch (e) {
    console.error('[processRefund] 恢复 pending 状态失败:', e.message);
  }
}

// 回滚用户资源
async function rollbackUserResources(order) {
  const metadata = order.metadata || {};

  // 会员订单：取消会员资格
  // 修复：metadata.member_id 从不被 createOrder 写入（原为死代码，回滚永远不执行），
  // 改为按 user_id 查询会员记录，与 closeExpiredOrders 对齐
  if (order.type === 'member') {
    try {
      const mRes = await db.collection(COLLECTIONS.MEMBERS)
        .where({ user_id: order.user_id }).limit(1).get();
      if (mRes.data && mRes.data.length > 0) {
        await db.collection(COLLECTIONS.MEMBERS).doc(mRes.data[0]._id).update({
          data: { status: 'refunded', updated_at: new Date() }
        });
      }
    } catch (e) { console.error('回滚会员失败:', e.message); }
  }

  // 报告订单：回滚会员额度（按 user_id 查询；条件更新 report_credits_used > 0 防止负数）
  if (order.type === 'report' && metadata.quota_source === 'member') {
    try {
      const mRes = await db.collection(COLLECTIONS.MEMBERS)
        .where({ user_id: order.user_id, report_credits_used: _.gt(0) }).limit(1).get();
      if (mRes.data && mRes.data.length > 0) {
        await db.collection(COLLECTIONS.MEMBERS).doc(mRes.data[0]._id)
          .update({ data: { report_credits_used: _.inc(-1), updated_at: new Date() } });
      }
    } catch (e) { console.error('回滚额度失败:', e.message); }
  }

  // 释放优惠券
  if (metadata.coupon_user_id) {
    try {
      await db.collection('user_coupons').doc(metadata.coupon_user_id).update({
        data: { status: 'unused', order_id: '', updated_at: new Date() }
      });
    } catch (e) { /* 静默 */ }
  }
}
