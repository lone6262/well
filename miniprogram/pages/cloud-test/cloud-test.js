// 云开发启动验证页面
Page({
  data: {
    cloudStatus: '检查中...',
    envId: '',
    testResults: [],
    isTesting: false
  },

  onLoad: function() {
    console.log('=== 云开发验证页面加载 ===')
    this.checkCloudStatus()
  },

  // 检查云开发状态
  checkCloudStatus: function() {
    var app = getApp()

    console.log('=== 检查云开发状态 ===')
    console.log('app.globalData.cloudInitialized:', app.globalData.cloudInitialized)

    this.setData({
      envId: 'cloud1-d8gdi44zqfec250b5'
    })

    if (typeof wx !== 'undefined' && wx.cloud) {
      if (app.globalData.cloudInitialized) {
        this.setData({
          cloudStatus: '✅ 云开发已启动'
        })
        this.addTestResult('云开发状态', '成功', '云开发已正确初始化')
      } else {
        this.setData({
          cloudStatus: '⏳ 云开发初始化中...'
        })
        this.addTestResult('云开发状态', '等待', '云开发正在初始化，请稍后')
      }
    } else {
      this.setData({
        cloudStatus: '❌ 云开发不可用'
      })
      this.addTestResult('云开发状态', '失败', 'wx.cloud 对象不存在')
    }
  },

  // 测试云开发初始化
  testCloudInit: function() {
    var self = this

    console.log('=== 测试云开发初始化 ===')

    this.setData({
      isTesting: true,
      cloudStatus: '⏳ 正在测试...'
    })

    try {
      wx.cloud.init({
        env: 'cloud1-d8gdi44zqfec250b5',
        traceUser: true,
        success: function() {
          console.log('✅ 云开发初始化成功')
          self.setData({
            cloudStatus: '✅ 云开发启动成功'
          })
          self.addTestResult('云开发初始化', '成功', '环境ID: cloud1-d8gdi44zqfec250b5')
          self.setData({
            isTesting: false
          })

          wx.showToast({
            title: '启动成功',
            icon: 'success'
          })
        },
        fail: function(err) {
          console.error('❌ 云开发初始化失败:', err)
          self.setData({
            cloudStatus: '❌ 云开发启动失败'
          })
          self.addTestResult('云开发初始化', '失败', JSON.stringify(err))
          self.setData({
            isTesting: false
          })

          wx.showToast({
            title: '启动失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      console.error('❌ 云开发初始化异常:', error)
      self.setData({
        cloudStatus: '❌ 云开发启动异常'
      })
      self.addTestResult('云开发初始化', '异常', error.message)
      self.setData({
        isTesting: false
      })
    }
  },

  // 测试数据库连接
  testDatabase: function() {
    var self = this

    console.log('=== 测试数据库连接 ===')

    const db = wx.cloud.database()

    db.collection('test').count().then({
      success: function(res) {
        console.log('✅ 数据库连接成功:', res)
        self.addTestResult('数据库连接', '成功', '可以正常访问数据库')
      },
      fail: function(err) {
        console.error('❌ 数据库连接失败:', err)
        self.addTestResult('数据库连接', '失败', err.errMsg)
      }
    })
  },

  // 测试云函数调用
  testCloudFunction: function() {
    var self = this

    console.log('=== 测试云函数调用 ===')

    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: function(res) {
        console.log('✅ 云函数调用成功:', res)
        self.addTestResult('云函数调用', '成功', 'login云函数调用成功')
      },
      fail: function(err) {
        console.error('❌ 云函数调用失败:', err)
        self.addTestResult('云函数调用', '失败', err.errMsg)
      }
    })
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
    this.checkCloudStatus()
  }
})
