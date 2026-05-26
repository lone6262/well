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
 * 获取附近的宠物医院列表
 */
exports.main = async (event, context) => {
  const { latitude, longitude, is24h = false, limit = 20 } = event;

  try {
    // 1. 参数校验
    if (!latitude || !longitude) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '请提供位置信息',
        data: {}
      };
    }

    // 2. V1.0版本：返回模拟数据
    const mockHospitals = [
      {
        hospitalId: 'mock_001',
        name: '爱心宠物医院',
        address: 'xx市xx区xx路123号',
        distance: 500,
        phone: '010-12345678',
        is24h: true,
        rating: 4.5,
        location: {
          latitude: latitude + 0.001,
          longitude: longitude + 0.001
        },
        businessHours: '24小时营业',
        claimStatus: 'unclaimed'
      },
      {
        hospitalId: 'mock_002',
        name: '宠物中心医院',
        address: 'xx市xx区xx路456号',
        distance: 1200,
        phone: '010-87654321',
        is24h: true,
        rating: 4.8,
        location: {
          latitude: latitude - 0.002,
          longitude: longitude + 0.003
        },
        businessHours: '24小时营业',
        claimStatus: 'claimed'
      },
      {
        hospitalId: 'mock_003',
        name: '萌宠宠物诊所',
        address: 'xx市xx区xx路789号',
        distance: 800,
        phone: '010-11223344',
        is24h: false,
        rating: 4.2,
        location: {
          latitude: latitude + 0.002,
          longitude: longitude - 0.001
        },
        businessHours: '09:00-21:00',
        claimStatus: 'unclaimed'
      },
      {
        hospitalId: 'mock_004',
        name: '瑞派宠物医院',
        address: 'xx市xx区xx路321号',
        distance: 1500,
        phone: '010-55667788',
        is24h: true,
        rating: 4.6,
        location: {
          latitude: latitude - 0.001,
          longitude: longitude - 0.002
        },
        businessHours: '24小时营业',
        claimStatus: 'claimed'
      },
      {
        hospitalId: 'mock_005',
        name: '乐乐宠物诊所',
        address: 'xx市xx区xx路654号',
        distance: 2000,
        phone: '010-99887766',
        is24h: false,
        rating: 4.0,
        location: {
          latitude: latitude + 0.003,
          longitude: longitude + 0.002
        },
        businessHours: '08:00-20:00',
        claimStatus: 'unclaimed'
      }
    ];

    // 3. 根据条件筛选
    let filteredHospitals = mockHospitals;

    if (is24h) {
      // 只显示24小时医院
      filteredHospitals = mockHospitals.filter(hospital => hospital.is24h);
    }

    // 4. 按距离排序
    filteredHospitals.sort((a, b) => a.distance - b.distance);

    // 5. 限制返回数量
    const limitedHospitals = filteredHospitals.slice(0, limit);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        hospitals: limitedHospitals,
        total: limitedHospitals.length,
        userLocation: {
          latitude: latitude,
          longitude: longitude
        },
        isMockData: true  // 标识这是模拟数据
      }
    };

  } catch (error) {
    console.error('获取医院列表失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {
        error: error.message
      }
    };
  }
};