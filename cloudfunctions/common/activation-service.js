/**
 * 会员激活统一服务（个人 / 家庭 · 新开 / 续费 / 升级）
 * ==========================================
 * 此前会员激活逻辑在三处复制粘贴：
 *   - createOrder.inlineActivateMember（mock_pay 兜底）
 *   - payCallback.activateMember（个人）
 *   - payCallback.activateFamilyMember（家庭）
 * 三者细节逐渐漂移（如 createOrder 兜底缺少"家庭→个人降级清理"、缺少 users 集合 upsert），
 * 正是 S6 兜底差异的根因。本服务统一为单一实现，消除漂移。
 *
 * 行为对齐说明（已逐一核对）：
 *   - 周期天数：统一用 MEMBER_DURATION（= 月 30 / 年 365），与原三处一致
 *   - 额度来源：统一用调用方传入的 dbCredits（运行期 DB 动态值）
 *   - 幂等：同一 orderId 已激活过则跳过（防重复回调覆盖式重置额度）
 *   - 到期日：升级取 max(原到期, now+新周期)；续费在原到期/now 基础上累加；新开 now+周期
 *   - 额度重置时间：按开通日（start_date）对齐到下月同日
 *   - 升级时 report_credits_used 重置为 0
 *   - 家庭→个人降级：清理 family_* 专属字段（原仅 payCallback.activateMember 有，现统一具备）
 *   - users 集合：update 或 add（upsert），同步 isMember/memberExpire
 */
const { COLLECTIONS, MEMBER_STATUS, MEMBER_DURATION, MEMBER_LIMITS } = require('./constants');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 激活 / 续费 / 升级会员
 *
 * @param {object} opts
 * @param {object} opts.db          cloud.database() 实例
 * @param {object} opts._           db.command（用于 _.remove() 降级清理）
 * @param {object} opts.dbCredits   运行期额度配置（含 MONTHLY/YEARLY/FAMILY_MONTHLY/FAMILY_YEARLY_REPORTS）
 * @param {string} opts.openid      用户 openid
 * @param {string} opts.memberType  目标会员类型（monthly/yearly/family_monthly/family_yearly）
 * @param {string} [opts.orderId]   激活来源订单号（用于幂等校验）
 * @param {boolean} [opts.isFamily] 是否家庭会员；缺省按 memberType 前缀推断
 * @param {Date} [opts.now]         当前时间（测试可注入）
 * @returns {Promise<{activated: boolean, expireDate: Date}>}
 */
