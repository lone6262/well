/**
 * 删除食物安全记录（管理端）
 */
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { validateAdminRequest } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);

  const auth = validateAdminRequest(event);
  if (!auth.valid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: auth.error, data: {} };
  }

  const { foodId } = event;

  if (!foodId) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少 foodId', data: {} };
  }

  try {
    await db.collection('food_safety').doc(foodId).remove();
    console.log('[adminDeleteFood] 删除成功:', foodId);
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '删除成功',
      data: {}
    };
  } catch (error) {
    console.error('[adminDeleteFood] 删除失败:', error);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '删除失败', data: {} };
  }
};
