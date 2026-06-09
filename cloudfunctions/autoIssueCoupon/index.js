// 自动发放优惠券
// 场景：新用户注册、回访完成、邀请奖励、续费召回、流失回归
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 优惠券场景 → 券模板 scene 字段映射
 * 每个场景对应 coupons 集合中 scene 字段的值
 */
const SCENE_COUPON_MAP = {
  new_user: 'new_user',       // 新用户专享券（注册自动发放）
  invite: 'invite',           // 邀请奖励券（邀请双方各得）
  followup: 'followup',       // 回访奖励券（完成 24h 回访）
  renew: 'renew',             // 续费 8 折券（到期前 7 天）
  return: 'return',           // 回归券（流失 30 天召回）
  invite_milestone_5: 'invite_milestone_5',  // 邀请 5 人奖励：会员 5 元券
};

/**
 * 自动发放优惠券
 *
 * @param {string} userId  - 接收券的用户 openid
 * @param {string} scene   - 发券场景：new_user | invite | followup | renew | return | invite_milestone_5
 * @param {object} options - 额外参数（如 couponId 指定特定券模板）
 * @returns {object} 发放结果
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { userId, scene, options = {} } = event;

  // 参数校验
  if (!userId || !scene) {
    return { code: RESPONSE_CODE.ERROR, msg: '参数不完整：需要 userId 和 scene', data: {} };
  }

  const validScenes = Object.keys(SCENE_COUPON_MAP);
  if (!validScenes.includes(scene)) {
    return { code: RESPONSE_CODE.ERROR, msg: `无效的 scene: ${scene}`, data: {} };
  }

  try {
    // 查找匹配场景的活跃券模板
    const query = {
      scene: SCENE_COUPON_MAP[scene],
      is_active: true,
    };

    // 如果指定了特定券 ID，则优先使用
    if (options.couponId) {
      query._id = options.couponId;
    }

    const couponResult = await db.collection('coupons')
      .where(query)
      .limit(5)
      .get();

    if (!couponResult.data || couponResult.data.length === 0) {
      console.warn(`[autoIssueCoupon] 场景 ${scene} 无可用券模板`);
      return { code: RESPONSE_CODE.ERROR, msg: '当前无可用优惠券', data: {} };
    }

    // 取第一张匹配的券模板
    const coupon = couponResult.data[0];

    // 校验总发行量
    if (coupon.total_limit && (coupon.total_issued || 0) >= coupon.total_limit) {
      console.warn(`[autoIssueCoupon] 券 ${coupon._id} 已达发行上限`);
      return { code: RESPONSE_CODE.ERROR, msg: '优惠券已发完', data: {} };
    }

    // 校验每人限领数
    if (coupon.per_user_limit) {
      const userCount = await db.collection('user_coupons')
        .where({ user_id: userId, coupon_id: coupon._id })
        .count();

      if (userCount.total >= coupon.per_user_limit) {
        console.info(`[autoIssueCoupon] 用户 ${userId} 已达券 ${coupon._id} 的领取上限`);
        return { code: RESPONSE_CODE.SUCCESS, msg: '已领取过该优惠券', data: { skipped: true } };
      }
    }

    // 场景特有校验
    if (scene === 'new_user') {
      // 新用户券：仅限注册 7 天内的新用户
      const userResult = await db.collection('users')
        .where({ user_id: userId })
        .limit(1)
        .get();

      if (userResult.data && userResult.data.length > 0) {
        const createdAt = new Date(userResult.data[0].created_at);
        const daysSinceRegister = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
        if (daysSinceRegister > 7) {
          return { code: RESPONSE_CODE.ERROR, msg: '非新用户，无法领取新用户券', data: { skipped: true } };
        }
      }
    }

    if (scene === 'return') {
      // 回归券：验证用户确实流失（会员过期 ≥ 30 天 或 无消费 ≥ 30 天）
      const memberResult = await db.collection('members')
        .where({ user_id: userId })
        .limit(1)
        .get();

      if (memberResult.data && memberResult.data.length > 0) {
        const expireDate = new Date(memberResult.data[0].expire_date);
        const daysSinceExpire = (Date.now() - expireDate.getTime()) / (24 * 60 * 60 * 1000);
        if (daysSinceExpire < 30) {
          return { code: RESPONSE_CODE.ERROR, msg: '未达到流失召回条件', data: { skipped: true } };
        }
      }
    }

    // 计算过期时间
    const validityDays = coupon.validity_days || getSceneDefaultValidityDays(scene);
    const expireAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    // 创建用户券记录
    const userCoupon = {
      user_id: userId,
      coupon_id: coupon._id,
      status: 'unused',
      expire_at: expireAt,
      used_at: null,
      order_id: '',
      created_at: new Date(),
    };

    const addResult = await db.collection('user_coupons').add({ data: userCoupon });

    // 原子递增已发行量
    await db.collection('coupons').doc(coupon._id).update({
      data: { total_issued: _.inc(1) },
    });

    console.log(`[autoIssueCoupon] ✅ 场景 ${scene} 给用户 ${userId} 发放券 ${coupon._id}`);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '优惠券发放成功',
      data: {
        userCouponId: addResult._id,
        couponId: coupon._id,
        couponName: coupon.name,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        expireAt,
      },
    };
  } catch (error) {
    console.error('[autoIssueCoupon] 发放失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '优惠券发放失败', data: {} };
  }
};

/**
 * 根据场景返回默认有效期（天）
 */
function getSceneDefaultValidityDays(scene) {
  const defaults = {
    new_user: 7,
    invite: 30,
    followup: 30,
    renew: 15,
    return: 15,
    invite_milestone_5: 30,
  };
  return defaults[scene] || 30;
}
