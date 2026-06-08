/**
 * 保存知识文章云函数（管理端）
 * 支持创建新文章和更新现有文章
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

/**
 * 保存文章
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  console.log('[adminSaveArticle] 保存文章请求');

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
    articleId, // 留空表示新建
    title,
    category,
    targetPet = 'all',
    summary,
    content,
    coverImage,
    relatedSymptoms = [],
    sortOrder = 0,
    status = 'draft'
  } = event;

  // 参数校验
  if (!title || title.trim().length === 0) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '文章标题不能为空',
      data: {}
    };
  }

  if (!category || !Object.values(KNOWLEDGE_CATEGORIES).includes(category)) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '无效的文章分类',
      data: {}
    };
  }

  if (!content || content.trim().length === 0) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '文章内容不能为空',
      data: {}
    };
  }

  if (!Object.values(ARTICLE_STATUS).includes(status)) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '无效的文章状态',
      data: {}
    };
  }

  try {
    const now = new Date();
    let result;

    if (articleId) {
      // 更新现有文章
      const updateData = {
        title: title.trim(),
        category,
        target_pet: targetPet,
        summary: summary ? summary.trim() : '',
        content: content.trim(),
        cover_image: coverImage || '',
        related_symptoms: relatedSymptoms,
        sort_order: parseInt(sortOrder) || 0,
        status,
        updated_at: now
      };

      // 如果状态从非发布变为发布，设置发布时间
      const existingArticle = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
        .doc(articleId)
        .get();

      if (!existingArticle.data) {
        return {
          code: RESPONSE_CODE.NOT_FOUND,
          msg: '文章不存在',
          data: {}
        };
      }

      if (existingArticle.data.status !== 'published' && status === 'published') {
        updateData.published_at = now;
      }

      await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
        .doc(articleId)
        .update({ data: updateData });

      result = {
        _id: articleId,
        ...updateData
      };

      console.log(`[adminSaveArticle] 文章 ${articleId} 更新成功`);

    } else {
      // 创建新文章
      const articleData = {
        title: title.trim(),
        category,
        target_pet: targetPet,
        summary: summary ? summary.trim() : '',
        content: content.trim(),
        cover_image: coverImage || '',
        related_symptoms: relatedSymptoms,
        sort_order: parseInt(sortOrder) || 0,
        view_count: 0,
        status,
        published_at: status === 'published' ? now : null,
        created_at: now,
        updated_at: now
      };

      const addResult = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
        .add({ data: articleData });

      result = {
        _id: addResult._id,
        ...articleData
      };

      console.log(`[adminSaveArticle] 新文章 ${addResult._id} 创建成功`);
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: articleId ? '更新成功' : '创建成功',
      data: {
        article: result
      }
    };

  } catch (error) {
    console.error('[adminSaveArticle] 保存失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '保存失败，请稍后重试',
      data: {}
    };
  }
};
