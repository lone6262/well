/**
 * 报告额度服务（quota-service）
 *
 * 统一 createOrder 与 generateAIReport 的额度解析/扣减/回滚逻辑，
 * 消除两处实现的规则不一致风险。
 *
 * 优先级: 邀请奖励 > 首份优惠 > 点数包 > 体验会员 > 正式会员 > 付费
 *
 * 使用方式：
 *   const { resolveQuota, deductQuota, rollbackQuota } = require('./common/quota-service');
 *   const quotaInfo = await resolveQuota(db, openid, dbPrices, dbCredits);
 *   const ok = await deductQuota(db, openid, quotaInfo, dbCredits);
 *   if (ok) { 执行后续逻辑 } else { 付费失败或并发冲突，不应调用 rollback }
 *
 * F1 修复说明：rollbackQuota 仅在 deductQuota 返回 true 后调用，
 *   且 rollbackQuota 内部会检查 quotaInfo._deducted 标志确保幂等。
 */

/**
 * 按会员类型计算期望的报告额度总数（F2 修复）
 * 家庭会员 family_monthly/family_yearly 以前被错误地按个人 monthly 计算
 */
function expectedReportsByType(type, credits) {
  switch (type) {
    case 'yearly':
      return credits.YEARLY_REPORTS;
    case 'family_monthly':
      return credits.FAMILY_MONTHLY_REPORTS || credits.MONTHLY_REPORTS;
    case 'family_yearly':
      return credits.FAMILY_YEARLY_REPORTS || credits.YEARLY_REPORTS;
    default:
      return credits.MONTHLY_REPORTS;
  }
}
const {
  COLLECTIONS,
  ORDER_STATUS,
  ORDER_TYPES,
  PRICES,
  MEMBER_CREDITS,
  MEMBER_STATUS,
} = require('./constants');

/**
 * 计算下一个额度重置日期（按起始日对齐）
 * @param {Date} startDate - 会员开始日期
 * @param {Date} currentReset - 当前重置日期
 * @returns {Date} 下一个重置日期
 */
function calcNextReset(startDate, currentReset) {
  const startDay = startDate.getDate();
  let year = currentReset.getFullYear();
  let month = currentReset.getMonth() + 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }
  const maxDay = new Date(year, month + 1, 0).getDate();
  const targetDay = Math.min(startDay, maxDay);
  return new Date(
    year,
    month,
    targetDay,
    startDate.getHours(),
    startDate.getMinutes(),
    startDate.getSeconds()
  );
}

/**
 * 解析用户可用的报告额度
 * 优先级: 邀请奖励 > 首份优惠 > 点数包 > 体验会员 > 正式会员 > 付费
 *
 * @param {object} db - cloud.database() 实例
 * @param {string} openid - 用户 openid
 * @param {object} [dbPrices] - 数据库加载的价格配置（可选，缺省回退 PRICES）
 * @param {object} [dbCredits] - 数据库加载的额度配置（可选，缺省回退 MEMBER_CREDITS）
 * @returns {Promise<object>} 额度信息 { has_free_quota, quota_source, price, ... }
 */
