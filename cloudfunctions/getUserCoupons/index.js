// 查询用户可用优惠券
// 关联 coupons 集合返回完整信息
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { verifyToken } = require('./common/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { token, status, orderType } = event;

  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }

  try {
    const now = new Date();
    let query = { user_id: openid };

    // 按状态筛选：unused / used / expired
    if (status === 'unused') {
      query.status = 'unused';
      query.expire_at = _.gte(now);
    } else if (status) {
      query.status = status;
    }

    const result = await db.collection('user_coupons')
      .where(query)
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();

    const coupons = result.data || [];

    // 关联券模板信息
    const enriched = [];
    for (const uc of coupons) {
      try {
        const tmpl = await db.collection('coupons').doc(uc.coupon_id).get();
        // 按订单类型过滤适用商品
        if (orderType && tmpl.data && tmpl.data.type && tmpl.data.type !== orderType && tmpl.data.type !== 'universal') {
          continue;
        }
        enriched.push({
          ...uc,
          couponName: tmpl.data.name,
          couponType: tmpl.data.type,
          discountType: tmpl.data.discount_type,
          discountValue: tmpl.data.discount_value,
          minAmount: tmpl.data.min_amount || 0,
          scene: tmpl.data.scene
        });
      } catch (e) {
        // 券模板可能被删除，跳过
      }
    }

    return { code: RESPONSE_CODE.SUCCESS, msg: '成功', data: { coupons: enriched } };
  } catch (error) {
    console.error('[getUserCoupons] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询失败', data: {} };
  }
};

const _ = db.command;
