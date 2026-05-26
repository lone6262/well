// 医院列表页面逻辑 - ES5完全兼容版本
var app = getApp()
var mapService = require('../../utils/mapService.js')

Page({
  data: {
    hospitals: [],
    hasMore: false,
    page: 1,
    latitude: 39.90469,  // 默认北京天安门
    longitude: 116.40717,
    isLoading: false
  },

  onLoad: function() {
    this.getLocationAndLoad()
  },

  onPullDownRefresh: function() {
    this.setData({ page: 1, hospitals: [] })
    this.loadHospitals()
    wx.stopPullDownRefresh()
  },

  // 获取位置并加载医院
  getLocationAndLoad: function() {
    this.setData({ isLoading: true })

    var self = this
    wx.getLocation({
      type: 'gcj02',
      success: function(res) {
        self.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          isLoading: false
        })
        self.loadHospitals()
      },
      fail: function() {
        // 使用默认位置（北京天安门）
        self.setData({
          latitude: 39.90469,
          longitude: 116.40717,
          isLoading: false
        })
        self.loadHospitals()
      }
    })
  },

  // 加载医院列表（使用地图服务）
  loadHospitals() {
    var self = this;
    try {
      wx.showLoading({ title: '加载中...' })

      // 使用地图服务搜索附近医院
      mapService.searchNearbyHospitals(
        this.data.latitude,
        this.data.longitude,
        5000  // 搜索半径5公里
      ).then(function(hospitals) {
        wx.hideLoading()

        // 格式化距离显示（将米转换为公里）- ES5兼容版本
        var formattedHospitals = [];
        var i;
        for (i = 0; i < hospitals.length; i++) {
          var hospital = hospitals[i];
          var distanceDisplay = hospital.distance >= 1000
            ? (hospital.distance / 1000).toFixed(1) + 'km'
            : hospital.distance + 'm';

          formattedHospitals.push({
            hospitalId: hospital.hospitalId,
            name: hospital.name,
            address: hospital.address,
            phone: hospital.phone,
            distance: hospital.distance,
            distanceDisplay: distanceDisplay,
            latitude: hospital.latitude,
            longitude: hospital.longitude,
            is24h: hospital.is24h,
            location: {
              latitude: hospital.latitude,
              longitude: hospital.longitude
            }
          });
        }

        self.setData({
          hospitals: formattedHospitals,
          hasMore: false
        })

        // 提示数据来源
        if (hospitals[0] && hospitals[0].hospitalId.indexOf('mock_') === 0) {
          wx.showToast({
            title: '当前为模拟数据',
            icon: 'none',
            duration: 2000
          })
        }

      }).catch(function(error) {
        wx.hideLoading()
        console.error('加载医院失败:', error)
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        })
      })

    } catch (error) {
      wx.hideLoading()
      console.error('加载医院异常:', error)
      wx.showToast({
        title: '加载异常，请重试',
        icon: 'none'
      })
    }
  },

  // 加载更多
  loadMore: function() {
    if (this.data.hasMore) {
      this.setData({ page: this.data.page + 1 })
      this.loadHospitals()
    }
  },

  // 拨打电话
  callHospital: function(e) {
    var phone = e.currentTarget.dataset.phone
    mapService.makePhoneCall(phone)
  },

  // 导航
  navigateToHospital: function(e) {
    var hospital = e.currentTarget.dataset.hospital
    mapService.openNavigation(hospital)
  }
})