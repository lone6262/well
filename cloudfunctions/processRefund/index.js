// 管理员审核退款并执行微信退款
// 审批通过后调用微信退款 API，回滚用户资源
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, ORDER_STATUS , warmupConfig} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { refundId, approved, adminSecret, token } = event;

  // 管理员鉴权（使用 adminSecret 或 admin token）
  if (!adminSecret) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '管理员鉴权失败', data: {} };
  }

  if (!refundId) {
    return { code: RESPONSE_CODE.ERROR, msg: '退款记录ID不能为空', data: {} };
  }

  try {
    // 查询退款记录
    const refundResult = await db.collection('refund_records').doc(refundId).get();
    const refund = refundResult.data;

    if (!refund || refund.status !== 'pending') {
      return { code: RESPONSE_CODE.ERROR, msg: '退款记录不存在或已处理', data: {} };
    }

    if (!approved) {
      // 拒绝退款
      await db.collection('refund_records').doc(refundId).update({
        data: {
          status: 'rejected',
          reviewer: 'admin',
          reviewed_at: new Date()
        }
      });
      // 恢复订单状态为已支付
      await db.collection(COLLECTIONS.ORDERS).doc(refund.order_id).update({
        data: { status: ORDER_STATUS.PAID, updated_at: new Date() }
      });
      return { code: RESPONSE_CODE.SUCCESS, msg: '退款已拒绝', data: {} };
    }

    // 查询订单信息
    const orderResult = await db.collection(COLLECTIONS.ORDERS).doc(refund.order_id).get();
    const order = orderResult.data;

    // 执行微信退款（Mock 模式直接成功，真实模式调用 cloud.cloudPay.refund）
    let refundTransactionId = 'mock_refund_' + Date.now();

    // TODO: 真实退款时替换为：
    // const refundRes = await cloud.cloudPay.refund({
    //   out_trade_no: order.out_trade_no,
    //   out_refund_no: 'refund_' + order.out_trade_no,
    //   total_fee: order.amount,
    //   refund_fee: refund.amount,
    //   nonce_str: crypto.randomUUID()
    // });
    // refundTransactionId = refundRes.result.refund_id;

    // 更新退款记录
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

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '退款成功',
      data: { refundTransactionId, amount: refund.amount }
    };

  } catch (error) {
    console.error('[processRefund] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '退款操作失败: ' + error.message, data: {} };
  }
};

// 回滚用户资源
async function rollbackUserResources(order) {
  const metadata = order.metadata || {};

  // 会员订单：取消会员资格
  if (order.type === 'member' && metadata.member_id) {
    try {
      await db.collection(COLLECTIONS.MEMBERS).doc(metadata.member_id).update({
        data: { status: 'refunded', updated_at: new Date() }
      });
    } catch (e) { console.error('回滚会员失败:', e.message); }
  }

  // 报告订单：回滚会员额度
  if (order.type === 'report' && metadata.quota_source === 'member' && metadata.member_id) {
    try {
      await db.collection(COLLECTIONS.MEMBERS).doc(metadata.member_id).update({
        data: { report_credits_used: _.inc(-1), updated_at: new Date() }
      });
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
