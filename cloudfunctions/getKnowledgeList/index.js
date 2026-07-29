// 云函数入口文件
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE , warmupConfig} = require('./common/constants');
const { cnDateStr } = require('./common/date-cn');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 获取知识文章列表
 * 支持按分类筛选和分页查询
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const { category, page = 1, pageSize = 10, featured, featuredDate } = event;

  try {
    // 1. 参数校验
    if (!OPENID) {
      return {
        code: RESPONSE_CODE.UNAUTHORIZED,
        msg: '用户未登录',
        data: {}
      };
    }

    // 2. 构建查询条件
    const query = {
      status: 'published'
    };
    if (category) {
      query.category = category;
    }
    // V1.5.5: featured 模式按当天 featured_date 精确查询（不再混用 sort_order 分页）
    if (featured) {
      query.featured_date = featuredDate || cnDateStr();
    }

    // 3. 查询总数
    const countResult = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .where(query)
      .count();

    const total = countResult.total;

    // 4. 分页查询（featured 按 featured_date 倒序，普通按 sort_order 正序）
    const skip = (page - 1) * pageSize;
    const result = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .where(query)
      .orderBy(featured ? 'featured_date' : 'sort_order', featured ? 'desc' : 'asc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 5. 格式化返回数据（同时提供 snake_case 和 camelCase 字段名）
    const articles = result.data.map(article => ({
      _id: article._id,
      title: article.title,
      category: article.category,
      target_pet: article.target_pet,
      petType: article.target_pet,
      summary: article.summary,
      cover_image: article.cover_image,
      coverImage: article.cover_image,
      view_count: article.view_count || 0,
      viewCount: article.view_count || 0,
      featured_date: article.featured_date || ''
    }));

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        articles: articles,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: (skip + pageSize) < total
      }
    };

  } catch (error) {
    console.error('获取知识文章列表失败:', error);
    console.error('[getKnowledgeList] 查询失败:', error.message);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {
      }
    };
  }
};
