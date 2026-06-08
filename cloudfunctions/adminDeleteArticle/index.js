/**
 * 删除知识文章云函数（管理端）
 * 支持软删除（归档）和硬删除
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  ARTICLE_STATUS,
  warmupConfig
} = require('./common/constants');
const { validateAdminRequest } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 删除文章
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  console.log('[adminDeleteArticle] 删除文章请求');

  // 验证管理员权限
  const auth = validateAdminRequest(event);
  if (!auth.valid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: auth.error,
      data: {}
    };
  }

  const { articleId, hardDelete = false } = event;

  if (!articleId) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '文章ID不能为空',
      data: {}
    };
  }

  try {
    // 查询文章是否存在
    const articleResult = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .doc(articleId)
      .get();

    if (!articleResult.data) {
      return {
        code: RESPONSE_CODE.NOT_FOUND,
        msg: '文章不存在',
        data: {}
      };
    }

    if (hardDelete) {
      // 硬删除：直接从数据库删除
      await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
        .doc(articleId)
        .remove();

      console.log(`[adminDeleteArticle] 文章 ${articleId} 已硬删除`);

      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '文章已删除',
        data: {
          deletedId: articleId,
          deleteType: 'hard'
        }
      };

    } else {
      // 软删除：状态改为 archived
      await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
        .doc(articleId)
        .update({
          data: {
            status: ARTICLE_STATUS.ARCHIVED,
            updated_at: new Date()
          }
        });

      console.log(`[adminDeleteArticle] 文章 ${articleId} 已归档`);

      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '文章已归档',
        data: {
          deletedId: articleId,
          deleteType: 'soft',
          previousStatus: articleResult.data.status
        }
      };
    }

  } catch (error) {
    console.error('[adminDeleteArticle] 删除失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '删除失败，请稍后重试',
      data: {}
    };
  }
};
