// 云函数入口文件
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, MEMBER_STATUS, warmupConfig, loadPrices} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

/**
 * 计算下一个额度重置日期（按起始日对齐）
 * 如果用户1月5日开通，重置日应为2月5日、3月5日...
 * 月份天数不足时取当月最后一天（如1月31日 → 2月28日）
 *
 * @param {Date} startDate - 会员开通日期
 * @param {Date} currentReset - 当前（已过期的）重置日期
 * @returns {Date} 下一个重置日期
 */
function calcNextReset(startDate, currentReset) {
  var startDay = startDate.getDate();
  // 从当前重置日的下个月开始推算
  var year = currentReset.getFullYear();
  var month = currentReset.getMonth(); // 0-based

  // 推进到下一个周期
  month += 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }

  // 计算目标日期（处理月末对齐）
  var maxDay = new Date(year, month + 1, 0).getDate(); // 下个月的总天数
  var targetDay = Math.min(startDay, maxDay);

  return new Date(year, month, targetDay, startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
}

/**
 * 获取用户会员状态
 * - 查询 members 集合中的有效会员记录
 * - 检查过期并自动更新状态
 * - 检查报告额度是否需要按月重置
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    // 1. 查询 members 集合中有效会员
    const memberResult = await db.collection(COLLECTIONS.MEMBERS)
      .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE })
      .limit(1)
      .get();

    // 2. 无有效会员记录
    if (!memberResult.data || memberResult.data.length === 0) {
      // 同步 users 集合的会员标识
      await db.collection(COLLECTIONS.USERS)
        .where({ user_id: openid })
        .update({ data: { isMember: false, memberExpire: null } });

      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '获取成功',
        data: {
          is_member: false,
          type: null,
          expire_date: null,
          days_remaining: 0,
          report_credits_total: 0,
          report_credits_used: 0,
          report_credits_remaining: 0,
          next_reset_at: null
        }
      };
    }

    // 3. 找到有效会员记录
    const member = memberResult.data[0];
    const now = new Date();
    const expireDate = new Date(member.expire_date);

    // 4. 检查是否已过期
    if (expireDate <= now) {
      // 更新为已过期
      await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
        data: { status: MEMBER_STATUS.EXPIRED, updated_at: now }
      });
      // 同步 users 集合
      await db.collection(COLLECTIONS.USERS)
        .where({ user_id: openid })
        .update({ data: { isMember: false, memberExpire: null } });

      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '会员已过期',
        data: {
          is_member: false,
          type: member.type,
          expire_date: member.expire_date,
          days_remaining: 0,
          report_credits_total: 0,
          report_credits_used: 0,
          report_credits_remaining: 0,
          next_reset_at: null
        }
      };
    }

    // 5. 加载价格/额度配置（DB 优先，回退默认值）
    const dbPriceConfig = await loadPrices(db);
    const dbCredits = dbPriceConfig.memberCredits;
    const dbPrices = dbPriceConfig.prices;

    let expectedTotal = dbCredits.MONTHLY_REPORTS;
    if (member.type === 'yearly') {
      expectedTotal = dbCredits.YEARLY_REPORTS;
    } else if (member.type === 'family_monthly') {
      expectedTotal = dbCredits.FAMILY_MONTHLY_REPORTS;
    } else if (member.type === 'family_yearly') {
      expectedTotal = dbCredits.FAMILY_YEARLY_REPORTS;
    }
    // 体验会员类型暂不作特殊处理，使用默认值
    let creditsUsed = member.report_credits_used || 0;
    let creditsTotal = expectedTotal; // 始终使用配置值，旧会员自动升级
    let nextResetAt = member.report_credits_reset_at ? new Date(member.report_credits_reset_at) : null;

    if (nextResetAt && now >= nextResetAt) {
      // 月度重置：到期自动清零 + 同步最新 total
      creditsUsed = 0;
      const startDate = member.start_date ? new Date(member.start_date) : now;
      const newResetAt = calcNextReset(startDate, nextResetAt);
      await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
        data: {
          report_credits_used: 0,
          report_credits_total: expectedTotal,
          report_credits_reset_at: newResetAt,
          updated_at: now
        }
      });
      nextResetAt = newResetAt;
    } else if (member.report_credits_total !== expectedTotal) {
      // 配置已更新，静默同步 total 到 DB
      await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
        data: {
          report_credits_total: expectedTotal,
          updated_at: now
        }
      }).catch(() => {}); // 更新失败不影响返回
    }

    const daysRemaining = Math.ceil((expireDate - now) / (24 * 60 * 60 * 1000));
    const creditsRemaining = Math.max(0, creditsTotal - creditsUsed);

    // 查询会员成就数据
    const reportCountResult = await db.collection(COLLECTIONS.ORDERS)
      .where({ user_id: openid, type: 'report', status: 'paid' })
      .count();
    const totalReports = reportCountResult.total || 0;

    // 计算已节省金额（标准价 × 报告数 - 实际总支出）
    let savedAmount = 0;
    if (totalReports > 0) {
      const paidOrdersResult = await db.collection(COLLECTIONS.ORDERS)
        .where({ user_id: openid, status: 'paid' })
        .field({ amount: true })
        .limit(100)
        .get();
      const totalPaid = (paidOrdersResult.data || []).reduce(function(sum, o) {
        return sum + (o.amount || 0);
      }, 0);
      savedAmount = Math.max(0, dbPrices.STANDARD_REPORT * totalReports - totalPaid);
    }

    // 续费价格
    const RENEW_PRICE_MAP = {
      monthly: dbPrices.RENEW_MONTHLY,
      yearly: dbPrices.RENEW_YEARLY,
      family_monthly: dbPrices.RENEW_FAMILY_MONTHLY,
      family_yearly: dbPrices.RENEW_FAMILY_YEARLY,
    };
    const renewPrice = RENEW_PRICE_MAP[member.type] || 0;

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        is_member: true,
        type: member.type,
        expire_date: member.expire_date,
        days_remaining: daysRemaining,
        report_credits_total: creditsTotal,
        report_credits_used: creditsUsed,
        report_credits_remaining: creditsRemaining,
        next_reset_at: nextResetAt,
        total_reports: totalReports,
        saved_amount: savedAmount,
        saved_amount_display: (savedAmount / 100).toFixed(2),
        renew_price: renewPrice,
        renew_price_display: (renewPrice / 100).toFixed(2),
        auto_renew: member.auto_renew || false,
      }
    };

  } catch (error) {
    console.error('查询会员状态失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '服务器错误', data: {} };
  }
};
