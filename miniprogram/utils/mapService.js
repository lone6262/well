// 地图服务模块 - 集成腾讯地图API - 实时24小时医院搜索增强版
const MAP_CONFIG = require('./mapConfig.js')
const { MAP_CONFIG: MAP_CONSTANTS, TOAST_DURATION } = require('./constants.js')
const logger = require('./logger.js')
const log = logger.child('MapService')

/**
 * 地图服务类 - 实时增强版
 */
class MapService {
  constructor() {
    this.key = MAP_CONFIG.key
    this.defaultCenter = MAP_CONFIG.defaultCenter
  }

  /**
   * 搜索附近的宠物医院 - 增强版，支持多关键词和24小时过滤
   * @param {number} latitude 纬度
   * @param {number} longitude 经度
   * @param {number} radius 搜索半径（米）
   * @returns {Promise} 搜索结果
   */
  searchNearbyHospitals(latitude, longitude, radius = MAP_CONSTANTS.SEARCH_RADIUS) {
    return new Promise((resolve, reject) => {
      // 如果还没有配置API密钥，使用模拟数据
      if (this.key === 'YOUR_TENCENT_MAP_KEY') {
        log.info('使用模拟医院数据，请配置腾讯地图API密钥')
        resolve(this.getMockHospitals(latitude, longitude))
        return
      }

      log.info(`[SEARCH] 开始搜索附近医院，中心点: (${latitude}, ${longitude}), 半径: ${radius}米`)

      // 多关键词搜索策略，优先搜索24小时医院
      const searchKeywords = [
        '24小时宠物医院',
        '宠物医院急诊',
        '宠物医院'
      ]

      let results = []
      let completedSearches = 0
      let hasNetworkError = false

      // 依次搜索每个关键词
      searchKeywords.forEach((keyword, index) => {
        this.searchWithKeyword(latitude, longitude, radius, keyword)
          .then(keywordResults => {
            log.info(`[OK] 关键词"${keyword}"搜索到 ${keywordResults.length} 个结果`)

            // 标记结果的搜索优先级（越靠前的关键词优先级越高）
            const taggedResults = keywordResults.map(result => ({
              ...result,
              searchPriority: index,
              searchKeyword: keyword
            }))

            results = results.concat(taggedResults)
            completedSearches++

            // 所有搜索完成
            if (completedSearches === searchKeywords.length) {
              this.processSearchResults(results, latitude, longitude, resolve, hasNetworkError)
            }
          })
          .catch(error => {
            log.error(`[FAIL] 关键词"${keyword}"搜索失败:`, error)
            hasNetworkError = true
            completedSearches++

            // 所有搜索完成
            if (completedSearches === searchKeywords.length) {
              this.processSearchResults(results, latitude, longitude, resolve, hasNetworkError)
            }
          })
      })

      // 设置超时，防止长时间无响应
      setTimeout(() => {
        if (completedSearches < searchKeywords.length) {
          log.info('[TIMEOUT] 搜索超时，返回已获取的结果')
          this.processSearchResults(results, latitude, longitude, resolve, true)
        }
      }, MAP_CONSTANTS.API_TIMEOUT) // API超时
    })
  }

