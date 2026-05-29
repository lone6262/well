// 医院列表页面 - 全新设计逻辑
var app = getApp()
var mapService = require('../../utils/mapService.js')

Page({
  data: {
    // 基础数据
    hospitals: [],
    displayHospitals: [],
    emergencyHospitals: [],

    // 位置信息
    latitude: 39.90469,
    longitude: 116.40717,
    locationText: '定位中...',

    // API状态
    apiAvailable: true,  // API是否可用
    isLoading: false,
    errorMessage: ''
  },

  onLoad: function() {
    console.log('医院列表页面加载')
    this.initPage()
  },

  onShow: function() {
    // 每次显示时刷新数据
    if (this.data.hospitals.length > 0) {
      this.refreshHospitals()
    }
  },

  onPullDownRefresh: function() {
    this.refreshHospitals()
    wx.stopPullDownRefresh()
  },

  // === 页面初始化 ===
  initPage: function() {
    var self = this

    // 获取位置
    this.getUserLocation().then(function(location) {
      self.setData({
        latitude: location.latitude,
        longitude: location.longitude,
        locationText: '当前位置'
      })

      // 加载医院数据
      return self.loadHospitals()
    }).catch(function(error) {
      console.error('初始化失败:', error)
      self.setData({
        locationText: '北京（默认位置）',
        apiAvailable: false
      })
      // 使用默认位置加载数据
      self.loadHospitals()
    })
  },

  // === 获取用户位置 ===
  getUserLocation: function() {
    var self = this
    return new Promise(function(resolve, reject) {
      wx.getLocation({
        type: 'gcj02',
        success: function(res) {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude
          })
        },
        fail: function(error) {
          console.error('获取位置失败:', error)
          // 使用默认位置
          resolve({
            latitude: 39.90469,
            longitude: 116.40717
          })
        }
      })
    })
  },

  // === 加载医院数据 ===
  loadHospitals: function() {
    var self = this
    self.setData({ isLoading: true })

    return mapService.searchNearbyHospitals(
      this.data.latitude,
      this.data.longitude,
      5000
    ).then(function(hospitals) {
      // 数据加载成功
      var processedHospitals = self.processHospitalData(hospitals)

      // 分类医院数据
      var emergencyHospitals = processedHospitals.filter(function(h) {
        return h.is24h || h.hasEmergency
      }).slice(0, 5) // 最多显示5家紧急医院

      self.setData({
        hospitals: processedHospitals,
        displayHospitals: processedHospitals,
        emergencyHospitals: emergencyHospitals,
        apiAvailable: true,
        isLoading: false
      })

      console.log('医院数据加载成功:', processedHospitals.length, '家')
      return processedHospitals

    }).catch(function(error) {
      console.error('医院数据加载失败:', error)

      // API失败时使用离线数据
      var offlineHospitals = self.getOfflineHospitals()
      var processedOffline = self.processHospitalData(offlineHospitals)

      self.setData({
        hospitals: processedOffline,
        displayHospitals: processedOffline,
        emergencyHospitals: processedOffline.slice(0, 3),
        apiAvailable: false,
        isLoading: false
      })

      wx.showToast({
        title: '使用推荐医院数据',
        icon: 'none',
        duration: 2000
      })

      return processedOffline
    })
  },

  // === 处理医院数据 ===
  processHospitalData: function(hospitals) {
    var self = this

    return hospitals.map(function(hospital) {
      // 计算距离显示
      var distanceDisplay = self.formatDistance(hospital.distance)

      // 确定医院类型标签
      var hasEmergency = hospital.name.indexOf('急诊') !== -1 ||
                        hospital.name.indexOf('紧急') !== -1

      return {
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        address: hospital.address,
        phone: hospital.phone,
        distance: hospital.distance,
        distanceDisplay: distanceDisplay,
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        rating: hospital.rating || 4.5,
        is24h: hospital.is24h,
        hasEmergency: hasEmergency,
        openingHours: hospital.openingHours || '未知',
        services: hospital.services || []
      }
    }).sort(function(a, b) {
      // 按距离排序
      return a.distance - b.distance
    })
  },

  // === 格式化距离显示 ===
  formatDistance: function(meters) {
    if (meters >= 1000) {
      return Math.round(meters / 1000) + 'km'
    } else {
      return Math.round(meters) + 'm'
    }
  },

  // === 获取离线医院数据 ===
  getOfflineHospitals: function() {
    var lat = this.data.latitude
    var lng = this.data.longitude

    return [
      {
        hospitalId: 'offline_001',
        name: '爱心宠物医院',
        address: '优质宠物医疗服务',
        distance: 500,
        latitude: lat + 0.001,
        longitude: lng + 0.001,
        phone: '请电话确认',
        is24h: true,
        rating: 4.5
      },
      {
        hospitalId: 'offline_002',
        name: '宠物中心医院',
        address: '专业宠物诊疗中心',
        distance: 1200,
        latitude: lat + 0.002,
        longitude: lng + 0.002,
        phone: '请电话确认',
        is24h: true,
        rating: 4.8
      },
      {
        hospitalId: 'offline_003',
        name: '萌宠宠物诊所',
        address: '温馨宠物医疗服务',
        distance: 800,
        latitude: lat - 0.001,
        longitude: lng - 0.001,
        phone: '请电话确认',
        is24h: false,
        rating: 4.2
      }
    ]
  },

  // === 用户交互方法 ===

  // 查看医院详情
  viewHospital: function(e) {
    var hospitalId = e.currentTarget.dataset.id
    console.log('查看医院详情:', hospitalId)

    // 跳转到医院详情页
    wx.navigateTo({
      url: '/pages/hospital/detail?id=' + hospitalId,
      fail: function() {
        wx.showToast({
          title: '详情页开发中',
          icon: 'none'
        })
      }
    })
  },

  // 拨打电话
  callHospital: function(e) {
    var phone = e.currentTarget.dataset.phone
    console.log('拨打电话:', phone)

    if (phone && phone !== '请电话确认') {
      wx.makePhoneCall({
        phoneNumber: phone,
        fail: function() {
          wx.showToast({
            title: '拨号失败',
            icon: 'none'
          })
        }
      })
    } else {
      wx.showModal({
        title: '温馨提示',
        content: '当前使用推荐数据，请在地图中搜索实际电话号码',
        showCancel: false
      })
    }
  },

  // 导航到医院
  navigateToHospital: function(e) {
    var hospital = e.currentTarget.dataset.hospital
    console.log('导航到医院:', hospital.name)

    if (this.data.apiAvailable) {
      // 使用真实位置导航
      mapService.openNavigation(hospital)
    } else {
      // 使用地图模式让用户手动导航
      this.showMapMode()
      wx.showToast({
        title: '请在地图中选择目的地',
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 快速导航到最近医院
  navigateToNearest: function() {
    if (this.data.displayHospitals.length > 0) {
      var nearestHospital = this.data.displayHospitals[0]
      this.navigateToHospital({
        currentTarget: {
          dataset: {
            hospital: nearestHospital
          }
        }
      })
    } else {
      wx.showToast({
        title: '暂无医院数据',
        icon: 'none'
      })
    }
  },

  // 显示地图模式
  showMapMode: function() {
    console.log('切换到地图模式')
    wx.showToast({
      title: '地图模式开发中',
      icon: 'none'
    })
  },

  // 显示完整地图
  showFullMap: function() {
    console.log('显示完整地图')
    this.showMapMode()
  },

  // 显示医院详情
  showHospitalDetail: function(e) {
    var hospital = e.currentTarget.dataset.hospital
    console.log('显示医院详情:', hospital.name)

    wx.showModal({
      title: hospital.name,
      content: '地址: ' + hospital.address + '\n电话: ' + hospital.phone + '\n营业时间: ' + hospital.openingHours,
      showCancel: false
    })
  },

  // 快速导航到医院
  quickNavigate: function(e) {
    var hospital = e.currentTarget.dataset.hospital
    console.log('快速导航到医院:', hospital.name)

    if (!hospital.latitude || !hospital.longitude) {
      wx.showToast({
        title: '该医院暂无位置信息',
        icon: 'none'
      })
      return
    }

    wx.openLocation({
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      name: hospital.name,
      address: hospital.address,
      scale: 15
    })
  },

  // 重新加载医院数据
  reloadHospitals: function() {
    console.log('重新加载医院数据')
    this.loadHospitals()
  },

  // 刷新医院数据
  refreshHospitals: function() {
    console.log('刷新医院数据')
    this.loadHospitals()
  }
})