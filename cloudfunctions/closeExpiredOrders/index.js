// 定时关闭超时未支付订单
// 触发方式：定时触发器（每 10 分钟）
// 逻辑：扫描 pending 且 created_at < now - 30min 的订单，标记为 closed，释放占用的资源
const cloud = require('wx-server-sdk');
const { COLLECTIONS, ORDER_STATUS, PAYMENT_TIMEOUT , warmupConfig} = require('./common/constants');
const { MEMBER_STATUS } = require('./common/constants');

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
    return { code: -1, msg: '执行失败，请稍后重试', data: {} };
  }
};

// 回滚订单占用的资源
// 修复：原逻辑依赖 metadata.member_id（createOrder 从不写入），导致回滚永远不执行
// 新逻辑：按 quota_source 分类回滚，与 deductQuota 对称
async function rollbackOrderResources(order) {
  const openid = order.user_id;
  const metadata = order.metadata || {};
  const quotaSource = metadata.quota_source;
  const now = new Date();

  // 仅报告订单在 createOrder 时预扣了额度（会员/点数/套餐在 payCallback 时才扣减）
  if (order.type === 'report' && quotaSource) {
    if (quotaSource === 'member') {
      try {
        const mRes = await db.collection(COLLECTIONS.MEMBERS)
          .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE }).limit(1).get();
        if (mRes.data && mRes.data.length > 0) {
          await db.collection(COLLECTIONS.MEMBERS).doc(mRes.data[0]._id).update({
            data: { report_credits_used: _.inc(-1), updated_at: now }
          });
          console.log('[closeExpiredOrders] 回滚会员额度:', openid);
        }
      } catch (err) { console.error('[closeExpiredOrders] 回滚会员额度失败:', err.message); }
    } else if (quotaSource === 'first_report') {
      try {
        await db.collection(COLLECTIONS.USERS).where({ user_id: openid })
          .update({ data: { first_report_used: false, updated_at: now } });
        console.log('[closeExpiredOrders] 回滚首份免费:', openid);
      } catch (err) { console.error('[closeExpiredOrders] 回滚首份免费失败:', err.message); }
    } else if (quotaSource === 'invite') {
      try {
        await db.collection(COLLECTIONS.USERS).where({ user_id: openid })
          .update({ data: { invite_reward_credits: _.inc(1), updated_at: now } });
        console.log('[closeExpiredOrders] 回滚邀请奖励:', openid);
      } catch (err) { console.error('[closeExpiredOrders] 回滚邀请奖励失败:', err.message); }
    } else if (quotaSource === 'points') {
      try {
        const pRes = await db.collection(COLLECTIONS.USER_POINTS).where({ user_id: openid }).limit(1).get();
        if (pRes.data && pRes.data.length > 0) {
          await db.collection(COLLECTIONS.USER_POINTS).doc(pRes.data[0]._id).update({
            data: { balance: _.inc(1), updated_at: now }
          });
          console.log('[closeExpiredOrders] 回滚点数包:', openid);
        }
      } catch (err) { console.error('[closeExpiredOrders] 回滚点数包失败:', err.message); }
    }
    // quotaSource === 'paid'：无额度预扣，无需回滚
  }

  // 释放已锁定的优惠券
  if (metadata.coupon_user_id) {
    try {
      await db.collection('user_coupons').doc(metadata.coupon_user_id).update({
        data: {
          status: 'unused',
          order_id: '',
          updated_at: now
        }
      });
      console.log('[closeExpiredOrders] 释放优惠券:', metadata.coupon_user_id);
    } catch (err) {
      // 优惠券集合可能尚未创建，静默忽略
    }
  }
}
