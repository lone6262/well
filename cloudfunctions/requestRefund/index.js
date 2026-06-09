// 用户提交退款申请
// 创建退款记录，状态为 pending，等待管理员审核
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, ORDER_STATUS , warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { orderId, reason, token } = event;

  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }
  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (!orderId) {
    return { code: RESPONSE_CODE.ERROR, msg: '订单ID不能为空', data: {} };
  }

  try {
    // 查询订单
    const orderResult = await db.collection(COLLECTIONS.ORDERS).doc(orderId).get();
    const order = orderResult.data;

    if (order.user_id !== openid) {
      return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '无权操作此订单', data: {} };
    }
    if (order.status !== ORDER_STATUS.PAID) {
      return { code: RESPONSE_CODE.ERROR, msg: '当前订单状态不可退款', data: {} };
    }

    // 检查是否已有待审核的退款记录
    const existingRefund = await db.collection('refund_records')
      .where({ order_id: orderId, status: 'pending' })
      .limit(1).get();

    if (existingRefund.data && existingRefund.data.length > 0) {
      return { code: RESPONSE_CODE.ERROR, msg: '该订单已有待审核的退款申请', data: {} };
    }

    // 创建退款记录
    const refundRecord = {
      order_id: orderId,
      user_id: openid,
      type: 'user_request',
      amount: order.amount || 0,
      reason: reason || '用户主动申请退款',
      status: 'pending',
      reviewer: '',
      reviewed_at: null,
      transaction_id: '',
      created_at: new Date()
    };

    const addResult = await db.collection('refund_records').add({ data: refundRecord });

    // 更新订单状态为退款中
    await db.collection(COLLECTIONS.ORDERS).doc(orderId).update({
      data: { status: 'refund_requested', updated_at: new Date() }
    });

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '退款申请已提交，预计 T+1~3 个工作日处理',
      data: { refundId: addResult._id }
    };

  } catch (error) {
    console.error('[requestRefund] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '操作失败，请稍后重试', data: {} };
  }
};
