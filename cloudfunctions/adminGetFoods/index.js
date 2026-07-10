/**
 * 获取食物安全列表（管理端）
 * 支持分页、分类过滤、状态过滤、关键词搜索
 */
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { validateAdminRequest } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);

  const auth = validateAdminRequest(event);
  if (!auth.valid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: auth.error, data: {} };
  }

  const { page = 1, pageSize = 20, category = 'all', status = 'all', keyword = '' } = event;

  try {
    let whereCondition = {};

    if (category && category !== 'all') {
      whereCondition.category = category;
    }
    if (status && status !== 'all') {
      whereCondition.status = status;
    }
    if (keyword && keyword.trim()) {
      whereCondition.name = db.RegExp({ regexp: keyword.trim(), options: 'i' });
    }

    const skip = (page - 1) * pageSize;
    const actualPageSize = Math.min(pageSize, 100);

    const dataResult = await db.collection('food_safety')
      .where(whereCondition)
      .orderBy('severity', 'desc')
      .skip(skip)
      .limit(actualPageSize)
      .get();

    const countResult = await db.collection('food_safety')
      .where(whereCondition)
      .count();

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        foods: dataResult.data,
        pagination: {
          page: page,
          pageSize: actualPageSize,
          total: countResult.total || 0,
          totalPages: Math.ceil((countResult.total || 0) / actualPageSize)
        }
      }
    };
  } catch (error) {
    console.error('[adminGetFoods] 查询失败:', error);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询失败', data: {} };
  }
};