async function resolveQuota(db, openid, dbPrices, dbCredits) {
  const prices = dbPrices || PRICES;
  const credits = dbCredits || MEMBER_CREDITS;
  const _ = db.command;

  const userResult = await db
    .collection(COLLECTIONS.USERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  const user = (userResult.data && userResult.data[0]) || null;

  // 邀请奖励额度（优先消耗免费额度）
  if (user && user.invite_reward_credits && user.invite_reward_credits > 0) {
    return {
      has_free_quota: true,
      quota_source: 'invite',
      price: 0,
      user: user,
      userExists: true,
    };
  }

  // 首份报告优惠（无用户记录 或 有记录但未使用首份）
  // 追加 ORDERS 交叉验证：防止用户删除账号重新注册绕过首份优惠
  if (!user || !user.first_report_used) {
    const prevFirstOrder = await db
      .collection(COLLECTIONS.ORDERS)
      .where({
        user_id: openid,
        type: ORDER_TYPES.REPORT,
        'metadata.is_first_report': true,
        status: _.in([ORDER_STATUS.PENDING, ORDER_STATUS.PAID]),
      })
      .limit(1)
      .get();

    if (prevFirstOrder.data && prevFirstOrder.data.length > 0) {
      // 曾使用过首份优惠但标记可能丢失，修复标记并继续检查其他额度
      if (user && user._id) {
        try {
          await db
            .collection(COLLECTIONS.USERS)
            .doc(user._id)
            .update({ data: { first_report_used: true, updated_at: new Date() } });
        } catch (fixErr) {
          // W4 修复：修复标记失败不应阻塞 resolveQuota
          console.error('[quota-service] 修复 first_report_used 标记失败:', fixErr.message);
        }
      }
    } else {
      return {
        has_free_quota: true,
        quota_source: 'first_report',
        price: 0,
        user: user,
        userExists: !!user,
      };
    }
  }

  // 点数包余额（消耗 1 个点数即可「免费」生成报告）
  // S3 修复：按 expire_at 升序，优先取最早过期的有效点数包
  const pointsResult = await db
    .collection(COLLECTIONS.USER_POINTS)
    .where({ user_id: openid })
    .orderBy('expire_at', 'asc')
    .limit(1)
    .get();

  if (pointsResult.data && pointsResult.data.length > 0) {
    const points = pointsResult.data[0];
    const now = new Date();
    if (points.balance > 0 && points.expire_at && new Date(points.expire_at) > now) {
      return {
        has_free_quota: true,
        quota_source: 'points',
        price: 0,
        user: user,
        userExists: !!user,
        points_balance: points.balance,
        points_record_id: points._id,
      };
    }
  }

  // 体验会员额度（邀请 3 人获得 7 天体验，每月 1 次）
  const trialMemberResult = await db
    .collection(COLLECTIONS.MEMBERS)
    .where({
      user_id: openid,
      status: MEMBER_STATUS.ACTIVE,
      type: 'trial',
      expire_date: _.gt(new Date()),
    })
    .limit(1)
    .get();

  if (trialMemberResult.data && trialMemberResult.data.length > 0) {
    const trial = trialMemberResult.data[0];
    const trialNow = new Date();
    const trialNextReset = trial.report_credits_reset_at
      ? new Date(trial.report_credits_reset_at)
      : null;

    let trialUsed = trial.report_credits_used || 0;
    if (trialNextReset && trialNow >= trialNextReset) {
      trialUsed = 0;
      const trialStart = trial.start_date ? new Date(trial.start_date) : trialNow;
      const newReset = calcNextReset(trialStart, trialNextReset);
      await db
        .collection(COLLECTIONS.MEMBERS)
        .doc(trial._id)
        .update({
          data: { report_credits_used: 0, report_credits_reset_at: newReset, updated_at: trialNow },
        });
      trial.report_credits_used = 0;
    }

    const trialTotal = trial.report_credits_total || credits.TRIAL_REPORTS;
    if (trialUsed < trialTotal) {
      return {
        has_free_quota: true,
        quota_source: 'trial',
        price: 0,
        user: user,
        userExists: true,
        member: trial,
      };
    }
  }

  // 正式会员额度
  const memberResult = await db
    .collection(COLLECTIONS.MEMBERS)
    .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE, expire_date: _.gt(new Date()) })
    .limit(1)
    .get();

  if (memberResult.data && memberResult.data.length > 0) {
    const member = memberResult.data[0];
    const now = new Date();
    const nextResetAt = member.report_credits_reset_at
      ? new Date(member.report_credits_reset_at)
      : null;

    let used = member.report_credits_used || 0;
    if (nextResetAt && now >= nextResetAt) {
      used = 0;
      const startDate = member.start_date ? new Date(member.start_date) : now;
      const newResetAt = calcNextReset(startDate, nextResetAt);
      await db
        .collection(COLLECTIONS.MEMBERS)
        .doc(member._id)
        .update({
          data: { report_credits_used: 0, report_credits_reset_at: newResetAt, updated_at: now },
        });
      member.report_credits_used = 0;
      member.report_credits_reset_at = newResetAt;
    }

    const expectedTotal = expectedReportsByType(member.type, credits);
    let total = member.report_credits_total || expectedTotal;
    total = Math.max(total, expectedTotal); // 统一迁移逻辑
    // 旧会员迁移：如果库里的 total 低于当前配置，使用新值
    if (total < expectedTotal) total = expectedTotal;
    const remaining = Math.max(0, total - used);

    if (remaining > 0) {
      return {
        has_free_quota: true,
        quota_source: 'member',
        price: 0,
        user: user,
        userExists: true,
        member: member,
      };
    }
  }

  // 无免费额度，需要付费
  return {
    has_free_quota: false,
    quota_source: 'paid',
    price: prices.STANDARD_REPORT,
    user: user,
    userExists: !!user,
  };
}

