// 处理邀请奖励云函数（核心）
// 被邀请人完成首次自查后触发
// 反作弊 + 奖励发放 + 里程碑检查
const cloud = require('wx-server-sdk');
let {
  COLLECTIONS,
  RESPONSE_CODE,
  INVITE_STATUS,
  INVITE_CONFIG,
  PRICES,
  MEMBER_STATUS,
  MEMBER_CREDITS
} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
let db = cloud.database();
let _ = db.command;

/**
 * 处理邀请奖励
 *
 * @param {string} recordId - 自查记录ID
 * @param {string} inviteCode - 邀请码
 * @returns {object} 奖励结果
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  let OPENID_OBJ = cloud.getWXContext();
  let inviteeOpenid = OPENID_OBJ.OPENID;
  let recordId = event.recordId;
  let inviteCode = event.inviteCode;

  // 1. 参数校验
  if (!inviteeOpenid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (!recordId || !inviteCode) {
    return { code: RESPONSE_CODE.ERROR, msg: '参数不完整', data: {} };
  }

  try {
    // 2. 查询邀请记录
    let inviteResult = await db.collection(COLLECTIONS.INVITE_RECORDS)
      .where({ invite_code: inviteCode })
      .limit(1)
      .get();

    if (!inviteResult.data || inviteResult.data.length === 0) {
      return { code: RESPONSE_CODE.ERROR, msg: '邀请码无效', data: {} };
    }

    let invite = inviteResult.data[0];

    // 3. 状态检查
    if (invite.status !== INVITE_STATUS.PENDING) {
      return { code: RESPONSE_CODE.ERROR, msg: '邀请已使用或已过期', data: {} };
    }

    // 4. 过期检查
    if (new Date(invite.expires_at) <= new Date()) {
      await db.collection(COLLECTIONS.INVITE_RECORDS).doc(invite._id).update({
        data: { status: INVITE_STATUS.EXPIRED, updated_at: new Date() }
      });
      return { code: RESPONSE_CODE.ERROR, msg: '邀请已过期', data: {} };
    }

    // 5. 防自邀
    if (invite.inviter_id === inviteeOpenid) {
      return { code: RESPONSE_CODE.ERROR, msg: '不能使用自己的邀请码', data: {} };
    }

    // 6. 月奖励上限检查
    let now = new Date();
    let monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthRewardCount = await db.collection(COLLECTIONS.INVITE_RECORDS)
      .where({
        inviter_id: invite.inviter_id,
        status: INVITE_STATUS.REWARDED,
        rewarded_at: _.gte(monthStart)
      })
      .count();

    if (monthRewardCount.total >= INVITE_CONFIG.MAX_REWARDS_PER_MONTH) {
      return { code: RESPONSE_CODE.ERROR, msg: '邀请人本月奖励已达上限', data: {} };
    }

    // 7. 确认被邀请人完成了首次自查
    let symptomCount = await db.collection(COLLECTIONS.SYMPTOM_RECORDS)
      .where({ user_id: inviteeOpenid })
      .count();

    if (symptomCount.total < 1) {
      return { code: RESPONSE_CODE.ERROR, msg: '请先完成至少一次症状自查', data: {} };
    }

    // 8. 更新邀请记录（原子性：先检查状态再更新）
    let updateResult = await db.collection(COLLECTIONS.INVITE_RECORDS)
      .where({
        _id: invite._id,
        status: INVITE_STATUS.PENDING
      })
      .update({
        data: {
          invitee_id: inviteeOpenid,
          status: INVITE_STATUS.REWARDED,
          rewarded_at: now,
          updated_at: now
        }
      });

    if (!updateResult.stats || updateResult.stats.updated === 0) {
      return { code: RESPONSE_CODE.ERROR, msg: '邀请已被使用', data: {} };
    }

    // 9. 发放邀请人奖励
    let inviterUserResult = await db.collection(COLLECTIONS.USERS)
      .where({ user_id: invite.inviter_id })
      .limit(1)
      .get();

    if (inviterUserResult.data && inviterUserResult.data.length > 0) {
      await db.collection(COLLECTIONS.USERS).doc(inviterUserResult.data[0]._id).update({
        data: { invite_reward_credits: _.inc(INVITE_CONFIG.REWARD_CREDITS), updated_at: now }
      });
    }

    // 10. 发放被邀请人奖励
    let inviteeUserResult = await db.collection(COLLECTIONS.USERS)
      .where({ user_id: inviteeOpenid })
      .limit(1)
      .get();

    if (inviteeUserResult.data && inviteeUserResult.data.length > 0) {
      await db.collection(COLLECTIONS.USERS).doc(inviteeUserResult.data[0]._id).update({
        data: { invite_reward_credits: _.inc(INVITE_CONFIG.REWARD_CREDITS), updated_at: now }
      });
    } else {
      // 被邀请人无用户记录时创建
      await db.collection(COLLECTIONS.USERS).add({
        data: {
          user_id: inviteeOpenid,
          invite_reward_credits: INVITE_CONFIG.REWARD_CREDITS,
          first_report_used: false,
          isMember: false,
          created_at: now,
          updated_at: now
        }
      });
    }

    // 11. 检查里程碑：邀请3人 → 7天试用会员
    let totalRewarded = await db.collection(COLLECTIONS.INVITE_RECORDS)
      .where({
        inviter_id: invite.inviter_id,
        status: INVITE_STATUS.REWARDED
      })
      .count();

    let trialGranted = false;
    if (totalRewarded.total >= INVITE_CONFIG.TRIAL_THRESHOLD) {
      // 原子性：在用户记录上标记 trial_granted 防止重复发放
      let trialClaimResult = await db.collection(COLLECTIONS.USERS)
        .where({
          user_id: invite.inviter_id,
          trial_granted: _.neq(true)
        })
        .update({
          data: { trial_granted: true, updated_at: now }
        });

      if (trialClaimResult.stats && trialClaimResult.stats.updated > 0) {
        let trialExpire = new Date(now.getTime() + INVITE_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000);
        await db.collection(COLLECTIONS.MEMBERS).add({
          data: {
            user_id: invite.inviter_id,
            type: 'trial',
            status: MEMBER_STATUS.ACTIVE,
            start_date: now,
            expire_date: trialExpire,
            report_credits_total: MEMBER_CREDITS.MONTHLY_REPORTS,
            report_credits_used: 0,
            report_credits_reset_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            auto_renew: false,
            created_at: now,
            updated_at: now
          }
        });
        trialGranted = true;
      }
    }

    // 12. 返回结果
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '邀请奖励已发放',
      data: {
        rewarded: true,
        credits_granted: INVITE_CONFIG.REWARD_CREDITS,
        trial_granted: trialGranted
      }
    };

  } catch (error) {
    console.error('处理邀请奖励失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '操作失败', data: {} };
  }
};
