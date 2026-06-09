// 查询点数交易记录
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { verifyToken } = require('./common/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { token, limit, offset } = event;

  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }

  try {
    const queryLimit = Math.min(limit || 20, 100);
    const queryOffset = offset || 0;

    const result = await db.collection('point_transactions')
      .where({ user_id: openid })
      .orderBy('created_at', 'desc')
      .skip(queryOffset)
      .limit(queryLimit)
      .get();

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '成功',
      data: {
        transactions: result.data || [],
        hasMore: result.data && result.data.length === queryLimit
      }
    };
  } catch (error) {
    console.error('[getPointTransactions] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询失败', data: {} };
  }
};
