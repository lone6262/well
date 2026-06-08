/**
 * 更新系统配置云函数（管理端）
 * 用于修改价格、额度等系统配置
 *
 * 警告：此函数允许修改核心业务配置，请谨慎使用
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  warmupConfig
} = require('./common/constants');
const { validateAdminRequest } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 驼峰转下划线
 */
function camelToSnake(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * 更新系统配置
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  console.log('[adminUpdateConfig] 更新系统配置请求');

  // 验证管理员权限
  const auth = validateAdminRequest(event);
  if (!auth.valid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: auth.error,
      data: {}
    };
  }

  const { updates } = event;

  if (!updates || typeof updates !== 'object') {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '无效的更新数据',
      data: {}
    };
  }

  try {
    const updateResults = [];

    // 遍历更新项
    for (const [key, value] of Object.entries(updates)) {
      // 转换 key 为数据库格式（下划线）
      const dbKey = camelToSnake(key);

      // 查找是否已存在该配置
      const existing = await db.collection(COLLECTIONS.SYSTEM_CONFIG)
        .where({ key: dbKey })
        .get();

      if (existing.data && existing.data.length > 0) {
        // 更新现有配置
        await db.collection(COLLECTIONS.SYSTEM_CONFIG)
          .doc(existing.data[0]._id)
          .update({
            data: {
              value: String(value),
              updated_at: new Date()
            }
          });

        updateResults.push({
          key: dbKey,
          action: 'updated',
          oldValue: existing.data[0].value,
          newValue: String(value)
        });

        console.log(`[adminUpdateConfig] 更新配置: ${dbKey} = ${value}`);

      } else {
        // 创建新配置
        await db.collection(COLLECTIONS.SYSTEM_CONFIG)
          .add({
            data: {
              key: dbKey,
              value: String(value),
              created_at: new Date(),
              updated_at: new Date()
            }
          });

        updateResults.push({
          key: dbKey,
          action: 'created',
          newValue: String(value)
        });

        console.log(`[adminUpdateConfig] 创建配置: ${dbKey} = ${value}`);
      }
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '配置更新成功',
      data: {
        updated: updateResults.length,
        changes: updateResults
      }
    };

  } catch (error) {
    console.error('[adminUpdateConfig] 更新失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '更新失败，请稍后重试',
      data: {}
    };
  }
};
