// 云函数入口文件
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE , warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { createLogger } = require('./common/logger');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const logger = createLogger('getRecordDetail');

/**
 * 获取评估详情（包含宠物信息）
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { assessmentId, token } = event;
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  // Token 验证
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败，请重新登录', data: {} };
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

    if (!assessmentId) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '评估ID不能为空',
        data: {}
      };
    }

    // 2. 查询评估详情
    const recordResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS).doc(assessmentId).get();

    if (!recordResult.data || Object.keys(recordResult.data).length === 0) {
      return {
        code: RESPONSE_CODE.NOT_FOUND,
        msg: '评估记录不存在',
        data: {}
      };
    }

    // 3. 验证评估记录是否属于当前用户
    if (recordResult.data.user_id !== openid) {
      return {
        code: RESPONSE_CODE.UNAUTHORIZED,
        msg: '无权查看此评估记录',
        data: {}
      };
    }

    const recordData = recordResult.data;

    // 4. 查询关联的宠物信息（统一使用_id）
    let petData = null;
    if (recordData.pet_id) {
      try {
        const petResult = await db.collection(COLLECTIONS.PETS).doc(recordData.pet_id).get();

        // 验证宠物是否属于当前用户
        if (petResult.data && petResult.data.user_id === openid) {
          petData = {
            _id: petResult.data._id,
            name: petResult.data.name,
            type: petResult.data.type,
            breed: petResult.data.breed,
            age: petResult.data.age,
            weight: petResult.data.weight,
            gender: petResult.data.gender,
            vaccineDate: petResult.data.vaccine_date,
            dewormDate: petResult.data.deworm_date,
            avatar: petResult.data.avatar || ''
          };
        }
      } catch (petError) {
        logger.error('查询宠物信息失败:', petError);
        // 宠物信息查询失败不影响主流程
      }
    }

    // 5. 格式化返回数据（统一使用_id）
    const responseData = {
      assessmentDetail: {
        _id: recordData._id,
        pet_id: recordData.pet_id,
        user_id: recordData.user_id,
        symptoms: recordData.symptoms || [],           // 英文ID（用于规则引擎）
        symptom_names: recordData.symptom_names || recordData.symptoms || [],  // 中文名称（用于显示）
        riskLevel: recordData.risk_level,
        matchedRule: recordData.matched_rule || '',
        assessmentDate: recordData.created_at,
        aiCacheId: recordData.ai_report_id || recordData.ai_cache_id,
        has_ai_report: !!recordData.has_ai_report || !!recordData.ai_report_id,
        description: recordData.description || ''
      },
      petInfo: petData
    };

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: responseData
    };

  } catch (error) {
    logger.error('获取评估详情失败:', error);

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
