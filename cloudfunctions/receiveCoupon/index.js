// 用户领取优惠券
// 校验 per_user_limit + total_limit，创建 user_coupons 记录
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { verifyToken } = require('./common/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { couponId, token } = event;

  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }
  if (!openid || !couponId) {
    return { code: RESPONSE_CODE.ERROR, msg: '参数不完整', data: {} };
  }

  try {
    // 查询券模板
    const couponResult = await db.collection('coupons').doc(couponId).get();
    const coupon = couponResult.data;

    if (!coupon || !coupon.is_active) {
      return { code: RESPONSE_CODE.ERROR, msg: '优惠券不存在或已下架', data: {} };
    }

    // 校验总发行量
    if (coupon.total_limit && (coupon.total_issued || 0) >= coupon.total_limit) {
      return { code: RESPONSE_CODE.ERROR, msg: '优惠券已领完', data: {} };
    }

    // 校验每人限领数
    if (coupon.per_user_limit) {
      const userCount = await db.collection('user_coupons')
        .where({ user_id: openid, coupon_id: couponId })
        .count();
      if (userCount.total >= coupon.per_user_limit) {
        return { code: RESPONSE_CODE.ERROR, msg: '您已领取过该优惠券', data: {} };
      }
    }

    // 创建用户券记录
    const expireAt = new Date(Date.now() + (coupon.validity_days || 30) * 24 * 60 * 60 * 1000);
    const userCoupon = {
      user_id: openid,
      coupon_id: couponId,
      status: 'unused',
      expire_at: expireAt,
      used_at: null,
      order_id: '',
      created_at: new Date()
    };

    const addResult = await db.collection('user_coupons').add({ data: userCoupon });

    // 原子递增已发行量
    await db.collection('coupons').doc(couponId).update({
      data: { total_issued: _.inc(1) }
    });

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '领取成功',
      data: { userCouponId: addResult._id, expireAt }
    };
  } catch (error) {
    console.error('[receiveCoupon] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '领取失败', data: {} };
  }
};
