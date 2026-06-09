// 定时自动续费云函数（每日扫描到期前3天会员）
// 由云函数定时触发器调用，非用户主动触发
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS, RESPONSE_CODE, ORDER_STATUS, ORDER_TYPES,
  MEMBER_STATUS, PRICES, MEMBER_DURATION, MEMBER_CREDITS,
  warmupConfig
} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MOCK_PAY = true; // 模拟支付模式，商户号到位后改为 false

// 续费价格映射：根据 member.plan_type 确定续费价格 key
const RENEW_PRICE_MAP = {
  monthly: 'RENEW_MONTHLY',
  yearly: 'RENEW_YEARLY',
  family_monthly: 'RENEW_FAMILY_MONTHLY',
  family_yearly: 'RENEW_FAMILY_YEARLY',
};

// 续费时长映射（天）
const RENEW_DURATION_MAP = {
  monthly: MEMBER_DURATION.MONTH,
  yearly: MEMBER_DURATION.YEAR,
  family_monthly: MEMBER_DURATION.MONTH,
  family_yearly: MEMBER_DURATION.YEAR,
};

// 续费后报告额度映射
const RENEW_CREDITS_MAP = {
  monthly: MEMBER_CREDITS.MONTHLY_REPORTS,
  yearly: MEMBER_CREDITS.YEARLY_REPORTS,
  family_monthly: MEMBER_CREDITS.FAMILY_MONTHLY_REPORTS,
  family_yearly: MEMBER_CREDITS.FAMILY_YEARLY_REPORTS,
};

// 续费订单类型映射
const RENEW_ORDER_TYPE_MAP = {
  monthly: ORDER_TYPES.MEMBER_MONTHLY,
  yearly: ORDER_TYPES.MEMBER_YEARLY,
  family_monthly: ORDER_TYPES.MEMBER_FAMILY_MONTHLY,
  family_yearly: ORDER_TYPES.MEMBER_FAMILY_YEARLY,
};

/**
 * 处理单个会员的自动续费
 * @param {object} member - 会员记录
 * @param {Date} now - 当前时间
 * @returns {{ success: boolean, reason?: string }}
 */
