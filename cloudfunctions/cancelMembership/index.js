// 取消会员自动续费云函数
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, MEMBER_STATUS , warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 取消会员自动续费
 * 会员本身不会取消，仅关闭自动续费标志
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  let OPENID_OBJ = cloud.getWXContext();
  let openid = OPENID_OBJ.OPENID;
  let token = event.token;

  // Token 验证（写操作需验证身份）
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败，请重新登录', data: {} };
  }

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    // 查询活跃会员记录
    let memberResult = await db.collection(COLLECTIONS.MEMBERS)
      .where({
        user_id: openid,
        status: MEMBER_STATUS.ACTIVE
      })
      .limit(1)
      .get();

    if (!memberResult.data || memberResult.data.length === 0) {
      return { code: RESPONSE_CODE.NOT_FOUND, msg: '无有效会员', data: {} };
    }

    let member = memberResult.data[0];

    // 更新自动续费标志
    await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
      data: {
        auto_renew: false,
        updated_at: new Date()
      }
    });

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '自动续费已取消',
      data: {
        member_id: member._id,
        auto_renew: false,
        expire_date: member.expire_date
      }
    };

  } catch (error) {
    console.error('[cancelMembership] fail:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '操作失败，请稍后重试', data: {} };
  }
};
