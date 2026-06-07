// 删除自查记录云函数
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE , warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { logAuditEvent } = require('./common/audit-logger');
const { createLogger } = require('./common/logger');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const logger = createLogger('deleteRecord');

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { recordId, token } = event;
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  // Token 验证（删除操作需验证身份）
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败，请重新登录', data: {} };
  }

  if (!openid || !recordId) {
    return { code: RESPONSE_CODE.ERROR, msg: '参数不完整', data: {} };
  }

  try {
    // 查询记录确认归属
    const record = await db.collection('symptom_records').doc(recordId).get();
    if (!record.data) {
      return { code: RESPONSE_CODE.NOT_FOUND, msg: '记录不存在' };
    }
    if (record.data.user_id !== openid) {
      return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '无权删除此记录' };
    }

    // 删除记录
    await db.collection('symptom_records').doc(recordId).remove();
    
    // 记录审计日志
    await logAuditEvent(db, openid, 'delete_record', { recordId: recordId });
    
    return { code: RESPONSE_CODE.SUCCESS, msg: '删除成功' };
  } catch (err) {
    logger.error('删除记录失败:', err);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '删除失败，请稍后重试', data: {} };
  }
};
