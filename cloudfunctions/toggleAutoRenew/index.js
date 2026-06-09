// 用户手动开启/关闭自动续费
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, RESPONSE_CODE, MEMBER_STATUS, warmupConfig
} = require('./common/constants');
const { verifyToken } = require('./common/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { enabled, token } = event;

  // 验证身份
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }
  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  // 验证 enabled 参数
  if (typeof enabled !== 'boolean') {
    return { code: RESPONSE_CODE.ERROR, msg: 'enabled 参数必须为布尔值', data: {} };
  }

  try {
    // 查找当前用户的活跃会员
    const { data: members } = await db.collection(COLLECTIONS.MEMBERS)
      .where({
        user_id: openid,
        status: MEMBER_STATUS.ACTIVE,
      })
      .get();

    if (!members || members.length === 0) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '未找到有效会员',
        data: {},
      };
    }

    const member = members[0];
    const now = new Date();

    // 更新自动续费状态，清零失败计数
    await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
      data: {
        auto_renew: enabled,
        renew_fail_count: 0,
        updated_at: now,
      },
    });

    // 记录操作日志
    await db.collection(COLLECTIONS.MEMBER_RENEW_LOG).add({
      data: {
        member_id: member._id,
        user_id: openid,
        action: enabled ? 'renew' : 'cancel',
        channel: 'manual',
        plan_type: member.plan_type || 'unknown',
        created_at: now,
      },
    });

    // 返回更新后的会员信息
    const updatedMember = {
      _id: member._id,
      plan_type: member.plan_type,
      expire_date: member.expire_date,
      auto_renew: enabled,
    };

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: enabled ? '已开启自动续费' : '已关闭自动续费',
      data: { member: updatedMember },
    };
  } catch (error) {
    console.error('[toggleAutoRenew] 操作失败:', error.message);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '操作失败，请稍后重试',
      data: {},
    };
  }
};
