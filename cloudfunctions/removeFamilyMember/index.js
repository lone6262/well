// 主账号移除家庭成员
// 从会员记录中移除成员，并更新被移除用户的用户记录
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  MEMBER_STATUS,
  warmupConfig
} = require('./common/constants');
const { verifyToken } = require('./common/auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { token, targetUserId } = event;

  // ---- 参数校验 ----
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }
  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (!targetUserId) {
    return { code: RESPONSE_CODE.ERROR, msg: '目标用户ID不能为空', data: {} };
  }

  try {
    // ---- 查询主账号的会员记录 ----
    const memberResult = await db.collection(COLLECTIONS.MEMBERS)
      .where({
        user_id: openid,
        status: MEMBER_STATUS.ACTIVE,
        type: _.regex(/^family_/)
      })
      .limit(1)
      .get();

    if (!memberResult.data || memberResult.data.length === 0) {
      return { code: RESPONSE_CODE.ERROR, msg: '您没有有效的家庭会员', data: {} };
    }

    const member = memberResult.data[0];
    const familyMemberIds = member.family_member_ids || [];

    // ---- 验证目标用户在家庭成员列表中 ----
    if (!familyMemberIds.includes(targetUserId)) {
      return { code: RESPONSE_CODE.ERROR, msg: '该用户不是您的家庭成员', data: {} };
    }

    // ---- 从家庭成员列表中移除 ----
    const updatedFamilyMemberIds = familyMemberIds.filter(id => id !== targetUserId);
    const now = new Date();

    await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
      data: {
        family_member_ids: updatedFamilyMemberIds,
        updated_at: now
      }
    });

    // ---- 更新被移除用户的 users 记录 ----
    const targetUserResult = await db.collection(COLLECTIONS.USERS)
      .where({ _openid: targetUserId })
      .limit(1)
      .get();

    if (targetUserResult.data && targetUserResult.data.length > 0) {
      await db.collection(COLLECTIONS.USERS).doc(targetUserResult.data[0]._id).update({
        data: {
          isMember: false,
          updated_at: now
        }
      });
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '家庭成员已移除',
      data: {
        remainingMembers: updatedFamilyMemberIds.length
      }
    };

  } catch (error) {
    console.error('[removeFamilyMember] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '操作失败，请稍后重试', data: {} };
  }
};
