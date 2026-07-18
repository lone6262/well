// 获取食物分类列表
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { checkRateLimit } = require('./common/rate-limiter');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);

  const { token } = event;

  // 1. Token 鉴权
  if (!verifyToken(token)) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: '身份验证失败，请重新登录',
      data: { categories: [] },
    };
  }

  // 2. 速率限制（读操作：限流故障时放行）
  const { OPENID } = cloud.getWXContext();
  if (!(await checkRateLimit(db, OPENID, 'getFoodCategories', 30, 60000, true))) {
    return { code: RESPONSE_CODE.ERROR, msg: '操作过于频繁，请稍后再试', data: { categories: [] } };
  }

  try {
    // 从 food_safety 集合获取所有已发布记录的 category 字段
    const result = await db
      .collection('food_safety')
      .where({ status: 'published' })
      .field({ category: true })
      .limit(100)
      .get();

    // 去重
    const categories = [];
    const seen = {};
    result.data.forEach(function (item) {
      if (item.category && !seen[item.category]) {
        seen[item.category] = true;
        categories.push(item.category);
      }
    });

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: { categories: categories },
    };
  } catch (error) {
    console.error('[getFoodCategories] 失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '获取失败',
      data: { categories: [] },
    };
  }
};
