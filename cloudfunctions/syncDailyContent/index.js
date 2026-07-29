/**
 * syncDailyContent — 内容工厂推送当日文章到小程序首页
 *
 * 鉴权：独立机器 token（{ts}.{hmac}，密钥 CONTENT_PUSH_SECRET），
 * 不复用终端用户 verifyToken（那是 3 段 JWT）。由 scripts/push_daily_content.py HTTP 调用。
 */
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { COLLECTIONS, RESPONSE_CODE, SERVER_CONFIG, warmupConfig } = require('./common/constants');
const { createLogger } = require('./common/logger');
const { cnDateStr } = require('./common/date-cn');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const logger = createLogger('syncDailyContent');

const DEFAULT_COVER =
  'https://well-tools-d8gwhxdlcf84937ed-1435021389.tcloudbaseapp.com/knowledge-covers/default.jpg';

// === 独立机器鉴权（与终端用户 TOKEN_SECRET 物理隔离）===
function getMachineSecret() {
  const s = SERVER_CONFIG.CONTENT_PUSH_SECRET;
  if (!s) throw new Error('[syncDailyContent] CONTENT_PUSH_SECRET 未配置');
  return s;
}

// token 格式：{秒级时间戳}.{hmac_sha256(secret, 时间戳)}，5 分钟窗口防重放
function verifyMachineToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const ts = Number(parts[0]);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;
  const expected = crypto.createHmac('sha256', getMachineSecret()).update(parts[0]).digest('hex');
  const a = Buffer.from(parts[1], 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

exports.main = async (event, context) => {
  await warmupConfig(db);

  const token =
    event.token ||
    (event.headers && (event.headers['x-machine-token'] || event.headers['X-Machine-Token']));
  if (!verifyMachineToken(token)) {
    logger.warn('机器鉴权失败');
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }

  const { title, summary, content, cover_url, category, target_pet } = event;
  if (!title || !content) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少标题或内容', data: {} };
  }

  const today = cnDateStr();

  try {
    // 查是否已有同标题文章
    const existing = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .where({ title }).limit(1).get();

    if (existing.data.length > 0) {
      const id = existing.data[0]._id;
      const cur = existing.data[0];
      await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES).doc(id).update({
        data: {
          featured_date: today,
          summary: summary || cur.summary,
          content: content || cur.content,
          cover_image: cover_url || cur.cover_image,
          updated_at: new Date()
        }
      });
      return { code: RESPONSE_CODE.SUCCESS, msg: '已更新为今日推荐', data: { article_id: id } };
    }

    // 新增
    const result = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES).add({
      data: {
        title,
        summary: summary || '',
        content,
        cover_image: cover_url || DEFAULT_COVER,
        category: category || 'digestive',
        target_pet: target_pet || 'all',
        petType: target_pet || 'all',
        status: 'published',
        featured_date: today,
        sort_order: 999,
        view_count: 0,
        viewCount: 0,
        member_only: false,
        publishedAt: new Date()
      }
    });
    return { code: RESPONSE_CODE.SUCCESS, msg: '新增成功', data: { article_id: result._id } };
  } catch (err) {
    logger.error('syncDailyContent 失败: ' + err.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: err.message, data: {} };
  }
};
