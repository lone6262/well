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

    // 8. 原子更新邀请记录（条件更新防并发：只有 status=PENDING 才会更新成功）
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
      // 并发请求时，第二个请求的 where 条件不匹配，updated=0
      return { code: RESPONSE_CODE.ERROR, msg: '邀请已被使用', data: {} };
    }

    // 9-10. 发放奖励（带补偿：失败时回滚邀请状态，允许重试）
    let creditsGranted = false;
    try {
      // 发放邀请人奖励（_.inc 原子递增，无需担心并发）
      let inviterUserResult = await db.collection(COLLECTIONS.USERS)
        .where({ user_id: invite.inviter_id })
        .limit(1)
        .get();

      if (inviterUserResult.data && inviterUserResult.data.length > 0) {
        await db.collection(COLLECTIONS.USERS).doc(inviterUserResult.data[0]._id).update({
          data: { invite_reward_credits: _.inc(INVITE_CONFIG.REWARD_CREDITS), updated_at: now }
        });
      }

      // 发放被邀请人奖励
      let inviteeUserResult = await db.collection(COLLECTIONS.USERS)
        .where({ user_id: inviteeOpenid })
        .limit(1)
        .get();

      if (inviteeUserResult.data && inviteeUserResult.data.length > 0) {
        await db.collection(COLLECTIONS.USERS).doc(inviteeUserResult.data[0]._id).update({
          data: { invite_reward_credits: _.inc(INVITE_CONFIG.REWARD_CREDITS), updated_at: now }
        });
      } else {
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

      creditsGranted = true;
    } catch (creditError) {
      // 奖励发放失败 → 回滚邀请状态为 PENDING，允许下次重试
      console.error('[processInviteReward] 积分发放失败，回滚邀请状态:', creditError.message);
      try {
        await db.collection(COLLECTIONS.INVITE_RECORDS).doc(invite._id).update({
          data: {
            status: INVITE_STATUS.PENDING,
            invitee_id: _.remove(),
            rewarded_at: _.remove(),
            updated_at: now
          }
        });
      } catch (rollbackError) {
        console.error('[processInviteReward] 回滚失败（需人工介入）:', rollbackError.message, 'inviteId=', invite._id);
      }
      return { code: RESPONSE_CODE.SERVER_ERROR, msg: '奖励发放失败，请重试', data: {} };
    }

    // 11. 阶梯里程碑检查
    let totalRewarded = await db.collection(COLLECTIONS.INVITE_RECORDS)
      .where({
        inviter_id: invite.inviter_id,
        status: INVITE_STATUS.REWARDED
      })
      .count();

    const totalInvites = totalRewarded.total;
    const milestones = await checkMilestones(invite.inviter_id, totalInvites, now);

    // 12. 返回结果
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '邀请奖励已发放',
      data: {
        rewarded: true,
        credits_granted: INVITE_CONFIG.REWARD_CREDITS,
        total_invites: totalInvites,
        milestones,
      },
    };

  } catch (error) {
    console.error('处理邀请奖励失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '操作失败', data: {} };
  }
};

/**
 * 阶梯里程碑奖励
 *
 * 邀请人数 → 奖励
 * 1 人  → +1 次报告额度（已在外层发放）
 * 3 人  → 7 天体验会员
 * 5 人  → 5 元会员优惠券（通过 autoIssueCoupon）
 * 10 人 → 1 个月正式月卡
 *
 * @returns {object} 各里程碑发放状态
 */
