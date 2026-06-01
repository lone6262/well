// 云函数入口文件
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE } = require('./constants');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 删除宠物信息
 */
exports.main = async (event, context) => {
  const { openid, petId } = event;

  try {
    // 1. 参数校验
    if (!openid) {
      return {
        code: RESPONSE_CODE.UNAUTHORIZED,
        msg: '用户未登录',
        data: {}
      };
    }

    if (!petId) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '宠物ID不能为空',
        data: {}
      };
    }

    // 2. 查询宠物信息验证权限
    const petResult = await db.collection(COLLECTIONS.PETS).doc(petId).get();

    if (!petResult.data || petResult.data.length === 0) {
      return {
        code: RESPONSE_CODE.NOT_FOUND,
        msg: '宠物信息不存在',
        data: {}
      };
    }

    // 3. 验证宠物是否属于当前用户
    if (petResult.data.user_id !== openid) {
      return {
        code: RESPONSE_CODE.UNAUTHORIZED,
        msg: '无权删除此宠物信息',
        data: {}
      };
    }

    // 4. 删除相关的症状记录（级联删除）
    try {
      const symptomRecordsResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS)
        .where({
          pet_id: petId
        })
        .remove();

      console.log(`删除宠物 ${petId} 的 ${symptomRecordsResult.stats.removed} 条症状记录`);
    } catch (symptomError) {
      console.error('删除症状记录失败:', symptomError);
      // 症状记录删除失败不影响主流程，继续执行
    }

    // 5. 删除宠物信息
    await db.collection(COLLECTIONS.PETS).doc(petId).remove();

    console.log(`宠物 ${petId} 删除成功`);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '删除成功',
      data: {
        petId: petId,
        deleted: true
      }
    };

  } catch (error) {
    console.error('删除宠物信息失败:', error);

    // 处理数据库特定错误
    if (error.errCode === -1) {
      return {
        code: RESPONSE_CODE.SERVER_ERROR,
        msg: '数据库连接失败，请稍后重试',
        data: {
          error: error.message
        }
      };
    }

    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {
        error: error.message
      }
    };
  }
};