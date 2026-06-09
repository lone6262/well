// 查询家庭成员列表及使用情况
// 支持主账号和家庭成员调用，返回成员列表和用户档案
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
  const { token } = event;

  // ---- 参数校验 ----
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }
  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    // ---- 查询会员记录：openid 是主账号 OR openid 在 family_member_ids 中 ----
    const memberResult = await db.collection(COLLECTIONS.MEMBERS)
      .where(
        _.or(
          { user_id: openid },
          { family_member_ids: openid }
        )
      )
      .where({
        status: MEMBER_STATUS.ACTIVE,
        type: _.regex(/^family_/)
      })
      .limit(1)
      .get();

    if (!memberResult.data || memberResult.data.length === 0) {
      return { code: RESPONSE_CODE.NOT_FOUND, msg: '未找到有效的家庭会员记录', data: {} };
    }

    const member = memberResult.data[0];
    const familyMemberIds = member.family_member_ids || [];
    const allMemberIds = [member.user_id, ...familyMemberIds];

    // ---- 批量查询成员的用户档案 ----
    const MAX_BATCH_SIZE = 10;
    let userProfiles = [];

    for (let i = 0; i < allMemberIds.length; i += MAX_BATCH_SIZE) {
      const batchIds = allMemberIds.slice(i, i + MAX_BATCH_SIZE);
      const batchResult = await db.collection(COLLECTIONS.USERS)
        .where({ _openid: _.in(batchIds) })
        .get();
      userProfiles = userProfiles.concat(batchResult.data || []);
    }

    // 构建 openid -> user profile 的映射
    const profileMap = {};
    for (const profile of userProfiles) {
      profileMap[profile._openid] = profile;
    }

    // ---- 组装返回数据 ----
    // 主账号信息
    const mainAccount = profileMap[member.user_id] || {};
    const members = [
      {
        openid: member.user_id,
        role: 'owner',
        nickname: mainAccount.nickName || mainAccount.nickname || '',
        avatarUrl: mainAccount.avatarUrl || '',
        reportCreditsUsed: member.report_credits_used || 0,
        joinedAt: member.created_at || null
      }
    ];

    // 家庭成员信息
    for (const memberId of familyMemberIds) {
      const userProfile = profileMap[memberId] || {};
      members.push({
        openid: memberId,
        role: 'member',
        nickname: userProfile.nickName || userProfile.nickname || '',
        avatarUrl: userProfile.avatarUrl || '',
        reportCreditsUsed: 0,
        joinedAt: null
      });
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '查询成功',
      data: {
        memberId: member._id,
        memberType: member.type,
        expireDate: member.expire_date,
        reportCreditsTotal: member.report_credits || 0,
        reportCreditsUsed: member.report_credits_used || 0,
        maxFamilyMembers: member.max_family_members || 4,
        members: members,
        pendingInvites: (member.pending_invites || []).map(inv => ({
          code: inv.code,
          createdAt: inv.created_at
        }))
      }
    };

  } catch (error) {
    console.error('[getFamilyMembers] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '操作失败，请稍后重试', data: {} };
  }
};
