/**
 * 管理员认证模块
 * 提供管理员 Token 验证功能，供所有管理端云函数使用
 */
const crypto = require('crypto');
const { SERVER_CONFIG, warmupConfig } = require('./constants');

/**
 * 获取管理员密钥（未配置时直接拒绝服务，防止降级攻击）
 * @returns {string} - 管理员密钥
 * @throws {Error} - 密钥未配置时抛出异常
 */
function getAdminSecret() {
  const secret = SERVER_CONFIG.ADMIN_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SECRET 未配置，请在 system_config 集合中设置');
  }
  return secret;
}

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

    // 验证签名（密钥未配置时直接返回 false）
    let secret;
    try {
      secret = getAdminSecret();
    } catch (e) {
      console.error('[admin-auth] 密钥未配置，拒绝所有管理员请求');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex');

    // 使用恒定时间比较防止时序攻击（与 auth.js 保持一致）
    const sigBuf = Buffer.from(parts[1], 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return false;
    }

    // 检查 Token 类型
    if (payload.type !== 'admin') return false;

    // C-2 修复：强制校验 timestamp 存在且为有效数字（防止 NaN 绕过）
    if (typeof payload.timestamp !== 'number' || payload.timestamp <= 0) return false;
    // 检查时间戳是否来自未来（允许60秒时钟偏差）
    if (payload.timestamp > Date.now() + 60000) return false;
    // 检查是否过期（服务端硬编码最大有效期，不从 Token 读取）
    const MAX_ADMIN_TOKEN_TTL = 24 * 60 * 60 * 1000; // 24小时
    if (Date.now() - payload.timestamp > MAX_ADMIN_TOKEN_TTL) return false;

    return true;
  } catch (e) {
    console.error('[admin-auth] Token验证失败:', e.message);
    return false;
  }
}

/**
 * 生成管理员 Token
 * @returns {string} - 管理员 Token
 * @throws {Error} - 密钥未配置时抛出异常
 */
function generateAdminToken() {
  const secret = getAdminSecret();

  const payload = {
    type: 'admin',
    timestamp: Date.now(),
    expiresIn: 24 * 60 * 60 * 1000 // 24小时
  };

  const payloadStr = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
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
