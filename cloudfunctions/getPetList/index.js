// 云函数入口文件
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE } = require('./constants');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 计算宠物健康状态
 */
function calculateHealthStatus(pet) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const hasRecentVaccine = pet.vaccine_date && new Date(pet.vaccine_date) >= thirtyDaysAgo;
  const hasRecentDeworming = pet.deworm_date && new Date(pet.deworm_date) >= thirtyDaysAgo;

  if (hasRecentVaccine && hasRecentDeworming) {
    return 'good';
  } else if (!hasRecentVaccine || !hasRecentDeworming) {
    return 'warning';
  }
  return 'good';
}

/**
 * 获取健康状态文本
 */
function getHealthStatusText(status) {
  return status === 'good' ? '状态良好' : '需要关注';
}

/**
 * 获取用户的宠物列表
 */
exports.main = async (event, context) => {
  const { openid } = event;

  try {
    // 1. 参数校验
    if (!openid) {
      return {
        code: RESPONSE_CODE.UNAUTHORIZED,
        msg: '用户未登录',
        data: {}
      };
    }

    // 2. 查询用户的宠物列表
    const result = await db.collection(COLLECTIONS.PETS)
      .where({
        user_id: openid
      })
      .orderBy('created_at', 'desc')
      .get();

    // 3. 格式化返回数据并计算健康状态（统一使用_id）
    const petList = result.data.map(pet => {
      const healthStatus = calculateHealthStatus(pet);
      return {
        _id: pet._id,
        petId: pet._id,
        petCode: pet.petCode || '',
        name: pet.name,
        type: pet.type,
        breed: pet.breed,
        age: pet.age,
        weight: pet.weight,
        gender: pet.gender || 'male',
        vaccineDate: pet.vaccine_date,
        dewormDate: pet.deworm_date,
        avatar: pet.avatar || '',
        createdAt: pet.created_at,
        healthStatus: healthStatus,
        healthStatusText: getHealthStatusText(healthStatus)
      };
    });

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        petList: petList,
        total: petList.length
      }
    };

  } catch (error) {
    console.error('获取宠物列表失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {
        error: error.message
      }
    };
  }
};