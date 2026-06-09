// 订单关闭/退款时释放优惠券
const cloud = require('wx-server-sdk');
const { warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { userCouponId } = event;
  if (!userCouponId) return { success: true, msg: '无券需释放' };

  try {
    await db.collection('user_coupons').doc(userCouponId).update({
      data: { status: 'unused', order_id: '', updated_at: new Date() }
    });
    return { success: true, msg: '优惠券已释放' };
  } catch (error) {
    console.error('[rollbackCoupon] 失败:', error.message);
    return { success: false, msg: error.message };
  }
};
