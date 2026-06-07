// 云函数入口文件
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE , warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { logAuditEvent } = require('./common/audit-logger');
const { createLogger } = require('./common/logger');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const logger = createLogger('deletePet');

/**
 * 删除宠物信息
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { petId, token } = event;
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  // Token 验证（删除操作需验证身份）
  if (!verifyToken(token)) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: '身份验证失败，请重新登录',
      data: {}
    };
  }

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

    // doc().get() 返回 {data: 文档对象}，非数组，统一提取文档
    const petData = Array.isArray(petResult.data) ? petResult.data[0] : petResult.data;

    if (!petData) {
      return {
        code: RESPONSE_CODE.NOT_FOUND,
        msg: '宠物信息不存在',
        data: {}
      };
    }

    // 3. 验证宠物是否属于当前用户
    if (petData.user_id !== openid) {
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

      logger.info(`删除宠物 ${petId} 的 ${symptomRecordsResult.stats.removed} 条症状记录`);
    } catch (symptomError) {
      logger.error('删除症状记录失败:', symptomError);
      // 症状记录删除失败不影响主流程，继续执行
    }

    // 5. 删除宠物信息
    await db.collection(COLLECTIONS.PETS).doc(petId).remove();

    // 6. 记录审计日志
    await logAuditEvent(db, openid, 'delete_pet', { petId: petId });

    logger.info(`宠物 ${petId} 删除成功`);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '删除成功',
      data: {
        petId: petId,
        deleted: true
      }
    };

  } catch (error) {
    logger.error('删除宠物信息失败:', error);

    // 处理数据库特定错误
    if (error.errCode === -1) {
      return {
        code: RESPONSE_CODE.SERVER_ERROR,
        msg: '数据库连接失败，请稍后重试',
        data: {}
      };
    }

    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {}
    };
  }
};
