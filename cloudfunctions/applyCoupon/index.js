// 下单时锁定优惠券（内部调用，由 createOrder 使用）
// 计算优惠后金额，锁定券状态
const cloud = require('wx-server-sdk');
const { warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { userCouponId, orderAmount, orderType } = event;

  if (!openid || !userCouponId || !orderAmount) {
    return { success: false, msg: '参数不完整' };
  }

  try {
    // 查询用户券
    const ucResult = await db.collection('user_coupons').doc(userCouponId).get();
    const userCoupon = ucResult.data;

    if (!userCoupon || userCoupon.user_id !== openid || userCoupon.status !== 'unused') {
      return { success: false, msg: '优惠券不可用' };
    }
    if (new Date(userCoupon.expire_at) < new Date()) {
      return { success: false, msg: '优惠券已过期' };
    }

    // 查询券模板
    const tmplResult = await db.collection('coupons').doc(userCoupon.coupon_id).get();
    const coupon = tmplResult.data;

    if (!coupon || !coupon.is_active) {
      return { success: false, msg: '优惠券已失效' };
    }
    // 校验适用商品类型
    if (coupon.type && coupon.type !== 'universal' && coupon.type !== orderType) {
      return { success: false, msg: '优惠券不适用当前商品' };
    }
    // 校验最低金额
    if (coupon.min_amount && orderAmount < coupon.min_amount) {
      return { success: false, msg: '未达到最低使用金额' };
    }

    // 计算优惠金额
    let discount = 0;
    if (coupon.discount_type === 'fixed') {
      discount = coupon.discount_value || 0;
    } else if (coupon.discount_type === 'percent') {
      discount = Math.floor(orderAmount * (100 - (coupon.discount_value || 100)) / 100);
    }

    const payAmount = Math.max(orderAmount - discount, 0);

    // 锁定券
    await db.collection('user_coupons').doc(userCouponId).update({
      data: { status: 'locked', order_id: '', updated_at: new Date() }
    });

    return {
      success: true,
      msg: '优惠券已锁定',
      data: {
        discount,
        payAmount,
        couponName: coupon.name,
        userCouponId
      }
    };
  } catch (error) {
    console.error('[applyCoupon] 失败:', error.message);
    return { success: false, msg: error.message };
  }
};
