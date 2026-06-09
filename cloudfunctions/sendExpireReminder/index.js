// 定时发送会员到期提醒和流失召回
// 触发方式：云函数定时触发器（每日执行）
//
// 召回策略：
//   到期前 7 天 → 续费 8 折券 + 推送提醒
//   到期前 1 天 → 紧急提醒推送
//   到期后 3/7/15 天 → 回归券 + 召回推送
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, MEMBER_STATUS, warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// === 时间常量 ===
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// === 召回窗口定义 ===
const PRE_EXPIRY_WINDOWS = [7, 1];   // 到期前 N 天
const POST_EXPIRY_WINDOWS = [3, 7, 15]; // 到期后 N 天

/**
 * 主入口：扫描到期/已过期会员，发送提醒和召回
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  const now = new Date();
  const summary = {
    preExpiryReminders: 0,
    postExpiryRecalls: 0,
    couponsIssued: 0,
    errors: 0,
  };

  try {
    // ---- 阶段 1：到期前提醒 ----
    for (const daysBefore of PRE_EXPIRY_WINDOWS) {
      const windowStart = new Date(now.getTime() + (daysBefore - 0.5) * ONE_DAY_MS);
      const windowEnd = new Date(now.getTime() + (daysBefore + 0.5) * ONE_DAY_MS);

      const membersResult = await db.collection(COLLECTIONS.MEMBERS)
        .where({
          status: MEMBER_STATUS.ACTIVE,
          expire_date: _.gte(windowStart).and(_.lte(windowEnd)),
        })
        .limit(100)
        .get();

      for (const member of membersResult.data) {
        try {
          // 防止短时间内重复推送：检查 last_renew_notify 是否在 24h 内
          if (member.last_renew_notify) {
            const lastNotify = new Date(member.last_renew_notify);
            if (now.getTime() - lastNotify.getTime() < ONE_DAY_MS) {
              continue; // 24 小时内已通知，跳过
            }
          }

          // 到期前 7 天发放续费券
          if (daysBefore === 7) {
            const couponResult = await cloud.callFunction({
              name: 'autoIssueCoupon',
              data: { userId: member.user_id, scene: 'renew' },
            });
            if (couponResult.result && couponResult.result.code === RESPONSE_CODE.SUCCESS) {
              summary.couponsIssued += 1;
            }
          }

          // 更新 last_renew_notify
          await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
            data: { last_renew_notify: now },
          });

          // 推送订阅消息（占位，需要模板 ID 后启用）
          await sendSubscribeMessage(member, daysBefore);

          // 记录日志
          await db.collection(COLLECTIONS.MEMBER_RENEW_LOG).add({
            data: {
              member_id: member._id,
              user_id: member.user_id,
              action: 'recall',
              channel: 'auto',
              detail: `pre_expiry_${daysBefore}d`,
              created_at: now,
            },
          });

          summary.preExpiryReminders += 1;
        } catch (err) {
          console.error(`[sendExpireReminder] 会员 ${member._id} 到期前提醒失败:`, err.message);
          summary.errors += 1;
        }
      }
    }

    // ---- 阶段 2：到期后召回 ----
    for (const daysAfter of POST_EXPIRY_WINDOWS) {
      const windowStart = new Date(now.getTime() - (daysAfter + 0.5) * ONE_DAY_MS);
      const windowEnd = new Date(now.getTime() - (daysAfter - 0.5) * ONE_DAY_MS);

      const expiredResult = await db.collection(COLLECTIONS.MEMBERS)
        .where({
          status: MEMBER_STATUS.EXPIRED,
          expire_date: _.gte(windowStart).and(_.lte(windowEnd)),
        })
        .limit(100)
        .get();

      for (const member of expiredResult.data) {
        try {
          // 检查是否已在当前窗口发送过召回
          const existingRecall = await db.collection(COLLECTIONS.MEMBER_RENEW_LOG)
            .where({
              member_id: member._id,
              action: 'recall',
              detail: `post_expiry_${daysAfter}d`,
            })
            .limit(1)
            .get();

          if (existingRecall.data && existingRecall.data.length > 0) {
            continue; // 本轮已召回，跳过
          }

          // 发放回归券
          const couponResult = await cloud.callFunction({
            name: 'autoIssueCoupon',
            data: { userId: member.user_id, scene: 'return' },
          });
          if (couponResult.result && couponResult.result.code === RESPONSE_CODE.SUCCESS) {
            summary.couponsIssued += 1;
          }

          // 推送召回消息（占位）
          await sendRecallMessage(member, daysAfter);

          // 记录日志
          await db.collection(COLLECTIONS.MEMBER_RENEW_LOG).add({
            data: {
              member_id: member._id,
              user_id: member.user_id,
              action: 'recall',
              channel: 'auto',
              detail: `post_expiry_${daysAfter}d`,
              created_at: now,
            },
          });

          summary.postExpiryRecalls += 1;
        } catch (err) {
          console.error(`[sendExpireReminder] 会员 ${member._id} 召回失败:`, err.message);
          summary.errors += 1;
        }
      }
    }

    console.log(`[sendExpireReminder] 完成: ${JSON.stringify(summary)}`);
    return { code: RESPONSE_CODE.SUCCESS, msg: '提醒发送完成', data: summary };

  } catch (error) {
    console.error('[sendExpireReminder] 执行失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '提醒发送失败', data: summary };
  }
};

/**
 * 发送到期前订阅消息（占位）
 * 需要配置微信订阅消息模板 ID 后启用
 *
 * @param {object} member - 会员记录
 * @param {number} daysBefore - 到期前天数
 */
async function sendSubscribeMessage(member, daysBefore) {
  // TODO: 配置订阅消息模板 ID 后启用
  // const templateId = SERVER_CONFIG.EXPIRE_REMINDER_TEMPLATE_ID;
  // if (!templateId) return;
  //
  // await cloud.openapi.subscribeMessage.send({
  //   touser: member.user_id,
  //   templateId,
  //   page: 'pages/member/index',
  //   data: {
  //     thing1: { value: '您的会员即将到期' },
  //     date2: { value: formatDate(member.expire_date) },
  //     thing3: { value: daysBefore === 7 ? '续费享8折优惠' : '明天到期，抓紧续费' },
  //   },
  // });
  console.info(`[sendExpireReminder] 到期前 ${daysBefore} 天提醒 → 用户 ${member.user_id}（订阅消息待配置）`);
}

/**
 * 发送召回订阅消息（占位）
 * 需要配置微信订阅消息模板 ID 后启用
 *
 * @param {object} member - 会员记录
 * @param {number} daysAfter - 过期后天数
 */
async function sendRecallMessage(member, daysAfter) {
  // TODO: 配置订阅消息模板 ID 后启用
  console.info(`[sendExpireReminder] 过期 ${daysAfter} 天召回 → 用户 ${member.user_id}（订阅消息待配置）`);
}
