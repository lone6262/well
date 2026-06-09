// 定时清理 AI 缓存
// 触发方式：定时（每日凌晨 3:00）
// 逻辑：删除过期且非永久（is_permanent !== true）的缓存条目
//       强制清理 7 天以上的非永久缓存
const cloud = require('wx-server-sdk');
const { COLLECTIONS, warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);
  const now = new Date();
  let totalRemoved = 0;

  try {
    // 1. 清理已过期的非永久缓存
    const expiredResult = await db.collection(COLLECTIONS.AI_CACHE)
      .where({
        expire_at: _.lt(now),
        is_permanent: _.neq(true),
      })
      .limit(500)
      .remove();

    totalRemoved += (expiredResult.stats && expiredResult.stats.removed) || 0;

    // 2. 强制清理 7 天以上的非永久缓存（即使 expire_at 未到）
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const staleResult = await db.collection(COLLECTIONS.AI_CACHE)
      .where({
        created_at: _.lt(sevenDaysAgo),
        is_permanent: _.neq(true),
      })
      .limit(500)
      .remove();

    totalRemoved += (staleResult.stats && staleResult.stats.removed) || 0;

    console.log('[cleanExpiredCache] 清理完成, totalRemoved:', totalRemoved);

    // 3. 记录清理统计到 analytics_events
    try {
      await db.collection(COLLECTIONS.ANALYTICS_EVENTS).add({
        data: {
          event_type: 'cache_cleanup',
          event_data: {
            expired_removed: (expiredResult.stats && expiredResult.stats.removed) || 0,
            stale_removed: (staleResult.stats && staleResult.stats.removed) || 0,
            total_removed: totalRemoved,
          },
          created_at: now,
        },
      });
    } catch (_) {}

    return {
      code: 0,
      msg: '清理完成',
      data: { totalRemoved: totalRemoved },
    };

  } catch (error) {
    console.error('[cleanExpiredCache] 清理失败:', error.message);
    return { code: -1, msg: '清理失败: ' + error.message, data: {} };
  }
};