/**
 * 扣减对应的额度（在创建订单/生成报告之前调用，使用条件更新确保原子性）
 * 处理新用户无记录的情况：自动创建用户记录并标记 first_report_used
 *
 * @param {object} db - cloud.database() 实例
 * @param {string} openid - 用户 openid
 * @param {object} quotaInfo - resolveQuota 返回的额度信息
 * @param {object} [dbCredits] - 数据库加载的额度配置（可选）
 * @returns {Promise<boolean>} 扣减是否成功
 */
async function deductQuota(db, openid, quotaInfo, dbCredits) {
  const _ = db.command;
  const credits = dbCredits || MEMBER_CREDITS;
  const now = new Date();

  // 首份报告标记（条件更新：只有未标记时才能成功）
  if (quotaInfo.quota_source === 'first_report') {
    if (!quotaInfo.userExists) {
      try {
        await db.collection(COLLECTIONS.USERS).add({
          data: {
            user_id: openid,
            first_report_used: true,
            invite_reward_credits: 0,
            isMember: false,
            created_at: now,
            updated_at: now,
          },
        });
      } catch (e) {
        // 并发创建冲突，尝试条件更新
        const retryResult = await db
          .collection(COLLECTIONS.USERS)
          .where({ user_id: openid, first_report_used: _.neq(true) })
          .update({ data: { first_report_used: true, updated_at: now } });
        if (!retryResult.stats || retryResult.stats.updated === 0) {
          return false;
        }
      }
    } else if (quotaInfo.user) {
      const updateResult = await db
        .collection(COLLECTIONS.USERS)
        .where({ _id: quotaInfo.user._id, first_report_used: _.neq(true) })
        .update({ data: { first_report_used: true, updated_at: now } });
      if (!updateResult.stats || updateResult.stats.updated === 0) {
        return false;
      }
    }
  }

  // 邀请奖励扣减（条件更新：余额 > 0 才能扣减）
  if (quotaInfo.quota_source === 'invite' && quotaInfo.user) {
    const inviteResult = await db
      .collection(COLLECTIONS.USERS)
      .where({ _id: quotaInfo.user._id, invite_reward_credits: _.gt(0) })
      .update({ data: { invite_reward_credits: _.inc(-1), updated_at: now } });
    if (!inviteResult.stats || inviteResult.stats.updated === 0) {
      return false;
    }
  }

  // 正式会员额度扣减（条件更新：剩余额度 > 0 才能扣减）
  if (quotaInfo.quota_source === 'member' && quotaInfo.member) {
    const memberTotal = Math.max(
      quotaInfo.member.report_credits_total || 0,
      expectedReportsByType(quotaInfo.member.type, credits)
    );
    const memberResult = await db
      .collection(COLLECTIONS.MEMBERS)
      .where({ _id: quotaInfo.member._id, report_credits_used: _.lt(memberTotal) })
      .update({ data: { report_credits_used: _.inc(1), updated_at: now } });
    if (!memberResult.stats || memberResult.stats.updated === 0) {
      return false;
    }
  }

  // 体验会员额度扣减
  if (quotaInfo.quota_source === 'trial' && quotaInfo.member) {
    const total = quotaInfo.member.report_credits_total || credits.TRIAL_REPORTS;
    const trialResult = await db
      .collection(COLLECTIONS.MEMBERS)
      .where({ _id: quotaInfo.member._id, report_credits_used: _.lt(total) })
      .update({ data: { report_credits_used: _.inc(1), updated_at: now } });
    if (!trialResult.stats || trialResult.stats.updated === 0) {
      return false;
    }
  }

  // 点数包余额扣减
  if (quotaInfo.quota_source === 'points' && quotaInfo.points_record_id) {
    const pointsResult = await db
      .collection(COLLECTIONS.USER_POINTS)
      .where({ _id: quotaInfo.points_record_id, balance: _.gt(0) })
      .update({ data: { balance: _.inc(-1), total_used: _.inc(1), updated_at: now } });
    if (!pointsResult.stats || pointsResult.stats.updated === 0) {
      return false;
    }
    // 记录点数消费流水
    try {
      await db.collection(COLLECTIONS.POINT_TRANSACTIONS).add({
        data: {
          user_id: openid,
          type: 'consume',
          amount: -1,
          balance_after: Math.max(0, (quotaInfo.points_balance || 1) - 1),
          balance_snapshot: true, // S5: 快照值，非实时
          created_at: now,
        },
      });
    } catch (e) {
      /* 流水记录失败不阻塞 */
    }
  }

  // 标记已成功扣减，供 rollbackQuota 守卫识别（防止未扣减却误回滚 / 重复回滚）
  quotaInfo._deducted = true;
  return true;
}

