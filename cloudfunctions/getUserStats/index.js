// 云函数入口文件
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE } = require('./constants');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 获取用户统计数据
 * 统计用户的症状自查次数、问诊报告数、宠物数量、订单数和收藏数
 */
exports.main = async (event) => {
  const { openid } = event;

  if (!openid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: '缺少用户openid'
    };
  }

  try {
    // 并行查询各项统计数据
    const [petsResult, recordsResult, ordersResult] = await Promise.all([
      db.collection(COLLECTIONS.PETS).where({
        user_id: openid
      }).count(),

      db.collection(COLLECTIONS.SYMPTOM_RECORDS).where({
        user_id: openid
      }).count(),

      db.collection(COLLECTIONS.ORDERS).where({
        user_id: openid
      }).count()
    ]);

    const stats = {
      checkCount: recordsResult.total || 0,      // 症状自查次数
      reportCount: recordsResult.total || 0,     // 问诊报告数（暂与自查次数相同）
      petCount: petsResult.total || 0,           // 宠物数量
      orderCount: ordersResult.total || 0,        // 订单数量
      favoriteCount: 0                            // 收藏数量（需要时扩展）
    };

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: stats
    };

  } catch (error) {
    console.error('获取用户统计数据失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '获取统计数据失败',
      error: error.message
    };
  }
};
