/**
 * 基础速率限制模块
 * 基于用户 openid + 操作类型计数，防止 API 滥用
 *
 * 使用方式：
 *   const { checkRateLimit } = require('../common/rate-limiter');
 *   const ok = await checkRateLimit(db, openid, 'createOrder', 10, 60000, false);
 *   if (!ok) return error('操作过于频繁，请稍后再试');
 *
 * 限流记录存储在 rate_limits 集合中（需在 dbInit 中创建索引：openid + action + created_at）
 */
const { COLLECTIONS } = require('./constants');

/**
 * 检查速率限制
 * @param {object} db - 数据库实例
 * @param {string} openid - 用户标识
 * @param {string} action - 操作类型标识
 * @param {number} maxRequests - 时间窗口内最大请求数
 * @param {number} windowMs - 时间窗口（毫秒）
 * @param {boolean} [failOpen=false] - true=限流故障时放行（适合读操作），false=拒绝（适合写操作）
 * @returns {Promise<boolean>} true 表示允许，false 表示超限
 */
async function checkRateLimit(db, openid, action, maxRequests, windowMs, failOpen = false) {
  const cutoff = new Date(Date.now() - windowMs);

  try {
    // 先写入记录，再计数 — 减少并发窗口（但仍非原子，微信云开发基础版无事务）
    const addResult = await db.collection(COLLECTIONS.RATE_LIMITS || 'rate_limits').add({
      data: { openid: openid, action: action, created_at: new Date() }
    });

    const countResult = await db.collection(COLLECTIONS.RATE_LIMITS || 'rate_limits')
      .where({ openid: openid, action: action, created_at: db.command.gte(cutoff) })
      .count();

    if (countResult.total > maxRequests) {
      // 超限：回滚刚写入的记录
      try {
        await db.collection(COLLECTIONS.RATE_LIMITS || 'rate_limits').doc(addResult._id).remove();
      } catch (rollbackErr) {
        console.warn('[rate-limiter] 回滚限流记录失败:', rollbackErr.message);
      }
      return false;
    }

    // 概率性清理过期记录（约 1% 概率，避免每次调用都清理）
    if (Math.random() < 0.01) {
      try {
        await db.collection(COLLECTIONS.RATE_LIMITS || 'rate_limits')
          .where({ created_at: db.command.lt(cutoff) })
          .limit(100)
          .remove();
      } catch (cleanupErr) {
        // 清理失败不影响主流程
        console.warn('[rate-limiter] 过期记录清理失败:', cleanupErr.message);
      }
    }

    return true;
  } catch (error) {
    console.error('[rate-limiter] check failed:', error.message);
    // failOpen: true = 放行（读操作），false = 拒绝（写操作）
    return failOpen;
  }
}

module.exports = { checkRateLimit };
