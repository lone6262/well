// 获取食物分类列表
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);

  try {
    // 从 food_safety 集合获取所有已发布记录的 category 字段
    const result = await db.collection('food_safety')
      .where({ status: 'published' })
      .field({ category: true })
      .limit(100)
      .get();

    // 去重
    const categories = [];
    const seen = {};
    result.data.forEach(function(item) {
      if (item.category && !seen[item.category]) {
        seen[item.category] = true;
        categories.push(item.category);
      }
    });

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: { categories: categories }
    };
  } catch (error) {
    console.error('[getFoodCategories] 失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '获取失败',
      data: { categories: [] }
    };
  }
};
