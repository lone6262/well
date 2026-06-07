// 邀请统计云函数
// 返回用户的邀请统计数据
const cloud = require('wx-server-sdk');
let {
  COLLECTIONS,
  RESPONSE_CODE,
  INVITE_STATUS,
  INVITE_CONFIG,
  warmupConfig
} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
let db = cloud.database();
let _ = db.command;

/**
 * 获取邀请统计
 *
 * @returns {object} 邀请统计信息
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  let OPENID_OBJ = cloud.getWXContext();
  let openid = OPENID_OBJ.OPENID;

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    // 1. 查询所有邀请记录
    let allInvites = await db.collection(COLLECTIONS.INVITE_RECORDS)
      .where({ inviter_id: openid })
      .limit(1000)
      .get();

    let list = allInvites.data || [];
    let total = list.length;
    let pending = 0;
    let rewarded = 0;
    let i;

    for (i = 0; i < list.length; i++) {
      if (list[i].status === INVITE_STATUS.PENDING) pending++;
      if (list[i].status === INVITE_STATUS.REWARDED) rewarded++;
    }

    // 2. 本月奖励数
    let now = new Date();
    let monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let thisMonthRewards = 0;
    for (i = 0; i < list.length; i++) {
      if (list[i].status === INVITE_STATUS.REWARDED &&
          list[i].rewarded_at &&
          new Date(list[i].rewarded_at) >= monthStart) {
        thisMonthRewards++;
      }
    }

    // 3. 查询用户奖励额度
    let userResult = await db.collection(COLLECTIONS.USERS)
      .where({ user_id: openid })
      .limit(1)
      .get();

    let rewardCredits = 0;
    if (userResult.data && userResult.data.length > 0) {
      rewardCredits = userResult.data[0].invite_reward_credits || 0;
    }

    // 4. 检查试用会员是否已发放
    let trialResult = await db.collection(COLLECTIONS.MEMBERS)
      .where({ user_id: openid, type: 'trial' })
      .limit(1)
      .get();

    let trialGranted = trialResult.data && trialResult.data.length > 0;

    // 5. 计算里程碑进度
    let nextMilestone = Math.max(0, INVITE_CONFIG.TRIAL_THRESHOLD - rewarded);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        totalInvites: total,
        pendingInvites: pending,
        rewardedInvites: rewarded,
        thisMonthRewards: thisMonthRewards,
        rewardCredits: rewardCredits,
        trialGranted: trialGranted,
        nextMilestone: nextMilestone,
        trialThreshold: INVITE_CONFIG.TRIAL_THRESHOLD
      }
    };

  } catch (error) {
    console.error('查询邀请统计失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询失败', data: {} };
  }
};