async function checkMilestones(inviterId, totalInvites, now) {
  const milestones = {
    trial: false,      // 3 人：7天体验
    coupon_5: false,   // 5 人：5元券
    monthly: false,    // 10 人：1个月月卡
  };

  // === 里程碑 1：邀请 3 人 → 7 天体验会员 ===
  if (totalInvites >= INVITE_CONFIG.TRIAL_THRESHOLD) {
    const trialClaimResult = await db.collection(COLLECTIONS.USERS)
      .where({
        user_id: inviterId,
        trial_granted: _.neq(true),
      })
      .update({
        data: { trial_granted: true, updated_at: now },
      });

    if (trialClaimResult.stats && trialClaimResult.stats.updated > 0) {
      const trialExpire = new Date(now.getTime() + INVITE_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000);
      await db.collection(COLLECTIONS.MEMBERS).add({
        data: {
          user_id: inviterId,
          type: 'trial',
          status: MEMBER_STATUS.ACTIVE,
          start_date: now,
          expire_date: trialExpire,
          report_credits_total: MEMBER_CREDITS.TRIAL_REPORTS,
          report_credits_used: 0,
          report_credits_reset_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          auto_renew: false,
          created_at: now,
          updated_at: now,
        },
      });
      milestones.trial = true;
      console.log(`[processInviteReward] 用户 ${inviterId} 达成 3 人里程碑，发放体验会员`);
    }
  }

  // === 里程碑 2：邀请 5 人 → 5 元会员优惠券 ===
  if (totalInvites >= 5) {
    const couponClaimResult = await db.collection(COLLECTIONS.USERS)
      .where({
        user_id: inviterId,
        coupon_5_granted: _.neq(true),
      })
      .update({
        data: { coupon_5_granted: true, updated_at: now },
      });

    if (couponClaimResult.stats && couponClaimResult.stats.updated > 0) {
      try {
        await cloud.callFunction({
          name: 'autoIssueCoupon',
          data: {
            userId: inviterId,
            scene: 'invite_milestone_5',
          },
        });
        milestones.coupon_5 = true;
        console.log(`[processInviteReward] 用户 ${inviterId} 达成 5 人里程碑，发放会员 5 元券`);
      } catch (couponError) {
        console.error(`[processInviteReward] 5 人里程碑发券失败:`, couponError.message);
        // 回滚标记，允许下次重试
        await db.collection(COLLECTIONS.USERS)
          .where({ user_id: inviterId })
          .limit(1)
          .update({ data: { coupon_5_granted: _.remove() } });
      }
    }
  }

  // === 里程碑 3：邀请 10 人 → 1 个月正式月卡 ===
  if (totalInvites >= 10) {
    const monthlyClaimResult = await db.collection(COLLECTIONS.USERS)
      .where({
        user_id: inviterId,
        monthly_10_granted: _.neq(true),
      })
      .update({
        data: { monthly_10_granted: true, updated_at: now },
      });

    if (monthlyClaimResult.stats && monthlyClaimResult.stats.updated > 0) {
      try {
        const monthlyExpire = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // 查看是否已有活跃会员
        const existingMember = await db.collection(COLLECTIONS.MEMBERS)
          .where({ user_id: inviterId, status: MEMBER_STATUS.ACTIVE })
          .limit(1)
          .get();

        if (existingMember.data && existingMember.data.length > 0) {
          // 已有会员 → 延长到期时间
          const member = existingMember.data[0];
          const currentExpire = new Date(member.expire_date);
          const baseDate = currentExpire > now ? currentExpire : now;
          const newExpire = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

          await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
            data: {
              expire_date: newExpire,
              report_credits_total: Math.max(member.report_credits_total || 0, MEMBER_CREDITS.MONTHLY_REPORTS),
              updated_at: now,
            },
          });
        } else {
          // 无会员 → 直接创建月卡
          await db.collection(COLLECTIONS.MEMBERS).add({
            data: {
              user_id: inviterId,
              type: 'monthly',
              status: MEMBER_STATUS.ACTIVE,
              start_date: now,
              expire_date: monthlyExpire,
              report_credits_total: MEMBER_CREDITS.MONTHLY_REPORTS,
              report_credits_used: 0,
              report_credits_reset_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
              auto_renew: false,
              created_at: now,
              updated_at: now,
            },
          });
        }

        // 记录订单
        await db.collection(COLLECTIONS.ORDERS).add({
          data: {
            user_id: inviterId,
            type: 'member_monthly',
            status: 'paid',
            amount: 0,
            out_trade_no: 'WELL_INVITE_REWARD_' + Date.now(),
            transaction_id: 'REWARD_MONTHLY_10',
            description: '邀请 10 人奖励 — 1 个月月卡',
            metadata: {
              reward_type: 'invite_milestone_10',
              total_invites: totalInvites,
            },
            paid_at: now,
            created_at: now,
            updated_at: now,
          },
        });

        milestones.monthly = true;
        console.log(`[processInviteReward] 用户 ${inviterId} 达成 10 人里程碑，发放 1 个月月卡`);
      } catch (monthlyError) {
        console.error(`[processInviteReward] 10 人里程碑发放月卡失败:`, monthlyError.message);
        await db.collection(COLLECTIONS.USERS)
          .where({ user_id: inviterId })
          .limit(1)
          .update({ data: { monthly_10_granted: _.remove() } });
      }
    }
  }

  return milestones;
}
