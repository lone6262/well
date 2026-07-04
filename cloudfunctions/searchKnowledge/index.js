// 云函数入口文件
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, warmupConfig } = require('./common/constants');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 搜索知识文章
 * 支持标题和摘要的模糊搜索
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const { keyword, page = 1, pageSize = 10 } = event;

  try {
    // 1. 参数校验
    if (!OPENID) {
      return {
        code: RESPONSE_CODE.UNAUTHORIZED,
        msg: '用户未登录',
        data: {}
      };
    }

    if (!keyword || keyword.trim().length === 0) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '请输入搜索关键词',
        data: {}
      };
    }

    // 2. 构建搜索条件
    // 使用正则表达式进行模糊搜索
    const searchRegex = new RegExp(keyword, 'i');
    const query = {
      status: 'published',
      $or: [
        { title: db.RegExp({ regexp: keyword, options: 'i' }) },
        { summary: db.RegExp({ regexp: keyword, options: 'i' }) }
      ]
    };

    // 3. 查询总数
    const countResult = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .where(query)
      .count();

    const total = countResult.total;

    // 4. 分页查询
    const skip = (page - 1) * pageSize;
    const result = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .where(query)
      .orderBy('view_count', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 5. 格式化返回数据
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
      member_only: article.member_only || false,
      memberOnly: article.member_only || false
    }));

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '搜索成功',
      data: {
        articles: articles,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: (skip + pageSize) < total
      }
    };

  } catch (error) {
    console.error('搜索知识文章失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {}
    };
  }
};
