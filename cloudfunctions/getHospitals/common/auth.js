/**
 * 认证工具模块
 * 提供统一的 openid 获取和 Token 验证功能
 *
 * 使用方式：
 *   const { getOpenid, verifyToken } = require('../common/auth');
 *   const openid = getOpenid(context);
 *   const payload = verifyToken(event.token);
 */

const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { SERVER_CONFIG } = require('./constants');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const TOKEN_EXPIRE_DAYS = 1; // Token 有效期 1 天，前端 refreshTokenIfNeeded 负责自动续期

/**
 * 获取 TOKEN_SECRET（运行时从 SERVER_CONFIG 读取，支持数据库刷新）
 * 云函数入口调用 warmupConfig(db) 后，SERVER_CONFIG 已包含数据库最新值
 * @returns {string} TOKEN_SECRET
 */
function getTokenSecret() {
  const secret = SERVER_CONFIG.TOKEN_SECRET;
  if (!secret) {
    throw new Error('[auth] TOKEN_SECRET 未配置！请确保 secrets.js 或 system_config 集合中已设置。');
  }
  return secret;
}

/**
 * 从云函数上下文获取 openid（服务端安全获取）
 * @param {object} context - 云函数 context 参数
 * @returns {string} openid
 */
function getOpenid(context) {
  const { OPENID } = cloud.getWXContext();
  return OPENID;
}

/**
 * 创建 HMAC-SHA256 签名
 * @param {string} payload - 待签名内容
 * @param {string} secret - 签名密钥
 * @returns {string} 签名结果
 */
function createSignature(payload, secret) {
  return crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * 生成签名的 Token（格式: base64(header.payload).signature）
 * @param {string} openid - 用户的 openid
 * @param {string} userId - 用户的数据库 _id
 * @returns {string} JWT 格式的 token
 */
function generateToken(openid, userId) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    openid: openid,
    userId: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRE_DAYS * 24 * 60 * 60
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(`${headerB64}.${payloadB64}`, getTokenSecret());

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * 验证 Token 有效性
 * @param {string} token - JWT 格式的 token
 * @returns {object|null} 验证成功返回 payload，失败返回 null
 */
function verifyToken(token) {
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;

    // 验证签名（使用常量时间比较防止时序攻击）
    const expectedSig = createSignature(`${headerB64}.${payloadB64}`, getTokenSecret());
    const sigBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    // 解码 payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // 检查过期
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * 验证 Token 并返回 openid（组合便捷方法）
 * @param {object} event - 云函数 event 参数
 * @param {object} context - 云函数 context 参数
 * @returns {{ openid: string, valid: boolean, payload: object|null }}
 */
function authenticate(event, context) {
  const openid = getOpenid(context);
  const payload = verifyToken(event.token || '');
  // 交叉校验：Token 中的 openid 必须与 WXContext 的 openid 一致
  const tokenOpenidMatch = payload && payload.openid === openid;

  return {
    openid: openid,
    valid: !!(payload && tokenOpenidMatch),
    payload: tokenOpenidMatch ? payload : null
  };
}

module.exports = {
  getOpenid,
  generateToken,
  verifyToken,
  authenticate,
  TOKEN_EXPIRE_DAYS
};
