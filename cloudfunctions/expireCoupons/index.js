// 定时任务：批量过期到期优惠券
const cloud = require('wx-server-sdk');
const { warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);
  const now = new Date();

  try {
    // 批量标记过期的 unused 券
    const result = await db.collection('user_coupons')
      .where({ status: 'unused', expire_at: _.lt(now) })
      .limit(200)
      .get();

    if (!result.data || result.data.length === 0) {
      return { code: 0, msg: '无过期券', data: { expiredCount: 0 } };
    }

    let count = 0;
    for (const uc of result.data) {
      try {
        await db.collection('user_coupons').doc(uc._id).update({
          data: { status: 'expired', updated_at: now }
        });
        count++;
      } catch (e) { /* 静默 */ }
    }

    return { code: 0, msg: '执行完成', data: { expiredCount: count } };
  } catch (error) {
    console.error('[expireCoupons] 失败:', error.message);
    return { code: -1, msg: '执行失败，请稍后重试', data: {} };
  }
};
