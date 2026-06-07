// 云函数入口文件
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE , warmupConfig} = require('./common/constants');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 获取知识文章详情
 * 根据文章ID查询单篇文章，并原子性递增浏览次数
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const { articleId } = event;

  try {
    // 1. 参数校验
    if (!OPENID) {
      return {
        code: RESPONSE_CODE.UNAUTHORIZED,
        msg: '用户未登录',
        data: {}
      };
    }

    if (!articleId) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '缺少文章ID',
        data: {}
      };
    }

    // 2. 查询文章详情
    const result = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .doc(articleId)
      .get();

    const article = result.data;

    // 3. 原子性递增浏览次数
    await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .doc(articleId)
      .update({
        data: {
          view_count: db.command.inc(1)
        }
      });

    // 返回时使用递增后的值
    article.view_count = (article.view_count || 0) + 1;

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        article
      }
    };

  } catch (error) {
    console.error('获取知识文章详情失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {
        error: error.message
      }
    };
  }
};
