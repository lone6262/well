// 用户主动取消待支付订单
// 回滚已占用的资源（会员额度、优惠券等）
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, ORDER_STATUS , warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { orderId, token } = event;

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

    // 验证归属
    if (order.user_id !== openid) {
      return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '无权操作此订单', data: {} };
    }

    // 仅 pending 状态可取消
    if (order.status !== ORDER_STATUS.PENDING) {
      return { code: RESPONSE_CODE.ERROR, msg: '当前订单状态不可取消', data: {} };
    }

    // 关闭订单
    await db.collection(COLLECTIONS.ORDERS).doc(orderId).update({
      data: {
        status: ORDER_STATUS.CLOSED,
        closed_at: new Date(),
        close_reason: 'user_cancel',
        updated_at: new Date()
      }
    });

    // 回滚资源：报告订单的会员额度
    // 修复：metadata.member_id 从不被 createOrder 写入（原为死代码），改为按 user_id 查询，
    // 与 closeExpiredOrders / processRefund 对齐
    const metadata = order.metadata || {};
    if (order.type === 'report' && metadata.quota_source === 'member') {
      try {
        const mRes = await db.collection(COLLECTIONS.MEMBERS)
          .where({ user_id: order.user_id, report_credits_used: _.gt(0) }).limit(1).get();
        if (mRes.data && mRes.data.length > 0) {
          await db.collection(COLLECTIONS.MEMBERS).doc(mRes.data[0]._id).update({
            data: { report_credits_used: _.inc(-1), updated_at: new Date() }
          });
        }
      } catch (e) {
        console.error('[cancelOrder] 回滚会员额度失败:', e.message);
      }
    }

    if (metadata.coupon_user_id) {
      try {
        await db.collection('user_coupons').doc(metadata.coupon_user_id).update({
          data: { status: 'unused', order_id: '', updated_at: new Date() }
        });
      } catch (e) {
        // 优惠券集合可能还未创建
      }
    }

    return { code: RESPONSE_CODE.SUCCESS, msg: '订单已取消', data: { orderId } };

  } catch (error) {
    console.error('[cancelOrder] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '操作失败，请稍后重试', data: {} };
  }
};
