/**
 * 获取知识文章列表云函数（管理端）
 * 支持分页、分类过滤、状态过滤
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  ARTICLE_STATUS,
  KNOWLEDGE_CATEGORIES,
  warmupConfig
} = require('./common/constants');
const { validateAdminRequest } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 默认分页参数
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * 获取文章列表
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  console.log('[adminGetArticles] 获取文章列表请求');

  // 验证管理员权限
  const auth = validateAdminRequest(event);
  if (!auth.valid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: auth.error,
      data: {}
    };
  }

  const {
    page = DEFAULT_PAGE,
    pageSize = DEFAULT_PAGE_SIZE,
    category = 'all', // all/digestive/respiratory/behavior/prevention/care
    status = 'all' // all/draft/published/archived
  } = event;

  try {
    // 限制分页大小
    const actualPageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const skip = (page - 1) * actualPageSize;

    // 构建查询条件
    let whereCondition = {};

    // 分类过滤
    if (category && category !== 'all') {
      whereCondition.category = category;
    }

    // 状态过滤
    if (status && status !== 'all') {
      whereCondition.status = status;
    }

    console.log('[adminGetArticles] 查询条件:', JSON.stringify(whereCondition));

    // 查询文章列表
    const articlesResult = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(actualPageSize)
      .get();

    // 查询总数
    const countResult = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .where(whereCondition)
      .count();

    // 计算总页数
    const total = countResult.total || 0;
    const totalPages = Math.ceil(total / actualPageSize);

    console.log(`[adminGetArticles] 返回 ${articlesResult.data.length} 条文章记录，总计 ${total} 条`);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        articles: articlesResult.data,
        pagination: {
          page: page,
          pageSize: actualPageSize,
          total: total,
          totalPages: totalPages
        },
        categories: KNOWLEDGE_CATEGORIES,
        statuses: ARTICLE_STATUS
      }
    };

  } catch (error) {
    console.error('[adminGetArticles] 查询失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '查询失败，请稍后重试',
      data: {}
    };
  }
};
