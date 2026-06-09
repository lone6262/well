// 定时关闭超时未支付订单
// 触发方式：定时触发器（每 10 分钟）
// 逻辑：扫描 pending 且 created_at < now - 30min 的订单，标记为 closed，释放占用的资源
const cloud = require('wx-server-sdk');
const { COLLECTIONS, ORDER_STATUS, PAYMENT_TIMEOUT , warmupConfig} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);
  const now = new Date();
  const timeoutMs = (PAYMENT_TIMEOUT || 30) * 60 * 1000;
  const cutoff = new Date(now.getTime() - timeoutMs);

  console.log('[closeExpiredOrders] 开始扫描, cutoff:', cutoff.toISOString());

  try {
    // 扫描所有超时的 pending 订单
    const result = await db.collection(COLLECTIONS.ORDERS)
      .where({
        status: ORDER_STATUS.PENDING,
        created_at: _.lt(cutoff)
      })
      .limit(100)
      .get();

    const expiredOrders = result.data;
    if (!expiredOrders || expiredOrders.length === 0) {
      console.log('[closeExpiredOrders] 无超时订单');
      return { code: 0, msg: '无超时订单', data: { closedCount: 0 } };
    }

    let closedCount = 0;
    let failCount = 0;

    for (const order of expiredOrders) {
      try {
        // 1. 关闭订单
        await db.collection(COLLECTIONS.ORDERS).doc(order._id).update({
          data: {
            status: ORDER_STATUS.CLOSED,
            closed_at: now,
            close_reason: 'timeout',
            updated_at: now
          }
        });

        // 2. 释放资源（回滚已占用的额度）
        await rollbackOrderResources(order);

        // 3. 发送订单超时通知（非阻塞）
        try {
          await cloud.callFunction({
            name: 'sendPaymentNotification',
            data: {
              openid: order.user_id,
              templateType: 'ORDER_TIMEOUT',
              data: {
                productName: order.description || '订单',
                page: 'pages/index/index',
              },
            },
          });
        } catch (notifyErr) {
          console.warn('[closeExpiredOrders] 超时通知发送失败:', notifyErr.message);
        }

        closedCount++;
        console.log('[closeExpiredOrders] 关闭订单:', order._id, order.out_trade_no);
      } catch (err) {
        failCount++;
        console.error('[closeExpiredOrders] 关闭订单失败:', order._id, err.message);
      }
    }

    console.log('[closeExpiredOrders] 完成, closed:', closedCount, 'failed:', failCount);
    return {
      code: 0,
      msg: '执行完成',
      data: { closedCount, failCount, totalCount: expiredOrders.length }
    };

  } catch (error) {
    console.error('[closeExpiredOrders] 扫描失败:', error.message);
    return { code: -1, msg: '执行失败: ' + error.message, data: {} };
  }
};

// 回滚订单占用的资源
async function rollbackOrderResources(order) {
  const openid = order.user_id;
  const metadata = order.metadata || {};

  // 会员订单：无需回滚（会员额度在 payCallback 中才扣减）
  // 点数包订单：无需回滚（点数在 payCallback 中才到账）
  // 报告订单：回滚已预扣的会员额度
  if (order.type === 'report' && metadata.quota_source === 'member' && metadata.member_id) {
    try {
      await db.collection(COLLECTIONS.MEMBERS).doc(metadata.member_id).update({
        data: {
          report_credits_used: _.inc(-1),
          updated_at: new Date()
        }
      });
      console.log('[closeExpiredOrders] 回滚会员额度, member:', metadata.member_id);
    } catch (err) {
      console.error('[closeExpiredOrders] 回滚会员额度失败:', err.message);
    }
  }

  // 回滚已锁定的优惠券
  if (metadata.coupon_user_id) {
    try {
      await db.collection('user_coupons').doc(metadata.coupon_user_id).update({
        data: {
          status: 'unused',
          order_id: '',
          updated_at: new Date()
        }
      });
      console.log('[closeExpiredOrders] 释放优惠券:', metadata.coupon_user_id);
    } catch (err) {
      // 优惠券集合可能还不存在（1B 阶段才创建），静默忽略
    }
  }
}
