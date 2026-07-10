/**
 * 获取错误日志列表（管理端，只读）
 * 读取 error_logs 集合，支持分页、来源(function)过滤、关键词搜索
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

  const { page = 1, pageSize = 20, func = '', keyword = '' } = event;

  try {
    let whereCondition = {};

    if (func) {
      whereCondition.function = func;
    }
    if (keyword && keyword.trim()) {
      // 在错误信息或页面路径中搜索
      whereCondition.error_message = db.RegExp({ regexp: keyword.trim(), options: 'i' });
    }

    const skip = (page - 1) * pageSize;
    const actualPageSize = Math.min(pageSize, 100);

    const dataResult = await db.collection('error_logs')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(actualPageSize)
      .get();

    const countResult = await db.collection('error_logs')
      .where(whereCondition)
      .count();

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        logs: dataResult.data,
        pagination: {
          page: page,
          pageSize: actualPageSize,
          total: countResult.total || 0,
          totalPages: Math.ceil((countResult.total || 0) / actualPageSize)
        }
      }
    };
  } catch (error) {
    console.error('[adminGetErrorLogs] 查询失败:', error);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询失败', data: {} };
  }
};
