// 定时扫描已过期会员并更新状态
// 触发方式：云函数定时触发器（每日执行）
//
// 处理逻辑：
//   1. 查询 status='active' 且 expire_date < now 的会员
//   2. 将会员状态更新为 'expired'
//   3. 同步更新 users 集合的会员标记
//   4. 处理家庭会员的子成员状态
//   5. 记录过期日志
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, MEMBER_STATUS, warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 主入口：扫描并标记过期会员
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  const now = new Date();
  const summary = {
    expiredCount: 0,
    familyMembersUpdated: 0,
    errors: 0,
  };

  try {
    // 分页查询所有已过期但仍为 active 的会员
    let processed = 0;
    const batchSize = 100;
    let hasMore = true;

    while (hasMore) {
      const result = await db.collection(COLLECTIONS.MEMBERS)
        .where({
          status: MEMBER_STATUS.ACTIVE,
          expire_date: _.lt(now),
        })
        .skip(processed)
        .limit(batchSize)
        .get();

      const members = result.data;
      if (!members || members.length === 0) {
        hasMore = false;
        break;
      }

      for (const member of members) {
        try {
          await expireMember(member, now, summary);
          summary.expiredCount += 1;
        } catch (err) {
          console.error(`[checkExpiredMembers] 会员 ${member._id} 过期处理失败:`, err.message);
          summary.errors += 1;
        }
      }

      processed += members.length;

      // 如果本批不足 batchSize，说明已经到末尾
      if (members.length < batchSize) {
        hasMore = false;
      }
    }

    console.log(`[checkExpiredMembers] 完成: ${JSON.stringify(summary)}`);
    return { code: RESPONSE_CODE.SUCCESS, msg: '过期扫描完成', data: summary };

  } catch (error) {
    console.error('[checkExpiredMembers] 执行失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '过期扫描失败', data: summary };
  }
};

/**
 * 处理单个会员的过期逻辑
 *
 * @param {object} member - 会员记录
 * @param {Date} now - 当前时间
 * @param {object} summary - 统计汇总对象（就地更新）
 */
async function expireMember(member, now, summary) {
  const memberId = member._id;
  const userId = member.user_id;

  // 1. 更新会员状态为 expired
  await db.collection(COLLECTIONS.MEMBERS).doc(memberId).update({
    data: {
      status: MEMBER_STATUS.EXPIRED,
      expired_at: now,
      updated_at: now,
    },
  });

  // 2. 更新 users 集合：取消会员标记
  try {
    await db.collection(COLLECTIONS.USERS)
      .where({ user_id: userId })
      .limit(1)
      .update({
        data: {
          isMember: false,
          memberExpire: member.expire_date,
          updated_at: now,
        },
      });
  } catch (err) {
    console.error(`[checkExpiredMembers] 更新用户 ${userId} 会员标记失败:`, err.message);
  }

  // 3. 处理家庭子成员
  if (member.family_members && Array.isArray(member.family_members)) {
    for (const familyUserId of member.family_members) {
      try {
        // 移除子成员的会员状态
        await db.collection(COLLECTIONS.USERS)
          .where({ user_id: familyUserId })
          .limit(1)
          .update({
            data: {
              isMember: false,
              memberExpire: member.expire_date,
              updated_at: now,
            },
          });

        // 如果子成员也有独立的会员记录，标记为过期
        const familyMemberRecords = await db.collection(COLLECTIONS.MEMBERS)
          .where({
            user_id: familyUserId,
            status: MEMBER_STATUS.ACTIVE,
            source_member_id: memberId,
          })
          .limit(1)
          .get();

        if (familyMemberRecords.data && familyMemberRecords.data.length > 0) {
          await db.collection(COLLECTIONS.MEMBERS)
            .doc(familyMemberRecords.data[0]._id)
            .update({
              data: {
                status: MEMBER_STATUS.EXPIRED,
                expired_at: now,
                updated_at: now,
              },
            });
        }

        summary.familyMembersUpdated += 1;
      } catch (err) {
        console.error(`[checkExpiredMembers] 家庭子成员 ${familyUserId} 处理失败:`, err.message);
      }
    }
  }

  // 4. 记录过期日志
  await db.collection(COLLECTIONS.MEMBER_RENEW_LOG).add({
    data: {
      member_id: memberId,
      user_id: userId,
      action: 'expire',
      channel: 'auto',
      detail: {
        expire_date: member.expire_date,
        member_type: member.type || 'unknown',
        family_count: (member.family_members || []).length,
      },
      created_at: now,
    },
  });
}