async function processRenewal(member, now) {
  const planType = member.plan_type;
  const priceKey = RENEW_PRICE_MAP[planType];

  if (!priceKey) {
    console.warn(`[renewMemberByAuto] 未知 plan_type: ${planType}, member_id: ${member._id}`);
    return { success: false, reason: 'unknown_plan_type' };
  }

  const renewPrice = PRICES[priceKey];
  const renewDays = RENEW_DURATION_MAP[planType];
  const renewCredits = RENEW_CREDITS_MAP[planType];
  const orderType = RENEW_ORDER_TYPE_MAP[planType];

  const outTradeNo = 'RENEW_' + member._id + '_' + now.getTime();

  try {
    if (MOCK_PAY) {
      // ---- 模拟支付：直接完成续费 ----
      const newExpireDate = new Date(member.expire_date.getTime() + renewDays * 24 * 60 * 60 * 1000);
      const nextResetDate = new Date(now.getTime() + MEMBER_DURATION.MONTH * 24 * 60 * 60 * 1000);

      // 创建已支付订单
      await db.collection(COLLECTIONS.ORDERS).add({
        data: {
          user_id: member.user_id,
          member_id: member._id,
          type: orderType,
          amount: renewPrice,
          status: ORDER_STATUS.PAID,
          transaction_id: 'MOCK_' + outTradeNo,
          metadata: {
            plan_type: planType,
            is_auto_renew: true,
            mock_pay: MOCK_PAY,
          },
          paid_at: now,
          created_at: now,
          updated_at: now,
        },
      });

      // 更新会员：延长到期时间、重置额度、清零失败计数
      await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
        data: {
          expire_date: newExpireDate,
          report_credits_used: 0,
          next_reset_date: nextResetDate,
          renew_fail_count: 0,
          updated_at: now,
        },
      });

      // 记录续费日志
      await db.collection(COLLECTIONS.MEMBER_RENEW_LOG).add({
        data: {
          member_id: member._id,
          user_id: member.user_id,
          action: 'renew',
          channel: 'auto',
          plan_type: planType,
          amount: renewPrice,
          duration_days: renewDays,
          new_expire_date: newExpireDate,
          created_at: now,
        },
      });

      console.log(`[renewMemberByAuto] 续费成功: member=${member._id}, plan=${planType}, new_expire=${newExpireDate.toISOString()}`);
      return { success: true };

    } else {
      // ---- 真实支付：创建待支付订单，发起微信支付（stub） ----
      await db.collection(COLLECTIONS.ORDERS).add({
        data: {
          user_id: member.user_id,
          member_id: member._id,
          type: orderType,
          amount: renewPrice,
          status: ORDER_STATUS.PENDING,
          out_trade_no: outTradeNo,
          metadata: {
            plan_type: planType,
            is_auto_renew: true,
          },
          created_at: now,
          updated_at: now,
        },
      });

      // TODO: 调用微信支付统一下单接口
      // const payResult = await cloud.cloudPay.unifiedOrder({ ... });

      console.log(`[renewMemberByAuto] 真实支付订单已创建: member=${member._id}, out_trade_no=${outTradeNo}`);
      return { success: true };
    }
  } catch (error) {
    console.error(`[renewMemberByAuto] 续费处理失败: member=${member._id}`, error.message);

    // 递增失败计数
    try {
      const newFailCount = (member.renew_fail_count || 0) + 1;

      if (newFailCount >= 2) {
        // 失败 2 次及以上，关闭自动续费
        await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
          data: {
            auto_renew: false,
            renew_fail_count: newFailCount,
            updated_at: now,
          },
        });

        await db.collection(COLLECTIONS.MEMBER_RENEW_LOG).add({
          data: {
            member_id: member._id,
            user_id: member.user_id,
            action: 'auto_fail',
            channel: 'auto',
            fail_count: newFailCount,
            reason: error.message,
            created_at: now,
          },
        });

        console.warn(`[renewMemberByAuto] 自动续费已关闭: member=${member._id}, fail_count=${newFailCount}`);
      } else {
        await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
          data: {
            renew_fail_count: newFailCount,
            updated_at: now,
          },
        });
      }
    } catch (updateError) {
      console.error(`[renewMemberByAuto] 更新失败计数异常: member=${member._id}`, updateError.message);
    }

    return { success: false, reason: error.message };
  }
}

exports.main = async (event, context) => {
  await warmupConfig(db);

  const now = new Date();
  // 计算到期窗口：当前时间 < expire_date <= 当前时间 + 3天
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  try {
    // 查询即将到期且开启自动续费的会员
    const { data: members } = await db.collection(COLLECTIONS.MEMBERS)
      .where({
        status: MEMBER_STATUS.ACTIVE,
        auto_renew: true,
        expire_date: _.gt(now).and(_.lte(threeDaysLater)),
      })
      .get();

    if (!members || members.length === 0) {
      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '无待续费会员',
        data: { processed: 0, success: 0, failed: 0 },
      };
    }

    console.log(`[renewMemberByAuto] 扫描到 ${members.length} 个待续费会员`);

    let successCount = 0;
    let failCount = 0;

    // 顺序处理每个会员（避免数据库并发写入压力）
    for (const member of members) {
      const result = await processRenewal(member, now);
      if (result.success) {
        successCount += 1;
      } else {
        failCount += 1;
      }
    }

    const summary = {
      processed: members.length,
      success: successCount,
      failed: failCount,
    };

    console.log(`[renewMemberByAuto] 批量续费完成:`, JSON.stringify(summary));

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: `处理完成：${members.length} 个会员`,
      data: summary,
    };
  } catch (error) {
    console.error('[renewMemberByAuto] 扫描失败:', error.message);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '自动续费扫描失败',
      data: { processed: 0, success: 0, failed: 0 },
    };
  }
};
