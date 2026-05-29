// 急救通道页面 - 极简设计逻辑
var app = getApp()
var mapService = require('../../utils/mapService.js')

Page({
  data: {
    // 状态管理
    isLoading: true,
    showOther: false,  // 是否显示其他医院

    // 位置信息
    latitude: 39.90469,
    longitude: 116.40717,

    // 医院数据
    nearestHospital: null,   // 最近的医院
    otherHospitals: []       // 其他医院
  },

  onLoad: function() {
    console.log('急救通道页面加载')
    this.initEmergencyPage()
  },

  // === 页面初始化 ===
  initEmergencyPage: function() {
    var self = this

    // 立即开始定位
    this.getUserLocation().then(function(location) {
      self.setData({
        latitude: location.latitude,
        longitude: location.longitude
      })

      // 加载医院数据
      return self.loadEmergencyHospitals()
    }).catch(function(error) {
      console.error('初始化失败:', error)
      self.setData({
        isLoading: false,
        nearestHospital: null
      })

      wx.showModal({
        title: '定位失败',
        content: '无法获取您的位置，将使用默认位置搜索医院',
        showCancel: false,
        success: function() {
          // 使用默认位置重试
          self.loadEmergencyHospitals()
        }
      })
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
          reject(error)
        }
      })
    })
  },

  // === 加载急救医院数据 ===
  loadEmergencyHospitals: function() {
    var self = this
    self.setData({ isLoading: true })

    return mapService.searchNearbyHospitals(
      this.data.latitude,
      this.data.longitude,
      5000
    ).then(function(hospitals) {
      // 处理医院数据
      var processedHospitals = self.processHospitals(hospitals)

      // 分离最近医院和其他医院
      var nearest = null
      var others = []

      if (processedHospitals.length > 0) {
        nearest = processedHospitals[0]  // 最近的一家
        others = processedHospitals.slice(1)  // 其余的
      }

      self.setData({
        nearestHospital: nearest,
        otherHospitals: others,
        isLoading: false
      })

      console.log('急救医院加载完成，最近医院:', nearest ? nearest.name : '无')
      return processedHospitals

    }).catch(function(error) {
      console.error('医院加载失败:', error)

      // 使用离线急救数据
      var offlineHospitals = self.getEmergencyOfflineData()

      self.setData({
        nearestHospital: offlineHospitals[0],
        otherHospitals: offlineHospitals.slice(1),
        isLoading: false
      })

      wx.showToast({
        title: '使用推荐急救数据',
        icon: 'none',
        duration: 2000
      })

      return offlineHospitals
    })
  },

  // === 处理医院数据 ===
  processHospitals: function(hospitals) {
    var self = this

    return hospitals.map(function(hospital) {
      // 格式化距离显示
      var distanceText = self.formatDistance(hospital.distance)

      return {
        hospitalId: hospital.hospitalId,
        name: hospital.name,
        address: hospital.address,
        phone: hospital.phone,
        distance: hospital.distance,
        distanceDisplay: distanceText,
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        is24h: hospital.is24h,
        hasEmergency: hospital.name.indexOf('急诊') !== -1
      }
    }).sort(function(a, b) {
      // 按距离排序，最近的在前面
      return a.distance - b.distance
    })
  },

  // === 格式化距离 ===
  formatDistance: function(meters) {
    if (meters >= 1000) {
      return Math.round(meters / 1000) + 'km'
    } else {
      return Math.round(meters) + 'm'
    }
  },

  // === 获取离线急救数据 ===
  getEmergencyOfflineData: function() {
    var lat = this.data.latitude
    var lng = this.data.longitude

    return [
      {
        hospitalId: 'emergency_001',
        name: '宠物急救中心',
        address: '24小时宠物急诊服务',
        phone: '请电话确认',
        distance: 800,
        distanceDisplay: '800m',
        latitude: lat + 0.001,
        longitude: lng + 0.001,
        is24h: true,
        hasEmergency: true
      },
      {
        hospitalId: 'emergency_002',
        name: '爱心宠物医院',
        address: '提供24小时紧急服务',
        phone: '请电话确认',
        distance: 1200,
        distanceDisplay: '1km',
        latitude: lat - 0.001,
        longitude: lng - 0.001,
        is24h: true,
        hasEmergency: true
      }
    ]
  },

  // === 用户交互方法 ===

  // 拨打电话 - 增强版
  callHospital: function(e) {
    var phone = e.currentTarget.dataset.phone
    var hospitalName = e.currentTarget.dataset.name || '宠物医院'
    console.log('拨打急救电话:', phone, '医院:', hospitalName)

    // 电话号码验证和清理
    if (!phone) {
      wx.showModal({
        title: '电话不可用',
        content: '该医院暂未提供联系电话',
        showCancel: false
      })
      return
    }

    // 清理电话号码格式
    var cleanPhone = phone.toString().replace(/[^0-9+*-]/g, '').trim()

    if (!cleanPhone || cleanPhone === '请电话确认' || cleanPhone === '暂无电话') {
      wx.showModal({
        title: '建议操作',
        content: '该医院电话信息不完整，建议您：\n1. 通过网络搜索该医院电话\n2. 直接前往医院急诊\n3. 联系其他24小时宠物医院',
        showCancel: true,
        confirmText: '我知道了',
        cancelText: '拨打通用急救'
      })
      return
    }

    // 电话号码格式验证
    if (cleanPhone.length < 7) {
      wx.showModal({
        title: '电话格式异常',
        content: '电话号码格式可能有误：' + cleanPhone + '\n是否继续拨打？',
        success: function(modalRes) {
          if (modalRes.confirm) {
            wx.makePhoneCall({
              phoneNumber: cleanPhone
            })
          }
        }
      })
      return
    }

    // 增加拨打前的确认提示
    wx.showModal({
      title: '确认拨打',
      content: '即将拨打 ' + hospitalName + '\n电话：' + cleanPhone,
      confirmText: '立即拨打',
      cancelText: '取消',
      success: function(modalRes) {
        if (modalRes.confirm) {
          wx.makePhoneCall({
            phoneNumber: cleanPhone,
            success: function() {
              console.log('电话拨打成功')
              wx.showToast({
                title: '正在拨打...',
                icon: 'success',
                duration: 2000
              })
            },
            fail: function(err) {
              console.error('拨号失败:', err)
              wx.showModal({
                title: '拨打失败',
                content: '电话拨打失败，请检查：\n1. 电话号码是否正确\n2. 设备是否有通话权限\n3. 是否支持通话功能',
                showCancel: false
              })
            }
          })
        }
      }
    })
  },

  // 导航到医院
  navigateToHospital: function(e) {
    var hospital = e.currentTarget.dataset.hospital
    console.log('导航到医院:', hospital.name)

    mapService.openNavigation(hospital)
  },

  // 重新定位
  retryLocation: function() {
    console.log('重新定位')
    this.initEmergencyPage()
  },

  // 切换其他医院显示（增强版）
  toggleOtherHospitals: function() {
    var newShowOther = !this.data.showOther

    // 添加震动反馈
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' })
    }

    this.setData({
      showOther: newShowOther
    })

    // 展开时显示提示
    if (newShowOther && this.data.otherHospitals.length > 3) {
      wx.showToast({
        title: '已展开全部医院',
        icon: 'none',
        duration: 1500
      })
    }
  },

  // 选择其他医院（增强版）
  selectHospital: function(e) {
    var hospital = e.currentTarget.dataset.hospital
    var self = this

    // 添加震动反馈
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'medium' })
    }

    // 显示确认对话框
    wx.showModal({
      title: '切换医院',
      content: '确定要切换到「' + hospital.name + '」吗？',
      confirmText: '确定切换',
      cancelText: '取消',
      success: function(res) {
        if (res.confirm) {
          // 将选中的医院设为最近医院
          self.setData({
            nearestHospital: hospital,
            showOther: false
          })

          wx.showToast({
            title: '✅ 已切换到：' + hospital.name,
            icon: 'success',
            duration: 2000
          })

          // 滚动到顶部
          wx.pageScrollTo({
            scrollTop: 0,
            duration: 300
          })
        }
      }
    })
  },

  // 返回首页
  goBack: function() {
    wx.navigateBack({
      fail: function() {
        // 如果无法返回，跳转到首页
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  }
})