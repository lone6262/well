/**
 * 管理员认证模块
 * 提供管理员 Token 验证功能，供所有管理端云函数使用
 */
const crypto = require('crypto');
const { SERVER_CONFIG, warmupConfig } = require('./constants');

/**
 * 验证管理员 Token
 * @param {string} token - 管理员 Token
 * @returns {boolean} - Token 是否有效
 */
function verifyAdminToken(token) {
  try {
    if (!token) return false;

    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const payloadStr = Buffer.from(parts[0], 'base64').toString();
    const payload = JSON.parse(payloadStr);

    // 验证签名
    const expectedSignature = crypto
      .createHmac('sha256', SERVER_CONFIG.ADMIN_SECRET || 'default-admin-secret')
      .update(payloadStr)
      .digest('hex');

    if (expectedSignature !== parts[1]) return false;

    // 检查 Token 类型
    if (payload.type !== 'admin') return false;

    // 检查是否过期
    if (Date.now() - payload.timestamp > (payload.expiresIn || 86400000)) return false;

    return true;
  } catch (e) {
    console.error('[admin-auth] Token验证失败:', e.message);
    return false;
  }
}

/**
 * 生成管理员 Token
 * @returns {string} - 管理员 Token
 */
function generateAdminToken() {
  const payload = {
    type: 'admin',
    timestamp: Date.now(),
    expiresIn: 24 * 60 * 60 * 1000 // 24小时
  };

  const payloadStr = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', SERVER_CONFIG.ADMIN_SECRET || 'default-admin-secret')
    .update(payloadStr)
    .digest('hex');

  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

/**
 * 验证请求的管理员权限
 * @param {object} event - 云函数事件对象
 * @returns {object} - { valid: boolean, error?: string }
 */
function validateAdminRequest(event) {
  const token = event && event.adminToken;

  if (!token) {
    return { valid: false, error: '缺少管理员 Token' };
  }

  if (!verifyAdminToken(token)) {
    return { valid: false, error: '管理员 Token 无效或已过期' };
  }

  return { valid: true };
}

module.exports = {
  verifyAdminToken,
  generateAdminToken,
  validateAdminRequest
};