  /**
   * 使用单个关键词搜索
   */
  searchWithKeyword(latitude, longitude, radius, keyword) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'https://apis.map.qq.com/ws/place/v1/search',
        data: {
          key: this.key,
          keyword: keyword,
          boundary: `nearby(${latitude},${longitude},${radius})`,
          page_size: 20,
          page_index: 1
        },
        success: (res) => {
          if (res.data.status === 0) {
            const hospitals = res.data.data.map(item => {
              log.info('[DATA] API返回数据:', item)

              // 计算距离：优先使用API返回的距离，否则手动计算
              let calculatedDistance = 0
              if (typeof item.distance === 'number' && !isNaN(item.distance) && item.distance > 0) {
                calculatedDistance = item.distance
              } else if (item.location && item.location.lat && item.location.lng) {
                // API没有提供距离，手动计算
                calculatedDistance = this.calculateDistance(
                  latitude, longitude,
                  item.location.lat, item.location.lng
                )
              }

              const mapped = {
                hospitalId: item.id || 'unknown_' + Date.now(),
                name: item.title || '未命名医院',
                address: item.address || '地址暂无',
                distance: calculatedDistance,
                latitude: (item.location && item.location.lat) ? item.location.lat : 0,
                longitude: (item.location && item.location.lng) ? item.location.lng : 0,
                phone: this.formatPhoneNumber(item.tel),
                is24h: this.check24Hours(item),
                rating: this.extractRating(item)
              }

              log.info('[OK] 映射后数据:', mapped)
              return mapped
            })
            resolve(hospitals)
          } else {
            log.error(`腾讯地图API搜索失败(${keyword}):`, res.data.message)
            resolve([])
          }
        },
        fail: (error) => {
          log.error(`地图API调用失败(${keyword}):`, error)
          reject(error)
        }
      })
    })
  }

  /**
   * 处理搜索结果：去重、排序、过滤
   */
  processSearchResults(rawResults, latitude, longitude, resolve, hasError) {
    if (rawResults.length === 0) {
      log.info('[FAIL] 没有搜索到结果，使用模拟数据')
      resolve(this.getMockHospitals(latitude, longitude))
      return
    }

    // 去重：根据hospitalId去重，保留优先级最高的
    const uniqueMap = new Map()
    rawResults.forEach(result => {
      const existing = uniqueMap.get(result.hospitalId)
      if (!existing || result.searchPriority < existing.searchPriority) {
        uniqueMap.set(result.hospitalId, result)
      }
    })

    const uniqueResults = Array.from(uniqueMap.values())
    log.info(`[DEDUP] 去重后剩余 ${uniqueResults.length} 个医院`)

    // 排序：24小时医院优先，然后按距离，最后按搜索优先级
    const sortedResults = uniqueResults.sort((a, b) => {
      // 首先按24小时状态排序（24小时优先）
      if (a.is24h !== b.is24h) {
        return a.is24h ? -1 : 1
      }

      // 然后按距离排序
      if (a.distance !== b.distance) {
        return a.distance - b.distance
      }

      // 最后按搜索优先级排序
      return a.searchPriority - b.searchPriority
    })

    // 确保前面的结果中有24小时医院
    const resultsWith24Hours = this.ensure24HoursHospitals(sortedResults)

    const hours24Count = resultsWith24Hours.filter(h => h.is24h).length
    log.info(`[OK] 最终返回 ${resultsWith24Hours.length} 个医院，其中24小时: ${hours24Count}个`)

    if (hasError) {
      wx.showToast({
        title: '部分搜索失败，显示可用结果',
        icon: 'none',
        duration: TOAST_DURATION.NORMAL
      })
    }

    resolve(resultsWith24Hours)
  }

  /**
   * 确保结果集中包含24小时医院
   */
  ensure24HoursHospitals(hospitals) {
    const hospitals24h = hospitals.filter(h => h.is24h)
    const otherHospitals = hospitals.filter(h => !h.is24h)

    // 如果有24小时医院，将它们放在前面
    if (hospitals24h.length > 0) {
      return [...hospitals24h, ...otherHospitals]
    }

    // 如果没有24小时医院，返回所有医院
    return hospitals
  }

  /**
   * 检查是否为24小时医院（增强版，基于多个特征判断）
   */
  check24Hours(place) {
    const keywords = ['24小时', '急诊', '24h', '全天', '昼夜', '日夜']
    const title = place.title || ''
    const address = place.address || ''

    // 检查名称和地址中是否包含24小时相关关键词
    const hasKeyword = keywords.some(keyword =>
      title.includes(keyword) || address.includes(keyword)
    )

    return hasKeyword
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
        log.error('拨打电话失败:', error)
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

  /**
   * 格式化电话号码
   */
  formatPhoneNumber(tel) {
    if (!tel) return '暂无电话'

    // 移除所有非数字字符，只保留数字、+、-、空格
    let cleaned = tel.toString().replace(/[^0-9+\-\s]/g, '').trim()

    // 如果清理后为空或过短，返回提示
    if (!cleaned || cleaned.length < 7) {
      return '请电话确认'
    }

    return cleaned
  }

  /**
   * 实时位置监控（可选功能）
   */
  startLocationMonitoring(callback) {
    // 监控位置变化，当移动距离超过100米时触发回调
    const WATCH_DISTANCE = 100 // 米

    this.locationWatchCallback = callback
    this.lastLocation = null

    // 开启实时位置监控
    this.locationWatchId = wx.startLocationUpdate({
      success: () => {
        log.info('[LOCATION] 实时位置监控已启动')

        // 监听位置变化事件
        wx.onLocationChange((res) => {
          const currentLocation = {
            latitude: res.latitude,
            longitude: res.longitude
          }

          if (this.lastLocation) {
            const distance = this.calculateDistance(
              this.lastLocation.latitude,
              this.lastLocation.longitude,
              currentLocation.latitude,
              currentLocation.longitude
            )

            if (distance > WATCH_DISTANCE && this.locationWatchCallback) {
              log.info(`[MOVE] 位置变化超过${WATCH_DISTANCE}米，触发回调`)
              this.locationWatchCallback(currentLocation, distance)
            }
          }

          this.lastLocation = currentLocation
        })
      },
      fail: (error) => {
        log.error('实时位置监控启动失败:', error)
      }
    })
  }

  /**
   * 停止位置监控
   */
  stopLocationMonitoring() {
    if (this.locationWatchId) {
      wx.stopLocationUpdate({
        success: () => {
          log.info('[STOP] 实时位置监控已停止')
        }
      })
      this.locationWatchId = null
      this.locationWatchCallback = null
      this.lastLocation = null
    }
  }
}

// 创建单例
const mapService = new MapService()

module.exports = mapService