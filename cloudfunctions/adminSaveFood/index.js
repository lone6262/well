/**
 * 保存食物安全记录（管理端）
 * 支持新建和更新
 */
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, warmupConfig, SAFETY_LEVELS } = require('./common/constants');
const { validateAdminRequest } = require('./common/admin-auth');

const VALID_SAFETY_LEVELS = Object.values(SAFETY_LEVELS);

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);

  const auth = validateAdminRequest(event);
  if (!auth.valid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: auth.error, data: {} };
  }

  const {
    foodId,
    name,
    category,
    aliases = [],
    cat_safety = SAFETY_LEVELS.CAUTION,
    dog_safety = SAFETY_LEVELS.CAUTION,
    effect = '',
    alternative = '',
    severity = 1,
    status = 'published'
  } = event;

  // 参数校验
  if (!name || name.trim().length === 0) {
    return { code: RESPONSE_CODE.ERROR, msg: '食物名称不能为空', data: {} };
  }

  if (!VALID_SAFETY_LEVELS.includes(cat_safety) || !VALID_SAFETY_LEVELS.includes(dog_safety)) {
    return { code: RESPONSE_CODE.ERROR, msg: '安全等级必须是 safe/caution/danger', data: {} };
  }

  const foodData = {
    name: name.trim(),
    category: category || '其他',
    aliases: Array.isArray(aliases) ? aliases : [],
    cat_safety: cat_safety,
    dog_safety: dog_safety,
    effect: effect,
    alternative: alternative,
    severity: parseInt(severity) || 1,
    status: status,
    updated_at: new Date()
  };

  try {
    if (foodId) {
      // 更新
      const result = await db.collection('food_safety').doc(foodId).update({ data: foodData });
      console.log('[adminSaveFood] 更新成功:', foodId);
      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '更新成功',
        data: { foodId: foodId }
      };
    } else {
      // 新建
      foodData.created_at = new Date();
      foodData.view_count = 0;
      const result = await db.collection('food_safety').add({ data: foodData });
      console.log('[adminSaveFood] 新建成功:', result._id);
      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '创建成功',
        data: { foodId: result._id }
      };
    }
  } catch (error) {
    console.error('[adminSaveFood] 保存失败:', error);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '保存失败', data: {} };
  }
};
