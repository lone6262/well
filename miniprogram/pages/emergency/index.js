// 急救通道页面逻辑 - ES5完全兼容版本
var app = getApp()
var mapService = require('../../utils/mapService.js')

Page({
  data: {
    isLoading: false,
    hasLocation: false,
    latitude: 39.90469,
    longitude: 116.40717,
    hospitals: [],
    showMap: true
  },

  onLoad: function() {
    console.log('急救通道页面加载')
    this.getLocation()
  },

  // 返回首页
  goBack: function() {
    wx.navigateBack()
  },

  // 获取位置
  getLocation: function() {
    this.setData({ isLoading: true })

    var self = this;
    wx.getLocation({
      type: 'gcj02',
      success: function(res) {
        self.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          hasLocation: true,
          isLoading: false
        })
        self.loadNearbyHospitals()
      },
      fail: function() {
        console.error('获取位置失败')
        self.setData({ isLoading: false })
        self.loadNearbyHospitals()
      }
    })
  },

  // 加载附近医院（ES5兼容版本）
  loadNearbyHospitals: function() {
    wx.showLoading({ title: '加载中...' })

    var self = this;
    mapService.searchNearbyHospitals(
      this.data.latitude,
      this.data.longitude,
      5000
    ).then(function(hospitals) {
      wx.hideLoading()

      // ES5兼容的数组处理
      var emergencyHospitals = [];
      var filteredHospitals = [];
      var i;

      // 过滤24小时医院
      for (i = 0; i < hospitals.length; i++) {
        if (hospitals[i].is24h) {
          filteredHospitals.push(hospitals[i]);
        }
      }

      // 按距离排序
      filteredHospitals.sort(function(a, b) {
        return a.distance - b.distance;
      });

      // 取前10个
      for (i = 0; i < Math.min(10, filteredHospitals.length); i++) {
        emergencyHospitals.push(filteredHospitals[i]);
      }

      self.setData({ hospitals: emergencyHospitals })

      if (hospitals[0] && hospitals[0].hospitalId.indexOf('mock_') === 0) {
        wx.showToast({
          title: '当前为模拟数据',
          icon: 'none',
          duration: 2000
        })
      }

      self.createMapMarkers()
    }).catch(function(error) {
      wx.hideLoading()
      console.error('加载医院失败:', error)
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
    })
  },

  // 创建地图标记点（ES5完全兼容版本）
  createMapMarkers: function() {
    if (!this.data.hospitals || this.data.hospitals.length === 0) {
      return
    }

    var self = this;
    var markers = [];
    var i;

    // ES5兼容的map操作
    for (i = 0; i < this.data.hospitals.length; i++) {
      var hospital = this.data.hospitals[i];
      markers.push({
        id: i + 1, // 修复：使用数字ID
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        title: hospital.name,
        // 移除iconPath，使用系统默认标记
        width: 30,
        height: 30,
        callout: {
          content: hospital.name,
          display: 'ALWAYS',
          fontSize: 12,
          borderRadius: 4,
          bgColor: '#fff',
          padding: 4
        }
      });
    }

    // 添加当前位置标记（使用ID 0）
    markers.unshift({
      id: 0, // 修复：使用数字ID
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      title: '我的位置',
      // 移除iconPath，使用系统默认标记
      width: 20,
      height: 20
    });

    self.setData({
      hospitalMarkers: markers
    });
  },

  // 点击地图标记
  onMarkerTap: function(e) {
    var hospitalId = e.detail.markerId
    var hospital = null
    var i

    // ES5兼容的find操作
    for (i = 0; i < this.data.hospitals.length; i++) {
      if (this.data.hospitals[i].hospitalId === hospitalId) {
        hospital = this.data.hospitals[i]
        break
      }
    }

    if (hospital) {
      this.highlightHospital({ currentTarget: { dataset: { hospital: hospital } } })
    }
  },

  // 高亮医院卡片
  highlightHospital: function(e) {
    var hospital = e.currentTarget.dataset.hospital
    console.log('选中医院:', hospital.name)
  },

  // 搜索所有医院
  searchAllHospitals: function() {
    wx.navigateTo({
      url: '/pages/hospital/list'
    })
  },

  // 拨打电话
  callHospital: function(e) {
    var phone = e.currentTarget.dataset.phone
    mapService.makePhoneCall(phone)
  },

  // 导航到医院
  navigateToHospital: function(e) {
    var hospital = e.currentTarget.dataset.hospital
    mapService.openNavigation(hospital)
  }
})