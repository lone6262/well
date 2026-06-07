// 服务端海报生成云函数
// 使用 SVG 生成分享海报图片，比前端 Canvas 更稳定、更安全
// 海报内容：App 标题 + 推荐人信息 + 功能亮点 + 邀请码
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  INVITE_CONFIG,
  warmupConfig
} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * HTML 转义（防止注入）
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 生成海报 SVG 字符串
 * @param {object} params - 海报参数
 * @param {string} params.nickname - 推荐人昵称
 * @param {number} params.rewardedCount - 已成功邀请人数
 * @param {string} params.inviteCode - 邀请码
 * @returns {string} SVG 字符串
 */
function buildPosterSvg(params) {
  var nickname = escapeHtml(params.nickname || '宠物爱好者');
  var rewardedCount = params.rewardedCount || 0;
  var inviteCode = escapeHtml(params.inviteCode || '');
  var trialThreshold = INVITE_CONFIG.TRIAL_THRESHOLD || 3;

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">',
    // 背景渐变定义
    '<defs>',
    '  <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">',
    '    <stop offset="0%" style="stop-color:#667eea"/>',
    '    <stop offset="100%" style="stop-color:#764ba2"/>',
    '  </linearGradient>',
    '</defs>',
    // 背景
    '<rect width="600" height="800" fill="url(#bg)"/>',
    // 装饰圆形
    '<circle cx="520" cy="80" r="120" fill="rgba(255,255,255,0.06)"/>',
    '<circle cx="80" cy="650" r="100" fill="rgba(255,255,255,0.06)"/>',
    // App 标题
    '<text x="300" y="80" text-anchor="middle" fill="white" font-size="36" font-weight="bold" font-family="sans-serif">宠物症状自查</text>',
    // Slogan
    '<text x="300" y="130" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="28" font-family="sans-serif">守护爱宠健康，从一次自查开始</text>',
    // 推荐人信息
    '<text x="300" y="200" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="24" font-family="sans-serif">来自「' + nickname + '」的推荐</text>',
    // 统计信息
    '<text x="300" y="250" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="20" font-family="sans-serif">已成功邀请 ' + rewardedCount + ' 位好友</text>',
    // 分割线
    '<line x1="100" y1="290" x2="500" y2="290" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>',
    // 功能亮点
    '<text x="300" y="340" text-anchor="middle" fill="#ffd700" font-size="22" font-family="sans-serif">邀请好友，双方各得1次免费AI报告</text>',
    '<text x="300" y="380" text-anchor="middle" fill="#ffd700" font-size="22" font-family="sans-serif">邀请' + trialThreshold + '人，额外获得7天会员体验</text>',
    // 底部提示
    '<text x="300" y="620" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="18" font-family="sans-serif">打开微信搜索小程序「宠物症状自查」</text>',
    // 邀请码
    '<text x="300" y="720" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-size="16" font-family="sans-serif">邀请码: ' + inviteCode + '</text>',
    '</svg>'
  ].join('\n');
}

/**
 * 服务端生成分享海报
 * 返回 SVG 内容的 base64 编码，前端可直接用于 <image> 展示
 *
 * @returns {object} { posterBase64, inviteCode }
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    // 1. 获取用户信息
    var userResult = await db.collection(COLLECTIONS.USERS)
      .where({ user_id: openid })
      .limit(1)
      .get();

    var user = (userResult.data && userResult.data.length > 0) ? userResult.data[0] : {};
    var nickname = user.nickName || user.nickname || '宠物爱好者';

    // 2. 获取邀请统计（已成功邀请人数）
    var rewardedCount = 0;
    var statsResult = await db.collection(COLLECTIONS.INVITE_RECORDS)
      .where({ inviter_id: openid, status: 'rewarded' })
      .count();
    rewardedCount = statsResult.total || 0;

    // 3. 获取或创建邀请码
    var inviteCode = '';
    var existingInvite = await db.collection(COLLECTIONS.INVITE_RECORDS)
      .where({ inviter_id: openid, status: 'pending' })
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();

    if (existingInvite.data && existingInvite.data.length > 0) {
      inviteCode = existingInvite.data[0].invite_code;
    } else {
      // 创建新邀请码
      var crypto = require('crypto');
      inviteCode = crypto.randomBytes(8).toString('hex');
      var now = new Date();
      var expiresAt = new Date(now.getTime() + INVITE_CONFIG.EXPIRE_DAYS * 24 * 60 * 60 * 1000);
      await db.collection(COLLECTIONS.INVITE_RECORDS).add({
        data: {
          inviter_id: openid,
          invitee_id: '',
          invite_code: inviteCode,
          status: 'pending',
          expires_at: expiresAt,
          created_at: now,
          updated_at: now
        }
      });
    }

    // 4. 生成海报 SVG
    var svgContent = buildPosterSvg({
      nickname: nickname,
      rewardedCount: rewardedCount,
      inviteCode: inviteCode
    });

    // 5. Base64 编码
    var posterBase64 = 'data:image/svg+xml;base64,' + Buffer.from(svgContent, 'utf-8').toString('base64');

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '海报生成成功',
      data: {
        posterBase64: posterBase64,
        inviteCode: inviteCode
      }
    };

  } catch (error) {
    console.error('海报生成失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '海报生成失败', data: {} };
  }
};