/**
 * 回滚额度扣减（订单创建失败或并发去重时调用）
 * 与 deductQuota 执行相反操作
 *
 * @param {object} db - cloud.database() 实例
 * @param {string} openid - 用户 openid
 * @param {object} quotaInfo - resolveQuota 返回的额度信息
 */
async function rollbackQuota(db, openid, quotaInfo) {
  // F1 修复：仅在确实扣减过时才回滚，防止误调和重复回滚
  if (!quotaInfo || !quotaInfo._deducted) {
    return { ok: false, reason: 'not_deducted' };
  }
  // 防止重复回滚（幂等）
  if (quotaInfo._rolledBack) {
    return { ok: true, reason: 'already_rolled_back' };
  }

  const _ = db.command;
  const now = new Date();
  let rollbackOk = true;
  let rollbackError = null;

  try {
    if (quotaInfo.quota_source === 'first_report') {
      // F4 修复：用 _id 精确定位而非 where({ user_id })，避免批量回写
      if (quotaInfo.user && quotaInfo.user._id) {
        await db
          .collection(COLLECTIONS.USERS)
          .where({ _id: quotaInfo.user._id, first_report_used: true })
          .update({ data: { first_report_used: false, updated_at: now } });
      }
    } else if (quotaInfo.quota_source === 'invite' && quotaInfo.user) {
      // F1 修复：带条件更新 invite_reward_credits >= 0（上界保护由业务逻辑保证，这里限制回滚一次）
      const result = await db
        .collection(COLLECTIONS.USERS)
        .where({ _id: quotaInfo.user._id })
        .update({ data: { invite_reward_credits: _.inc(1), updated_at: now } });
      if (!result.stats || result.stats.updated === 0) rollbackOk = false;
    } else if (quotaInfo.quota_source === 'member' && quotaInfo.member) {
      await db
        .collection(COLLECTIONS.MEMBERS)
        .where({ _id: quotaInfo.member._id, report_credits_used: _.gt(0) })
        .update({ data: { report_credits_used: _.inc(-1), updated_at: now } });
    } else if (quotaInfo.quota_source === 'trial' && quotaInfo.member) {
      await db
        .collection(COLLECTIONS.MEMBERS)
        .where({ _id: quotaInfo.member._id, report_credits_used: _.gt(0) })
        .update({ data: { report_credits_used: _.inc(-1), updated_at: now } });
    } else if (quotaInfo.quota_source === 'points' && quotaInfo.points_record_id) {
      // F1 修复：total_used 带下界保护防止负数
      const result = await db
        .collection(COLLECTIONS.USER_POINTS)
        .where({ _id: quotaInfo.points_record_id, total_used: _.gt(0) })
        .update({ data: { balance: _.inc(1), total_used: _.inc(-1), updated_at: now } });
      if (!result.stats || result.stats.updated === 0) {
        // total_used 已经是 0（可能已被其他回滚处理），只加余额不加 total_used
        await db
          .collection(COLLECTIONS.USER_POINTS)
          .where({ _id: quotaInfo.points_record_id })
          .update({ data: { balance: _.inc(1), updated_at: now } });
      }
    }
    quotaInfo._rolledBack = true; // 标记已回滚（幂等）
  } catch (e) {
    rollbackOk = false;
    rollbackError = e.message;
    console.error('[quota-service] 额度回滚失败:', e.message);
  }

  return { ok: rollbackOk, error: rollbackError };
}

module.exports = {
  resolveQuota,
  deductQuota,
  rollbackQuota,
  calcNextReset,
};
