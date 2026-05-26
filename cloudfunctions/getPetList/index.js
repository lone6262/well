// 云函数入口文件
const cloud = require('wx-server-sdk');

// 本地常量定义
const COLLECTIONS = {
  USERS: 'users',
  PETS: 'pets',
  SYMPTOM_RECORDS: 'symptom_records',
  AI_CACHE: 'ai_cache',
  ORDERS: 'orders',
  HOSPITALS: 'hospitals'
};

const RESPONSE_CODE = {
  SUCCESS: 0,
  ERROR: -1,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

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

    // 3. 格式化返回数据
    const petList = result.data.map(pet => ({
      petId: pet._id,
      name: pet.name,
      type: pet.type,
      breed: pet.breed,
      age: pet.age,
      weight: pet.weight,
      vaccineDate: pet.vaccine_date,
      dewormDate: pet.deworm_date,
      createdAt: pet.created_at
    }));

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