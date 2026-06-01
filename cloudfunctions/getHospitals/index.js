// 云函数入口文件
// 注意: 此云函数当前返回模拟数据。生产环境请使用 searchHospitals 云函数，
// 该函数通过服务端调用腾讯地图API获取实时数据并隐藏API密钥。
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE } = require('./constants');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 获取附近的宠物医院列表
 * V1.0: 返回模拟数据供开发测试
 * TODO: 接入数据库中的真实医院数据
 */
exports.main = async (event) => {
  const { latitude, longitude, is24h = false, limit = 20 } = event;

  try {
    // 参数校验
    if (!latitude || !longitude) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '请提供位置信息',
        data: {}
      };
    }

    // 尝试从数据库查询
    let hospitals = [];
    try {
      const dbResult = await db.collection(COLLECTIONS.HOSPITALS)
        .limit(limit)
        .get();
      hospitals = dbResult.data;
    } catch (dbError) {
      console.log('数据库查询失败，使用模拟数据:', dbError.message);
    }

    // 如果没有数据库数据，返回模拟数据
    if (hospitals.length === 0) {
      hospitals = [
        {
          hospitalId: 'mock_001',
          name: '爱心宠物医院',
          address: 'xx市xx区xx路123号',
          distance: 500,
          phone: '010-12345678',
          is24h: true,
          rating: 4.5,
          location: { latitude: latitude + 0.001, longitude: longitude + 0.001 }
        },
        {
          hospitalId: 'mock_002',
          name: '宠物中心医院',
          address: 'xx市xx区xx路456号',
          distance: 1200,
          phone: '010-87654321',
          is24h: true,
          rating: 4.8,
          location: { latitude: latitude - 0.002, longitude: longitude + 0.003 }
        },
        {
          hospitalId: 'mock_003',
          name: '萌宠宠物诊所',
          address: 'xx市xx区xx路789号',
          distance: 800,
          phone: '010-11223344',
          is24h: false,
          rating: 4.2,
          location: { latitude: latitude + 0.002, longitude: longitude - 0.001 }
        }
      ];
    }

    // 根据条件筛选
    let filteredHospitals = hospitals;
    if (is24h) {
      filteredHospitals = hospitals.filter(h => h.is24h);
    }

    // 按距离排序
    filteredHospitals.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    // 限制返回数量
    const limitedHospitals = filteredHospitals.slice(0, limit);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        hospitals: limitedHospitals,
        total: limitedHospitals.length,
        userLocation: { latitude, longitude },
        isMockData: hospitals[0] && hospitals[0].hospitalId && hospitals[0].hospitalId.startsWith('mock')
      }
    };

  } catch (error) {
    console.error('获取医院列表失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: { error: error.message }
    };
  }
};
