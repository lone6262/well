/**
 * 获取公开优惠券列表（无需管理员权限）
 * 供小程序前端领券中心调用
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  try {
    const result = await db.collection('coupons')
      .where({ is_active: true })
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();

    const coupons = (result.data || []).map(c => ({
      _id: c._id,
      name: c.name,
      type: c.type,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_amount: c.min_amount || 0,
      validity_days: c.validity_days || 30,
      scene: c.scene,
      total_limit: c.total_limit,
      total_issued: c.total_issued || 0,
    }));

    return { code: 0, msg: '查询成功', data: { coupons } };
  } catch (err) {
    console.error('[getCoupons] 查询失败:', err);
    return { code: -1, msg: '查询失败', data: { coupons: [] } };
  }
};
