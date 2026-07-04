// 清空会员数据 — 测试专用
// 谨慎使用！会删除所有会员记录并重置用户会员标记
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, warmupConfig, SERVER_CONFIG } = require('./common/constants');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);

  const { adminSecret, confirm } = event || {};

  // 1. 鉴权
  const expectedSecret = SERVER_CONFIG.ADMIN_SECRET;
  if (!adminSecret || !expectedSecret) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '管理员鉴权失败', data: {} };
  }
  const providedBuf = Buffer.from(adminSecret);
  const expectedBuf = Buffer.from(expectedSecret);
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '管理员鉴权失败', data: {} };
  }

  // 2. 二次确认
  if (confirm !== true) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '危险操作：请在参数中设置 confirm: true 以确认清空全部会员数据',
      data: { warning: '此操作将删除 members 集合所有记录，并重置 users 集合中的会员标记' }
    };
  }

  const results = {
    membersDeleted: 0,
    usersReset: 0,
    ordersDeleted: 0,
    errors: []
  };

  try {
    // 3. 清空 members 集合
    console.log('[clearMemberData] 开始清空 members 集合...');
    const membersRes = await db.collection(COLLECTIONS.MEMBERS).where({ _id: _.exists(true) }).count();
    const memberTotal = membersRes.total || 0;

    if (memberTotal > 0) {
      // 微信云开发 limit(100) 分批删除
      let deleted = 0;
      while (deleted < memberTotal) {
        const batch = await db.collection(COLLECTIONS.MEMBERS)
          .where({ _id: _.exists(true) })
          .limit(100)
          .get();
        if (!batch.data || batch.data.length === 0) break;

        for (const doc of batch.data) {
          try {
            await db.collection(COLLECTIONS.MEMBERS).doc(doc._id).remove();
            deleted++;
          } catch (e) {
            results.errors.push({ collection: 'members', id: doc._id, error: e.message });
          }
        }
      }
      results.membersDeleted = deleted;
      console.log('[clearMemberData] members 已删除:', deleted);
    }

    // 4. 重置 users 集合中的会员标记
    console.log('[clearMemberData] 开始重置 users 会员标记...');
    const usersRes = await db.collection(COLLECTIONS.USERS)
      .where({ isMember: true })
      .count();
    const userTotal = usersRes.total || 0;

    if (userTotal > 0) {
      let reset = 0;
      while (reset < userTotal) {
        const batch = await db.collection(COLLECTIONS.USERS)
          .where({ isMember: true })
          .limit(100)
          .get();
        if (!batch.data || batch.data.length === 0) break;

        for (const doc of batch.data) {
          try {
            await db.collection(COLLECTIONS.USERS).doc(doc._id).update({
              data: {
                isMember: false,
                memberExpire: null,
                updated_at: new Date()
              }
            });
            reset++;
          } catch (e) {
            results.errors.push({ collection: 'users', id: doc._id, error: e.message });
          }
        }
      }
      results.usersReset = reset;
      console.log('[clearMemberData] users 已重置:', reset);
    }

    // 5. 删除 member 类型的订单（可选）
    if (event.clearOrders === true) {
      console.log('[clearMemberData] 开始删除会员订单...');
      const orderTypes = ['member', 'member_monthly', 'member_yearly', 'member_family_monthly', 'member_family_yearly'];
      const ordersRes = await db.collection(COLLECTIONS.ORDERS)
        .where({ type: _.in(orderTypes) })
        .count();
      const orderTotal = ordersRes.total || 0;

      if (orderTotal > 0) {
        let deleted = 0;
        while (deleted < orderTotal) {
          const batch = await db.collection(COLLECTIONS.ORDERS)
            .where({ type: _.in(orderTypes) })
            .limit(100)
            .get();
          if (!batch.data || batch.data.length === 0) break;

          for (const doc of batch.data) {
            try {
              await db.collection(COLLECTIONS.ORDERS).doc(doc._id).remove();
              deleted++;
            } catch (e) {
              results.errors.push({ collection: 'orders', id: doc._id, error: e.message });
            }
          }
        }
        results.ordersDeleted = deleted;
        console.log('[clearMemberData] 会员订单已删除:', deleted);
      }
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '会员数据已清空',
      data: results
    };

  } catch (error) {
    console.error('[clearMemberData] 执行失败:', error.message);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '清空失败: ' + error.message,
      data: results
    };
  }
};
