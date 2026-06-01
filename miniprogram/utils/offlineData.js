/**
 * 统一离线数据模块
 * 所有页面的降级/模拟数据集中管理，避免分散在各页面
 *
 * 使用方式:
 *   const offlineData = require('../../utils/offlineData.js')
 *   const hospitals = offlineData.getHospitals(latitude, longitude)
 *   const pets = offlineData.getPets()
 */

/**
 * 获取模拟医院数据
 * @param {number} latitude - 当前位置纬度
 * @param {number} longitude - 当前位置经度
 * @returns {Array} 医院列表
 */
function getHospitals(latitude, longitude) {
  return [
    {
      hospitalId: 'mock_001',
      name: '爱心宠物医院（24小时）',
      address: 'xx市xx区xx路123号',
      distance: 500,
      latitude: latitude + 0.001,
      longitude: longitude + 0.001,
      phone: '010-12345678',
      is24h: true,
      rating: 4.5
    },
    {
      hospitalId: 'mock_002',
      name: '宠物中心医院（24小时急诊）',
      address: 'xx市xx区xx路456号',
      distance: 1200,
      latitude: latitude + 0.002,
      longitude: longitude + 0.002,
      phone: '010-87654321',
      is24h: true,
      rating: 4.8
    },
    {
      hospitalId: 'mock_003',
      name: '萌宠宠物诊所',
      address: 'xx市xx区xx路789号',
      distance: 800,
      latitude: latitude + 0.003,
      longitude: longitude + 0.003,
      phone: '010-11223344',
      is24h: false,
      rating: 4.2
    }
  ];
}

/**
 * 获取模拟急救医院数据
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Array} 急救医院列表
 */
function getEmergencyHospitals(latitude, longitude) {
  return [
    {
      hospitalId: 'mock_emergency_001',
      name: '24小时宠物急救中心',
      address: 'xx市xx区急救路1号',
      distance: 300,
      latitude: latitude + 0.0005,
      longitude: longitude + 0.0005,
      phone: '010-99999999',
      is24h: true,
      rating: 4.9
    },
    {
      hospitalId: 'mock_emergency_002',
      name: '市动物医院总院（24小时）',
      address: 'xx市xx区总院路100号',
      distance: 1500,
      latitude: latitude + 0.0015,
      longitude: longitude + 0.0015,
      phone: '010-88888888',
      is24h: true,
      rating: 4.7
    }
  ];
}

/**
 * 获取模拟宠物数据
 * @returns {Array} 宠物列表
 */
function getPets() {
  return [
    {
      _id: 'mock_pet_001',
      petId: 'mock_pet_001',
      name: '小咪',
      type: 'cat',
      breed: '英短',
      age: 24,
      weight: 4.5,
      gender: 'female',
      vaccineDate: '',
      dewormDate: '',
      avatar: '',
      healthStatus: 'good',
      healthStatusText: '状态良好'
    },
    {
      _id: 'mock_pet_002',
      petId: 'mock_pet_002',
      name: '旺财',
      type: 'dog',
      breed: '金毛',
      age: 36,
      weight: 28,
      gender: 'male',
      vaccineDate: '',
      dewormDate: '',
      avatar: '',
      healthStatus: 'warning',
      healthStatusText: '需要关注'
    }
  ];
}

/**
 * 获取模拟风险评估结果
 * @returns {Object} 评估结果
 */
function getRiskAssessment() {
  return {
    riskLevel: 'low',
    advice: '低风险，建议继续观察。保持正常饮食饮水，记录症状变化。',
    action: 'home',
    matchedRule: '默认规则（离线模式）',
    symptomSummary: '暂无数据'
  };
}

module.exports = {
  getHospitals,
  getEmergencyHospitals,
  getPets,
  getRiskAssessment
};
