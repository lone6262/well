// 食物安全查询云函数
// 搜索 food_safety 集合，支持关键词模糊匹配和分类过滤
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { keyword, category, page = 1, pageSize = 20 } = event;

  try {
    // 构建查询条件
    let query = { status: 'published' };

    // 关键词搜索：匹配 name 和 aliases
    if (keyword && keyword.trim()) {
      const reg = db.RegExp({ regexp: keyword.trim(), options: 'i' });
      query = {
        status: 'published',
        db_RegExp_name: reg
      };
      // 云数据库不支持  直接写，用复合条件
      // 先按 name 搜索，如果没有结果再按 aliases 搜索
    }

    // 分类过滤
    if (category && category !== '') {
      query.category = category;
    }

    let results = [];

    // 关键词搜索：先搜 name
    if (keyword && keyword.trim()) {
      const reg = db.RegExp({ regexp: keyword.trim(), options: 'i' });
      const nameQuery = { status: 'published', name: reg };
      if (category) nameQuery.category = category;
      
      const nameResult = await db.collection('food_safety')
        .where(nameQuery)
        .orderBy('severity', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();
      
      results = nameResult.data;

      // 如果 name 没搜到，搜 aliases
      if (results.length === 0) {
        const aliasQuery = { status: 'published', aliases: reg };
        if (category) aliasQuery.category = category;
        
        const aliasResult = await db.collection('food_safety')
          .where(aliasQuery)
          .orderBy('severity', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get();
        
        results = aliasResult.data;
      }
    } else {
      // 无关键词：按分类或全部
      const countResult = await db.collection('food_safety')
        .where(query)
        .count();
      
      const dataResult = await db.collection('food_safety')
        .where(query)
        .orderBy('severity', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();
      
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
      data: { foods: foods, total: foods.length }
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
