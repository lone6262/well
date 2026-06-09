// 主账号邀请家庭成员共享会员
// 生成邀请码，存储到会员记录的 pending_invites 数组
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

/**
 * 生成随机 8 位邀请码（字母+数字）
 * @returns {string} 邀请码
 */
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { token } = event;

  // ---- 参数校验 ----
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }
  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    // ---- 查询当前用户的家庭会员记录 ----
    const memberResult = await db.collection(COLLECTIONS.MEMBERS)
      .where({
        user_id: openid,
        status: MEMBER_STATUS.ACTIVE,
        type: _.regex(/^family_/)
      })
      .limit(1)
      .get();

    if (!memberResult.data || memberResult.data.length === 0) {
      return { code: RESPONSE_CODE.ERROR, msg: '您没有有效的家庭会员，无法邀请', data: {} };
    }

    const member = memberResult.data[0];

    // ---- 检查家庭成员数量上限 ----
    const currentMembers = member.family_member_ids || [];
    if (currentMembers.length >= MEMBER_LIMITS.MAX_FAMILY_MEMBERS) {
      return { code: RESPONSE_CODE.ERROR, msg: '家庭成员已达上限，无法继续邀请', data: {} };
    }

    // ---- 生成邀请码 ----
    const inviteCode = generateInviteCode();
    const now = new Date();
    const pendingInvite = {
      code: inviteCode,
      created_at: now
    };

    // ---- 将邀请码存入会员记录 ----
    const existingInvites = member.pending_invites || [];
    await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
      data: {
        pending_invites: [...existingInvites, pendingInvite],
        updated_at: now
      }
    });

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '邀请码生成成功',
      data: {
        inviteCode,
        currentMemberCount: currentMembers.length,
        maxMembers: MEMBER_LIMITS.MAX_FAMILY_MEMBERS
      }
    };

  } catch (error) {
    console.error('[inviteFamilyMember] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '操作失败，请稍后重试', data: {} };
  }
};
