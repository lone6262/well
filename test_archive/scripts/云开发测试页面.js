// 云开发测试页面
Page({
  data: {
    cloudStatus: '检查中...',
    cloudFunctions: [],
    testResult: ''
  },

  onLoad: function() {
    this.checkCloudStatus()
  },

  // 检查云开发状态
  checkCloudStatus: function() {
    var app = getApp()

    if (app.globalData.cloudInitialized) {
      this.setData({
        cloudStatus: '✅ 云开发已启动'
      })
    } else {
      this.setData({
        cloudStatus: '❌ 云开发未启动'
      })
    }
  },

  // 测试云函数调用
  testCloudFunction: function(functionName) {
    var self = this

    wx.showLoading({
      title: '测试中...'
    })

    wx.cloud.callFunction({
      name: functionName,
      data: {},
      success: function(res) {
        wx.hideLoading()
        console.log('云函数调用成功:', res)

        self.setData({
          testResult: '✅ ' + functionName + ' 调用成功: ' + JSON.stringify(res.result)
        })

        wx.showToast({
          title: '调用成功',
          icon: 'success'
        })
      },
      fail: function(err) {
        wx.hideLoading()
        console.error('云函数调用失败:', err)

        self.setData({
          testResult: '❌ ' + functionName + ' 调用失败: ' + err.errMsg
        })

        wx.showToast({
          title: '调用失败',
          icon: 'none'
        })
      }
    })
  },

  // 测试getPetList云函数
  testGetPetList: function() {
    this.testCloudFunction('getPetList')
  },

  // 测试login云函数
  testLogin: function() {
    this.testCloudFunction('login')
  },

  // 查看云开发详细信息
  viewCloudInfo: function() {
    var app = getApp()

    var cloudInfo = {
      cloudInitialized: app.globalData.cloudInitialized,
      userInfo: app.globalData.userInfo,
      openid: app.globalData.openid
    }

    this.setData({
      testResult: '📋 云开发信息: ' + JSON.stringify(cloudInfo, null, 2)
    })
  }
})