async function activateMembership(opts) {
  const { db, _, dbCredits, openid, memberType, orderId } = opts;
  const now = opts.now || new Date();
  const isFamily = opts.isFamily !== undefined
    ? opts.isFamily
    : (memberType === 'family_monthly' || memberType === 'family_yearly');
  const isYearly = memberType === 'yearly' || memberType === 'family_yearly';

  // 1. 幂等：同一订单号已激活过则跳过（防重复回调覆盖式重置额度）
  if (orderId) {
    const existing = await db.collection(COLLECTIONS.MEMBERS)
      .where({ user_id: openid, activated_by_order: orderId })
      .limit(1)
      .get();
    if (existing.data && existing.data.length > 0) {
      console.log('[activation-service] 会员已激活过，跳过:', orderId);
      return { activated: false, expireDate: existing.data[0].expire_date };
    }
  }

  const durationDays = isYearly ? MEMBER_DURATION.YEAR : MEMBER_DURATION.MONTH;
  const reportCredits = isFamily
    ? (isYearly ? dbCredits.FAMILY_YEARLY_REPORTS : dbCredits.FAMILY_MONTHLY_REPORTS)
    : (isYearly ? dbCredits.YEARLY_REPORTS : dbCredits.MONTHLY_REPORTS);

  // 2. 查询现有会员记录
  const existingResult = await db.collection(COLLECTIONS.MEMBERS)
    .where({ user_id: openid })
    .limit(1)
    .get();
  const existingMember = (existingResult.data && existingResult.data.length > 0)
    ? existingResult.data[0]
    : null;
  const isActive = existingMember && existingMember.status === MEMBER_STATUS.ACTIVE;
  const isUpgrade = isActive && existingMember.type !== memberType;

  // 3. 到期日计算
  let expireDate;
  if (isUpgrade) {
    // 升级：取 max(原到期日, now+新周期)，保证用户不因升级损失时间
    const freshExpire = new Date(now.getTime() + durationDays * DAY_MS);
    const originalExpire = new Date(existingMember.expire_date);
    expireDate = originalExpire > freshExpire ? originalExpire : freshExpire;
  } else if (isActive && existingMember.expire_date) {
    // 续费：在原到期日（若未过期）或 now 基础上累加新周期
    const currentExpire = new Date(existingMember.expire_date);
    const baseDate = currentExpire > now ? currentExpire : now;
    expireDate = new Date(baseDate.getTime() + durationDays * DAY_MS);
  } else {
    // 新开通
    expireDate = new Date(now.getTime() + durationDays * DAY_MS);
  }

  // 4. 额度重置时间（按开通日对齐到下月同日）
  const startDate = (existingMember && existingMember.start_date)
    ? new Date(existingMember.start_date)
    : now;
  const startDay = startDate.getDate();
  let resetMonth = now.getMonth() + 1;
  let resetYear = now.getFullYear();
  if (resetMonth > 11) { resetMonth = 0; resetYear += 1; }
  const maxDay = new Date(resetYear, resetMonth + 1, 0).getDate();
  const nextResetAt = new Date(resetYear, resetMonth, Math.min(startDay, maxDay),
    now.getHours(), now.getMinutes(), now.getSeconds());

  // 5. 升级时重置已用次数为 0（花钱升级应享新会员全部额度）
  const preservedUsed = 0;
  if (isUpgrade) {
    console.log('[activation-service] 会员升级:', existingMember.type, '→', memberType,
      '重置已用次数，新总额:', reportCredits);
  }

  // 6. 家庭→个人降级时清理 family_* 专属字段（isFamily=false 且本次为升级切换）
  const downgradeFromFamily = !isFamily && isUpgrade
    && (existingMember.type === 'family_monthly' || existingMember.type === 'family_yearly');

  // 7. 组装会员数据（update / add 共用）
  const memberData = {
    activated_by_order: orderId, // 记录激活来源，供幂等校验
    type: memberType,
    status: MEMBER_STATUS.ACTIVE,
    expire_date: expireDate,
    report_credits_total: reportCredits,
    report_credits_used: preservedUsed,
    report_credits_reset_at: nextResetAt,
    updated_at: now
  };
  if (isFamily) {
    memberData.family_member_ids = existingMember ? (existingMember.family_member_ids || []) : [];
    memberData.family_max_pet = MEMBER_LIMITS.MAX_PETS_FAMILY;
    memberData.family_credits_total = reportCredits;
    memberData.family_credits_used = preservedUsed;
    memberData.family_credits_reset_at = nextResetAt;
  }

  if (existingMember) {
    const updateData = Object.assign({}, memberData);
    if (downgradeFromFamily) {
      // 移除家庭专属字段
      Object.assign(updateData, {
        family_member_ids: _.remove(),
        family_max_pet: _.remove(),
        family_credits_total: _.remove(),
        family_credits_used: _.remove(),
        family_credits_reset_at: _.remove()
      });
    }
    await db.collection(COLLECTIONS.MEMBERS).doc(existingMember._id).update({ data: updateData });
  } else {
    await db.collection(COLLECTIONS.MEMBERS).add({
      data: Object.assign({
        user_id: openid,
        start_date: now,
        auto_renew: false,
        created_at: now
      }, memberData)
    });
  }

  // 8. 同步 users 集合会员标记（upsert）
  await syncUserMemberStatus(db, openid, true, expireDate, now);

  return { activated: true, expireDate };
}

/**
 * 同步 users 集合的会员状态标记（存在则 update，不存在则 add）
 */
async function syncUserMemberStatus(db, openid, isMember, expireDate, now) {
  const userResult = await db.collection(COLLECTIONS.USERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  if (userResult.data && userResult.data.length > 0) {
    await db.collection(COLLECTIONS.USERS).doc(userResult.data[0]._id).update({
      data: {
        isMember: isMember,
        memberExpire: expireDate,
        updated_at: now
      }
    });
  } else {
    await db.collection(COLLECTIONS.USERS).add({
      data: {
        user_id: openid,
        isMember: isMember,
        memberExpire: expireDate,
        first_report_used: false,
        invite_reward_credits: 0,
        created_at: now,
        updated_at: now
      }
    });
  }
}

module.exports = { activateMembership };
