// 消耗点数（内部调用，由 createOrder 使用）
// 原子扣减 balance，记录交易
const cloud = require('wx-server-sdk');
const { warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { orderId } = event;

  if (!openid) return { success: false, msg: '用户未登录' };

  try {
    const existing = await db.collection('user_points')
      .where({ user_id: openid, balance: _.gt(0) })
      .limit(1).get();

    if (!existing.data || existing.data.length === 0) {
      return { success: false, msg: '无可用点数' };
    }

    const record = existing.data[0];

    // 检查过期
    if (record.expire_at && new Date(record.expire_at) < new Date()) {
      return { success: false, msg: '点数已过期' };
    }

    if (record.balance < 1) {
      return { success: false, msg: '点数余额不足' };
    }

    // 原子扣减
    await db.collection('user_points').doc(record._id).update({
      data: { balance: _.inc(-1), total_used: _.inc(1), updated_at: new Date() }
    });

    // 记录交易
    await db.collection('point_transactions').add({
      data: {
        user_id: openid, type: 'consume', amount: 1,
        order_id: orderId || '', balance_after: record.balance - 1,
        created_at: new Date()
      }
    });

    return { success: true, msg: '扣减成功', data: { balanceAfter: record.balance - 1 } };
  } catch (error) {
    console.error('[consumePoint] 失败:', error.message);
    return { success: false, msg: error.message };
  }
};
