// 退还点数（退款场景）
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
      .where({ user_id: openid }).limit(1).get();

    if (!existing.data || existing.data.length === 0) {
      return { success: false, msg: '无点数记录' };
    }

    const record = existing.data[0];
    await db.collection('user_points').doc(record._id).update({
      data: { balance: _.inc(1), total_used: _.inc(-1), updated_at: new Date() }
    });

    await db.collection('point_transactions').add({
      data: {
        user_id: openid, type: 'refund', amount: 1,
        order_id: orderId || '', balance_after: record.balance + 1,
        created_at: new Date()
      }
    });

    return { success: true, msg: '退还成功' };
  } catch (error) {
    console.error('[refundPoint] 失败:', error.message);
    return { success: false, msg: error.message };
  }
};
