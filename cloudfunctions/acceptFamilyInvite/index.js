// 接受家庭会员邀请
// 通过邀请码加入家庭会员，更新会员记录和用户记录
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  MEMBER_STATUS,
  MEMBER_LIMITS,
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
  const { token, inviteCode } = event;

  // ---- 参数校验 ----
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }
  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (!inviteCode) {
    return { code: RESPONSE_CODE.ERROR, msg: '邀请码不能为空', data: {} };
  }

  try {
    // ---- 查找包含该邀请码的会员记录 ----
    const memberResult = await db.collection(COLLECTIONS.MEMBERS)
      .where({
        status: MEMBER_STATUS.ACTIVE,
        type: _.regex(/^family_/),
        'pending_invites.code': inviteCode
      })
      .limit(1)
      .get();

    if (!memberResult.data || memberResult.data.length === 0) {
      return { code: RESPONSE_CODE.NOT_FOUND, msg: '邀请码无效或已过期', data: {} };
    }

    const member = memberResult.data[0];

    // ---- 不能加入自己的会员 ----
    if (member.user_id === openid) {
      return { code: RESPONSE_CODE.ERROR, msg: '不能接受自己的邀请', data: {} };
    }

    // ---- 检查是否已经是家庭成员 ----
    const familyMemberIds = member.family_member_ids || [];
    if (familyMemberIds.includes(openid)) {
      return { code: RESPONSE_CODE.ERROR, msg: '您已经是该家庭会员的成员', data: {} };
    }

    // ---- 检查家庭成员数量上限 ----
    if (familyMemberIds.length >= MEMBER_LIMITS.MAX_FAMILY_MEMBERS) {
      return { code: RESPONSE_CODE.ERROR, msg: '该家庭会员成员已达上限', data: {} };
    }

    // ---- 更新会员记录：添加成员、移除邀请码 ----
    const now = new Date();
    const updatedInvites = (member.pending_invites || []).filter(
      (inv) => inv.code !== inviteCode
    );

    await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
      data: {
        family_member_ids: _.push(openid),
        pending_invites: updatedInvites,
        updated_at: now
      }
    });

    // ---- 更新被邀请用户的 users 记录 ----
    const userResult = await db.collection(COLLECTIONS.USERS)
      .where({ _openid: openid })
      .limit(1)
      .get();

    if (userResult.data && userResult.data.length > 0) {
      await db.collection(COLLECTIONS.USERS).doc(userResult.data[0]._id).update({
        data: {
          isMember: true,
          memberExpire: member.expire_date,
          updated_at: now
        }
      });
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '成功加入家庭会员',
      data: {
        memberType: member.type,
        expireDate: member.expire_date
      }
    };

  } catch (error) {
    console.error('[acceptFamilyInvite] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '操作失败，请稍后重试', data: {} };
  }
};
