/**
 * 审计日志模块
 * 记录安全相关操作（登录、删除、敏感数据修改等）到 audit_logs 集合
 *
 * 使用方式：
 *   const { logAuditEvent } = require('./common/audit-logger');
 *   await logAuditEvent(db, openid, 'delete_pet', { petId: 'xxx', petName: '小白' });
 */

var COLLECTION_NAME = 'audit_logs';

/**
 * 记录审计事件
 * @param {object} db - 数据库实例
 * @param {string} openid - 用户标识
 * @param {string} action - 操作类型（如 'delete_pet', 'delete_record', 'save_pet', 'login', 'submit_symptom'）
 * @param {object} [details] - 可选的操作详情
 * @returns {Promise<void>} 静默完成，失败不影响主流程
 */
async function logAuditEvent(db, openid, action, details) {
  try {
    await db.collection(COLLECTION_NAME).add({
      data: {
        openid: openid,
        action: action,
        details: details || {},
        created_at: new Date()
      }
    });
  } catch (error) {
    // 审计日志写入失败不应阻断主流程，仅记录错误
    console.error('[audit-logger] 写入审计日志失败:', error.message);
  }
}

module.exports = { logAuditEvent };
