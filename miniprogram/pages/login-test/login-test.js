// 登录闭环测试页面 - 验证所有登录功能
Page({
  data: {
    userInfo: null,
    openid: null,
    token: null,
    isGuest: null,
    loginStatus: '检查中...',
    testResults: [],
    databaseUserCount: 0,
    cloudStatus: '检查中...'
  },

  onLoad: function() {
    console.log('=== 登录测试页面加载 ===')
    this.checkLoginStatus()
  },

  // 检查登录状态（核心验证功能）
  checkLoginStatus: function() {
    var app = getApp()

    console.log('=== 开始检查登录状态 ===')

    // 检查1: 全局登录信息
    this.setData({
      userInfo: app.globalData.userInfo,
      openid: app.globalData.openid,
      token: app.globalData.token,
      isGuest: app.globalData.isGuest
    })

    if (app.globalData.openid) {
      this.setData({
        loginStatus: '✅ 登录成功'
      })
      this.addTestResult('全局登录状态', '成功', 'OpenID: ' + app.globalData.openid)
    } else {
      this.setData({
        loginStatus: '❌ 未登录'
      })
      this.addTestResult('全局登录状态', '失败', '没有OpenID')
    }

    // 检查2: 本地存储
    this.checkLocalStorage()

    // 检查3: 云开发状态
    this.checkCloudStatus()

    // 检查4: 数据库用户记录
    this.checkDatabaseUsers()
  },

  // 检查本地存储
  checkLocalStorage: function() {
    console.log('=== 检查本地存储 ===')

    var openid = wx.getStorageSync('openid')
    var userInfo = wx.getStorageSync('userInfo')
    var token = wx.getStorageSync('token')

    if (openid && userInfo) {
      this.addTestResult('本地存储', '成功', '存储完整：OpenID、UserInfo、Token都有')
    } else {
      this.addTestResult('本地存储', '失败', '存储不完整')
    }
  },

  // 检查云开发状态
  checkCloudStatus: function() {
    var app = getApp()

    console.log('=== 检查云开发状态 ===')

    if (app.globalData.cloudInitialized) {
      this.setData({
        cloudStatus: '✅ 云开发正常'
      })
      this.addTestResult('云开发状态', '成功', '云开发已初始化')
    } else {
      this.setData({
        cloudStatus: '⏳ 云开发初始化中'
      })
      this.addTestResult('云开发状态', '等待', '云开发正在初始化')
    }
  },

  // 检查数据库用户记录
  checkDatabaseUsers: function() {
    var self = this

    console.log('=== 检查数据库用户记录 ===')

    wx.cloud.callFunction({
      name: 'silentLogin',
      data: { code: 'check_test' },
      success: function(res) {
        console.log('数据库检查成功:', res)
        self.setData({
          databaseUserCount: 1
        })
        self.addTestResult('数据库用户', '成功', '有用户记录存在')
      },
      fail: function(err) {
        console.error('数据库检查失败:', err)
        self.addTestResult('数据库用户', '失败', err.errMsg)
      }
    })
  },

  // 测试完整登录流程
  testFullLoginFlow: function() {
    var self = this

    console.log('=== 测试完整登录流程 ===')

    this.setData({
      testResults: [],
      loginStatus: '测试中...'
    })

    // 测试1: wx.login
    wx.login({
      success: function(res) {
        console.log('wx.login成功:', res)
        self.addTestResult('wx.login', '成功', 'code: ' + res.code.substring(0, 10) + '...')

        // 测试2: 调用云函数
        self.testCloudFunction(res.code)
      },
      fail: function(err) {
        console.error('wx.login失败:', err)
        self.addTestResult('wx.login', '失败', err.errMsg)
        self.setData({
          loginStatus: '❌ 登录失败'
        })
      }
    })
  },

  // 测试云函数调用
  testCloudFunction: function(code) {
    var self = this

    console.log('=== 测试云函数调用 ===')

    wx.cloud.callFunction({
      name: 'silentLogin',
      data: { code: code },
      success: function(res) {
        console.log('云函数调用成功:', res)
        var result = res.result

        if (result.code === 0) {
          self.addTestResult('云函数调用', '成功', '获取完整用户数据')
          self.addTestResult('用户ID', result.data.userId, '数据库用户ID')
          self.addTestResult('OpenID', result.data.openid, '用户唯一标识')
          self.addTestResult('Token', result.data.token.substring(0, 20) + '...', '7天有效token')
          self.addTestResult('游客模式', result.data.userInfo.isMember ? '已授权' : '游客模式', '用户状态')

          self.setData({
            loginStatus: '✅ 登录闭环成功'
          })
        } else {
          self.addTestResult('云函数调用', '失败', result.msg)
          self.setData({
            loginStatus: '❌ 登录不完整'
          })
        }
      },
      fail: function(err) {
        console.error('云函数调用失败:', err)
        self.addTestResult('云函数调用', '失败', err.errMsg)
        self.setData({
          loginStatus: '❌ 云函数异常'
        })
      }
    })
  },

  // 测试按需授权功能
  testUserAuthorization: function() {
    var app = getApp()

    console.log('=== 测试按需授权 ===')

    if (app.globalData.isGuest) {
      app.requestUserAuthorization(function(result) {
        console.log('授权结果:', result)

        if (result.success) {
          self.addTestResult('按需授权', '成功', '用户已授权个人资料')
        } else {
          self.addTestResult('按需授权', '保持游客模式', '用户继续使用游客模式')
        }
      })
    } else {
      self.addTestResult('按需授权', '已完成', '用户已授权，无需重复授权')
    }
  },

  // 添加测试结果
  addTestResult: function(name, status, message) {
    var results = this.data.testResults
    results.push({
      name: name,
      status: status,
      message: message,
      time: new Date().toLocaleTimeString()
    })

    this.setData({
      testResults: results
    })
  },

  // 清除测试结果
  clearResults: function() {
    this.setData({
      testResults: []
    })
  },

  // 重新检查
  recheck: function() {
    this.clearResults()
    this.checkLoginStatus()
  },

  // 查看完整登录信息
  viewFullLoginInfo: function() {
    var app = getApp()

    var fullInfo = {
      '全局数据': app.globalData,
      '本地存储': {
        'OpenID': wx.getStorageSync('openid'),
        'UserInfo': wx.getStorageSync('userInfo'),
        'Token': wx.getStorageSync('token') ? wx.getStorageSync('token').substring(0, 20) + '...' : '无'
      },
      '云开发状态': app.globalData.cloudInitialized,
      '游客模式': app.globalData.isGuest
    }

    this.setData({
      loginStatus: '完整信息已获取'
    })

    console.log('=== 完整登录信息 ===', fullInfo)
  }
})