// 订单详情云函数
// 查询单个订单的完整信息，验证用户归属
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE , warmupConfig} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 获取订单详情
 *
 * @param {string} orderId - 订单ID
 * @returns {object} { code, msg, data: { order } }
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { orderId } = event;

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (!orderId) {
    return { code: RESPONSE_CODE.ERROR, msg: '订单ID不能为空', data: {} };
  }

  try {
    const orderResult = await db.collection(COLLECTIONS.ORDERS).doc(orderId).get();
    const order = orderResult.data;

    if (!order) {
      return { code: RESPONSE_CODE.NOT_FOUND, msg: '订单不存在', data: {} };
    }

    // 验证订单归属
    if (order.user_id !== openid) {
      return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '无权查看此订单', data: {} };
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '查询成功',
      data: {
        order: {
          _id: order._id,
          type: order.type,
          status: order.status,
          amount: order.amount,
          amountDisplay: ((order.amount || 0) / 100).toFixed(2),
          out_trade_no: order.out_trade_no,
          transaction_id: order.transaction_id,
          description: order.description,
          metadata: order.metadata,
          paid_at: order.paid_at,
          created_at: order.created_at,
          updated_at: order.updated_at
        }
      }
    };

  } catch (error) {
    console.error('查询订单详情失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询订单详情失败', data: {} };
  }
};
