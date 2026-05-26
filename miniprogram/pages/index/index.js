// 首页逻辑 - 极简版本
const app = getApp()

Page({
  data: {
    nearbyHospitals: [
      { id: 1, name: '爱心宠物医院', distance: '0.5' },
      { id: 2, name: '宠物中心医院', distance: '1.2' },
      { id: 3, name: '萌宠宠物诊所', distance: '2.0' }
    ]
  },

  onLoad() {
    // 移除console.log，减少日志输出
  },

  // 跳转到急救通道（修复：使用switchTab）
  toEmergency() {
    console.log('点击急救按钮')
    try {
      wx.switchTab({
        url: '/pages/emergency/index',
        success: function() {
          console.log('跳转急救页面成功')
        },
        fail: function(err) {
          console.error('跳转急救页面失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      console.error('急救按钮点击异常:', error)
    }
  },

  // 跳转到症状自查（修复：使用switchTab）
  toSymptom() {
    console.log('点击症状自查按钮')
    try {
      wx.switchTab({
        url: '/pages/symptom/guide',
        success: function() {
          console.log('跳转症状自查成功')
        },
        fail: function(err) {
          console.error('跳转症状自查失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      console.error('症状自查按钮点击异常:', error)
    }
  },

  // 跳转到就医导航（修复：使用switchTab）
  toHospital() {
    console.log('点击医院导航按钮')
    try {
      wx.switchTab({
        url: '/pages/hospital/list',
        success: function() {
          console.log('跳转医院导航成功')
        },
        fail: function(err) {
          console.error('跳转医院导航失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      console.error('医院导航按钮点击异常:', error)
    }
  }
})