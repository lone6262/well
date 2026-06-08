/**
 * 管理员登录云函数
 * 验证管理员密钥，生成管理员会话 Token
 */
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { SERVER_CONFIG, RESPONSE_CODE, warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// Token 有效期：24小时
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

/**
 * 生成管理员 Token
 */
function generateAdminToken() {
  const payload = {
    type: 'admin',
    timestamp: Date.now(),
    expiresIn: TOKEN_EXPIRY
  };

  const payloadStr = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', SERVER_CONFIG.ADMIN_SECRET || 'default-admin-secret')
    .update(payloadStr)
    .digest('hex');

  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

/**
 * 验证管理员 Token
 */
function verifyAdminToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const payload = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const signature = crypto
      .createHmac('sha256', SERVER_CONFIG.ADMIN_SECRET || 'default-admin-secret')
      .update(Buffer.from(parts[0], 'base64').toString())
      .digest('hex');

    if (signature !== parts[1]) return false;

    // 检查是否过期
    if (Date.now() - payload.timestamp > payload.expiresIn) return false;

    return true;
  } catch (e) {
    return false;
  }
}

exports.main = async (event, context) => {
  await warmupConfig(db);

  const { adminSecret } = event;

  console.log('[adminLogin] 管理员登录请求');

  // 验证管理员密钥
  if (!adminSecret || adminSecret !== SERVER_CONFIG.ADMIN_SECRET) {
    console.warn('[adminLogin] 管理员密钥错误');
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: '管理员密钥错误',
      data: {}
    };
  }

  try {
    // 生成管理员 Token
    const adminToken = generateAdminToken();

    console.log('[adminLogin] 管理员登录成功');

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '登录成功',
      data: {
        adminToken: adminToken,
        expiresIn: TOKEN_EXPIRY / 1000, // 转换为秒
        tokenType: 'Bearer'
      }
    };

  } catch (error) {
    console.error('[adminLogin] 登录失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '登录失败，请稍后重试',
      data: {}
    };
  }
};

// 导出验证函数供其他云函数使用
exports.verifyAdminToken = verifyAdminToken;
