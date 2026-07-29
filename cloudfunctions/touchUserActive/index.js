/**
 * touchUserActive — 更新用户活跃时间
 *
 * 由小程序 app.js onShow 节流调用（60s 一次），用于 generatePetDiary 的"近 14 天活跃"过滤。
 * silentLogin 仅冷启动触发，无法覆盖热启动，故独立维护 last_active_at。
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { createLogger } = require('./common/logger');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const logger = createLogger('touchUserActive');

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    const now = new Date();
    const userRes = await db.collection(COLLECTIONS.USERS).where({ user_id: OPENID }).limit(1).get();

    if (userRes.data && userRes.data.length > 0) {
      await db.collection(COLLECTIONS.USERS).doc(userRes.data[0]._id).update({
        data: { last_active_at: now, updated_at: now }
      });
      return { code: RESPONSE_CODE.SUCCESS, msg: 'ok', data: {} };
    }

    // 无用户记录也静默成功，避免阻塞前端启动
    return { code: RESPONSE_CODE.SUCCESS, msg: 'no user record', data: {} };
  } catch (err) {
    logger.warn('touchUserActive 失败: ' + err.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '更新失败', data: {} };
  }
};
