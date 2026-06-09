// 云函数入口文件
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, PRICES, MEMBER_STATUS, MEMBER_CREDITS , warmupConfig} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

/**
 * 计算下一个额度重置日期（按起始日对齐）
 */
function calcNextReset(startDate, currentReset) {
  var startDay = startDate.getDate();
  var year = currentReset.getFullYear();
  var month = currentReset.getMonth();
  month += 1;
  if (month > 11) { month = 0; year += 1; }
  var maxDay = new Date(year, month + 1, 0).getDate();
  var targetDay = Math.min(startDay, maxDay);
  return new Date(year, month, targetDay, startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
}

/**
 * 检查用户报告额度
 * 优先级：
 * 1. 新用户首份优惠（¥1.00）
 * 2. 邀请奖励免费额度
 * 3. 体验会员额度（每月1次）
 * 4. 会员每月免费报告额度
 * 5. 点数包余额
 * 6. 付费报告（¥9.90）
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    // 1. 获取用户信息
    const userResult = await db.collection(COLLECTIONS.USERS)
      .where({ user_id: openid })
      .limit(1)
      .get();

    const user = userResult.data && userResult.data[0];

    // 2. 检查首份报告优惠（新用户或未使用过的用户）
    // 追加 ORDERS 交叉验证：防止用户删除账号重新注册绕过首份优惠
    if (!user || !user.first_report_used) {
      const prevFirstOrder = await db.collection(COLLECTIONS.ORDERS)
        .where({
          user_id: openid,
          type: 'report',
          'metadata.is_first_report': true,
          status: 'paid'
        })
        .limit(1)
        .get();

      if (prevFirstOrder.data && prevFirstOrder.data.length > 0) {
        // 用户曾使用过首份优惠，修复标记并跳过
        if (user && user._id) {
          await db.collection(COLLECTIONS.USERS).doc(user._id).update({
            data: { first_report_used: true, updated_at: new Date() }
          });
        }
        // 继续检查其他额度来源
      } else {
        return {
          code: RESPONSE_CODE.SUCCESS,
          msg: '新用户首份优惠',
          data: {
            has_free_quota: true,
            quota_source: 'first_report',
            price: PRICES.FIRST_REPORT,
            price_display: '1.00',
            description: '新用户首份AI报告仅需1元'
          }
        };
      }
    }

    // 3. 检查邀请奖励额度
    if (user && user.invite_reward_credits && user.invite_reward_credits > 0) {
      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '邀请奖励额度',
        data: {
          has_free_quota: true,
          quota_source: 'invite',
          price: 0,
          price_display: '免费',
          description: '邀请奖励免费报告（剩余' + user.invite_reward_credits + '次）'
        }
      };
    }

    // 4. 检查会员额度
    const memberResult = await db.collection(COLLECTIONS.MEMBERS)
      .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE })
      .limit(1)
      .get();

    if (memberResult.data && memberResult.data.length > 0) {
      const member = memberResult.data[0];
      const now = new Date();
      const nextResetAt = member.report_credits_reset_at ? new Date(member.report_credits_reset_at) : null;

      // 月度重置：到期自动清零
      let used = member.report_credits_used || 0;
      if (nextResetAt && now >= nextResetAt) {
        used = 0;
        const startDate = member.start_date ? new Date(member.start_date) : now;
        const newResetAt = calcNextReset(startDate, nextResetAt);
        await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
          data: {
            report_credits_used: 0,
            report_credits_reset_at: newResetAt,
            updated_at: now
          }
        });
        console.log('[checkReportQuota] 会员额度已按月重置，下次重置:', newResetAt);
      }

      const expectedTotal = member.type === 'yearly' ? MEMBER_CREDITS.YEARLY_REPORTS : MEMBER_CREDITS.MONTHLY_REPORTS;
      let total = member.report_credits_total || expectedTotal;
      // 旧会员迁移：如果库里的 total 低于当前配置，使用新值
      if (total < expectedTotal) total = expectedTotal;
      const remaining = Math.max(0, total - used);

      if (remaining > 0) {
        return {
          code: RESPONSE_CODE.SUCCESS,
          msg: '会员额度',
          data: {
            has_free_quota: true,
            quota_source: 'member',
            price: 0,
            price_display: '免费',
            description: '会员每月免费报告（剩余' + remaining + '/' + total + '次）'
          }
        };
      }

      // 会员额度已用完
      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '会员额度已用完',
        data: {
          has_free_quota: false,
          quota_source: 'paid',
          price: PRICES.STANDARD_REPORT,
          price_display: '9.90',
          member_quota_exhausted: true,
          member_quota_used: used,
          member_quota_total: total,
          description: '本月免费额度已用完（' + used + '/' + total + '），可按标准价获取'
        }
      };
    }

    // 4.5 检查点数包余额
    const pointsResult = await db.collection(COLLECTIONS.USER_POINTS)
      .where({ user_id: openid })
      .limit(1)
      .get();

    if (pointsResult.data && pointsResult.data.length > 0) {
      const points = pointsResult.data[0];
      const now = new Date();
      if (points.balance > 0 && points.expire_at && new Date(points.expire_at) > now) {
        return {
          code: RESPONSE_CODE.SUCCESS,
          msg: '点数包余额',
          data: {
            has_free_quota: true,
            quota_source: 'points',
            price: 0,
            price_display: '免费',
            description: '使用点数包余额（剩余' + points.balance + '次）'
          }
        };
      }
    }

    // 5. 无免费额度，需要付费
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '需要付费',
      data: {
        has_free_quota: false,
        quota_source: 'paid',
        price: PRICES.STANDARD_REPORT,
        price_display: '9.90',
        description: '标准AI健康报告'
      }
    };

  } catch (error) {
    console.error('检查报告额度失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '服务器错误', data: {} };
  }
};
