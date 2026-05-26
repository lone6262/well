// 测试登录页面
Page({
  data: {
    loginResult: '',
    userInfo: null,
    loading: false
  },

  onLoad: function() {
    console.log('=== 测试登录页面加载 ===')
  },

  // 快速测试登录
  quickLogin: function() {
    var self = this

    console.log('=== 开始快速登录 ===')

    this.setData({
      loading: true,
      loginResult: '正在登录...'
    })

    // 调用快速登录云函数
    wx.cloud.callFunction({
      name: 'quickLogin',
      data: {
        userInfo: {
          nickName: '测试用户' + Date.now(),
          avatarUrl: 'https://via.placeholder.com/100'
        }
      },
      success: function(res) {
        console.log('✅ 登录成功:', res)
        var result = res.result

        if (result.code === 0) {
          self.setData({
            loginResult: '✅ 登录成功！用户ID: ' + result.data.userId,
            userInfo: result.data.userInfo,
            loading: false
          })

          // 保存用户信息到本地
          wx.setStorageSync('userInfo', result.data.userInfo)
          wx.setStorageSync('openid', result.data.openid)

          wx.showToast({
            title: '登录成功',
            icon: 'success'
          })
        } else {
          self.setData({
            loginResult: '❌ 登录失败: ' + result.msg,
            loading: false
          })
        }
      },
      fail: function(err) {
        console.error('❌ 登录失败:', err)
        self.setData({
          loginResult: '❌ 云函数调用失败: ' + err.errMsg,
          loading: false
        })

        wx.showToast({
          title: '登录失败',
          icon: 'none'
        })
      }
    })
  },

  // 检查数据库用户
  checkUsers: function() {
    var self = this

    console.log('=== 检查数据库用户 ===')

    wx.cloud.callFunction({
      name: 'dbInit',
      data: {},
      success: function(res) {
        console.log('✅ 数据库检查成功:', res)
        self.setData({
          loginResult: '✅ 数据库检查成功: ' + JSON.stringify(res.result)
        })
      },
      fail: function(err) {
        console.error('❌ 数据库检查失败:', err)
        self.setData({
          loginResult: '❌ 数据库检查失败: ' + err.errMsg
        })
      }
    })
  },

  // 清除本地数据
  clearLocal: function() {
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('openid')

    this.setData({
      loginResult: '✅ 本地数据已清除',
      userInfo: null
    })

    wx.showToast({
      title: '清除成功',
      icon: 'success'
    })
  }
})
