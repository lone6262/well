// 食物安全查询云函数
// 搜索 food_safety 集合，支持关键词模糊匹配和分类过滤
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { authenticate } = require('./common/auth');
const { checkRateLimit } = require('./common/rate-limiter');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 转义正则元字符，防止用户输入导致正则注入 / ReDoS
function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.main = async (event, context) => {
  await warmupConfig(db);

  const { keyword, category, page = 1, pageSize = 20, token } = event;

  // 1. Token 鉴权（C-1 修复：交叉校验 openid，防止跨用户 Token 重放）
  const authResult = authenticate(event, context);
  if (!authResult.valid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败，请重新登录', data: {} };
  }

  // 2. 速率限制（读操作：限流故障时放行）
  const { OPENID } = cloud.getWXContext();
  if (!await checkRateLimit(db, OPENID, 'searchFoodSafety', 20, 60000, true)) {
    return { code: RESPONSE_CODE.ERROR, msg: '操作过于频繁，请稍后再试', data: {} };
  }

  try {
    const pageNum = Math.min(500, Math.max(1, parseInt(page, 10) || 1));
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    // C-3 修复：category 参数类型校验（防 NoSQL 操作符注入）
    const hasCategory = category && category !== '';
    if (hasCategory && typeof category !== 'string') {
      return { code: RESPONSE_CODE.ERROR, msg: '参数错误', data: {} };
    }

    let results = [];
    let total = 0;

    if (keyword && keyword.trim()) {
      // 关键词搜索：匹配 name 或 aliases（OR 合并，保证 total 与分页准确）
      const reg = db.RegExp({ regexp: escapeRegExp(keyword.trim().slice(0, 50)), options: 'i' });
      const conditions = [{ status: 'published' }, _.or([{ name: reg }, { aliases: reg }])];
      if (hasCategory) conditions.push({ category: category });
      const kwQuery = _.and(conditions);

      const countResult = await db.collection(COLLECTIONS.FOOD_SAFETY).where(kwQuery).count();
      const dataResult = await db.collection(COLLECTIONS.FOOD_SAFETY)
        .where(kwQuery)
        .orderBy('severity', 'desc')
        .skip((pageNum - 1) * size)
        .limit(size)
        .get();

      total = countResult.total;
      results = dataResult.data;
    } else {
      // 无关键词：按分类或全部
      const query = hasCategory
        ? { status: 'published', category: category }
        : { status: 'published' };

      const countResult = await db.collection(COLLECTIONS.FOOD_SAFETY).where(query).count();
      const dataResult = await db.collection(COLLECTIONS.FOOD_SAFETY)
        .where(query)
        .orderBy('severity', 'desc')
        .skip((pageNum - 1) * size)
        .limit(size)
        .get();

      total = countResult.total;
      results = dataResult.data;
    }

    // 格式化结果
    const foods = results.map(function(item) {
      return {
        _id: item._id,
        name: item.name,
        category: item.category,
        cat_safety: item.cat_safety,
        dog_safety: item.dog_safety,
        effect: item.effect,
        alternative: item.alternative || '',
        severity: item.severity || 1
      };
    });

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '搜索成功',
      data: { foods: foods, total: total }
    };

  } catch (error) {
    console.error('[searchFoodSafety] 查询失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '查询失败，请稍后重试',
      data: {}
    };
  }
};
