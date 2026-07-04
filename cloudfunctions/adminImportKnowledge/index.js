// 云函数：adminImportKnowledge
// 功能：批量导入知识文章到小程序数据库
// 调用方：管理后台 / 管理员脚本

const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE } = require('./common/constants');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 分类名称映射（用于显示）
 */
const CATEGORY_NAMES = {
  'digestive': '消化系统',
  'respiratory': '呼吸系统',
  'behavior': '行为异常',
  'prevention': '预防保健',
  'care': '特殊阶段'
};

/**
 * 验证文章数据格式
 */
function validateArticle(article) {
  const errors = [];

  if (!article.title || article.title.trim().length === 0) {
    errors.push('缺少标题');
  }

  if (!article.content || article.content.trim().length === 0) {
    errors.push('缺少内容');
  }

  if (!article.category || !CATEGORY_NAMES[article.category]) {
    errors.push(`无效的分类: ${article.category}`);
  }

  if (!['cat', 'dog', 'all'].includes(article.target_pet)) {
    errors.push(`无效的宠物类型: ${article.target_pet}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 检查文章是否已存在（根据标题）
 */
async function checkDuplicate(title) {
  try {
    const result = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES)
      .where({
        title: title
      })
      .count();

    return result.total > 0;
  } catch (error) {
    console.error('检查重复失败:', error);
    return false;
  }
}

/**
 * 导入单篇文章
 */
async function importArticle(article, force = false) {
  try {
    // 验证数据
    const validation = validateArticle(article);
    if (!validation.valid) {
      return {
        success: false,
        title: article.title || '未知',
        error: validation.errors.join(', ')
      };
    }

    // 检查重复
    if (!force) {
      const isDuplicate = await checkDuplicate(article.title);
      if (isDuplicate) {
        return {
          success: false,
          title: article.title,
          error: '文章已存在',
          skipped: true
        };
      }
    }

    // 准备文档数据
    const doc = {
      title: article.title,
      category: article.category,
      target_pet: article.target_pet,
      summary: article.summary || '',
      content: article.content,
      cover_image: article.cover_image || '',
      status: article.status || 'published',
      view_count: article.view_count || 0,
      sort_order: article.sort_order || 0,
      member_only: article.member_only || false,
      publish_time: article.publish_time || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 保留元数据
    if (article.metadata) {
      doc.metadata = article.metadata;
    }

    // 插入数据库
    const result = await db.collection(COLLECTIONS.KNOWLEDGE_ARTICLES).add({
      data: doc
    });

    return {
      success: true,
      title: article.title,
      id: result.id
    };

  } catch (error) {
    console.error('导入文章失败:', error);
    return {
      success: false,
      title: article.title || '未知',
      error: error.message
    };
  }
}

/**
 * 云函数入口
 */
exports.main = async (event, context) => {
  const { action, articles, force = false } = event;

  try {
    switch (action) {
      case 'import':
        // 批量导入
        if (!Array.isArray(articles)) {
          return {
            code: RESPONSE_CODE.ERROR,
            msg: '参数错误：articles 必须是数组',
            data: {}
          };
        }

        const results = {
          total: articles.length,
          success: 0,
          failed: 0,
          skipped: 0,
          details: []
        };

        for (const article of articles) {
          const result = await importArticle(article, force);

          if (result.success) {
            results.success++;
          } else if (result.skipped) {
            results.skipped++;
          } else {
            results.failed++;
          }

          results.details.push(result);
        }

        return {
          code: RESPONSE_CODE.SUCCESS,
          msg: '导入完成',
          data: results
        };

      case 'validate':
        // 仅验证，不导入
        const validationResults = articles.map(article => {
          const validation = validateArticle(article);
          return {
            title: article.title,
            valid: validation.valid,
            errors: validation.errors
          };
        });

        return {
          code: RESPONSE_CODE.SUCCESS,
          msg: '验证完成',
          data: {
            total: articles.length,
            valid: validationResults.filter(r => r.valid).length,
            invalid: validationResults.filter(r => !r.valid).length,
            details: validationResults
          }
        };

      case 'check':
        // 检查重复
        const duplicateCheck = await Promise.all(
          articles.map(async (article) => {
            const isDuplicate = await checkDuplicate(article.title);
            return {
              title: article.title,
              exists: isDuplicate
            };
          })
        );

        return {
          code: RESPONSE_CODE.SUCCESS,
          msg: '检查完成',
          data: {
            total: articles.length,
            duplicates: duplicateCheck.filter(r => r.exists).length,
            details: duplicateCheck
          }
        };

      default:
        return {
          code: RESPONSE_CODE.ERROR,
          msg: '未知操作',
          data: {}
        };
    }

  } catch (error) {
    console.error('云函数执行失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: error.message,
      data: {}
    };
  }
};
