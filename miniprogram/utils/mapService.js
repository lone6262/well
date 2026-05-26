// 地图服务模块 - 集成腾讯地图API
const MAP_CONFIG = require('./mapConfig.js')

/**
 * 地图服务类
 */
class MapService {
  constructor() {
    this.key = MAP_CONFIG.key
    this.defaultCenter = MAP_CONFIG.defaultCenter
  }

  /**
   * 搜索附近的宠物医院
   * @param {number} latitude 纬度
   * @param {number} longitude 经度
   * @param {number} radius 搜索半径（米）
   * @returns {Promise} 搜索结果
   */
  searchNearbyHospitals(latitude, longitude, radius = 5000) {
    return new Promise((resolve, reject) => {
      // 如果还没有配置API密钥，使用模拟数据
      if (this.key === 'YOUR_TENCENT_MAP_KEY') {
        console.log('使用模拟医院数据，请配置腾讯地图API密钥')
        resolve(this.getMockHospitals(latitude, longitude))
        return
      }

      // 使用腾讯地图API搜索
      wx.request({
        url: 'https://apis.map.qq.com/ws/place/v1/search',
        data: {
          key: this.key,
          keyword: '宠物医院',
          boundary: `nearby(${latitude},${longitude},${radius})`,
          page_size: 20,
          page_index: 1
        },
        success: (res) => {
          if (res.data.status === 0) {
            const hospitals = res.data.data.map(item => ({
              hospitalId: item.id,
              name: item.title,
              address: item.address,
              distance: item.distance,
              latitude: item.location.lat,
              longitude: item.location.lng,
              phone: item.tel || '暂无电话',
              is24h: this.check24Hours(item),
              rating: this.extractRating(item)
            }))
            resolve(hospitals)
          } else {
            console.error('腾讯地图API搜索失败:', res.data.message)
            // API失败时使用模拟数据
            resolve(this.getMockHospitals(latitude, longitude))
          }
        },
        fail: (error) => {
          console.error('地图API调用失败:', error)
          // 网络失败时使用模拟数据
          resolve(this.getMockHospitals(latitude, longitude))
        }
      })
    })
  }

  /**
   * 检查是否为24小时医院（基于名称判断）
   */
  check24Hours(place) {
    const keywords = ['24小时', '急诊', '24h', '全天']
    return keywords.some(keyword => place.title.includes(keyword))
  }

  /**
   * 提取评分信息
   */
  extractRating(place) {
    // 腾讯地图API可能不直接提供评分，这里给出默认评分
    return 4.5
  }

  /**
   * 获取模拟医院数据（API未配置时的降级方案）
   */
  getMockHospitals(latitude, longitude) {
    return [
      {
        hospitalId: 'mock_001',
        name: '爱心宠物医院',
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
        name: '宠物中心医院',
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
    ]
  }

  /**
   * 打开地图导航
   */
  openNavigation(hospital) {
    wx.openLocation({
      latitude: hospital.latitude || hospital.location.latitude,
      longitude: hospital.longitude || hospital.location.longitude,
      name: hospital.name,
      address: hospital.address,
      scale: 15
    })
  }

  /**
   * 拨打电话
   */
  makePhoneCall(phoneNumber) {
    wx.makePhoneCall({
      phoneNumber: phoneNumber,
      fail: (error) => {
        console.error('拨打电话失败:', error)
        wx.showToast({
          title: '拨号失败',
          icon: 'none'
        })
      }
    })
  }

  /**
   * 计算两个坐标点之间的距离（简化版）
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000 // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }
}

// 创建单例
const mapService = new MapService()

module.exports = mapService