// 查询用户点数余额
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { verifyToken } = require('./common/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { token } = event;

  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }

  try {
    const result = await db.collection('user_points')
      .where({ user_id: openid }).limit(1).get();

    if (!result.data || result.data.length === 0) {
      return { code: RESPONSE_CODE.SUCCESS, msg: '成功', data: { balance: 0, expireAt: null } };
    }

    const record = result.data[0];
    const isExpired = record.expire_at && new Date(record.expire_at) < new Date();

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '成功',
      data: {
        balance: isExpired ? 0 : record.balance,
        totalPurchased: record.total_purchased || 0,
        totalUsed: record.total_used || 0,
        expireAt: record.expire_at,
        isExpired: isExpired
      }
    };
  } catch (error) {
    console.error('[getPointsBalance] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询失败', data: {} };
  }
};
