// app.js - 极简启动版本（优化性能）
App({
  onLaunch: function () {
    // 1. 极速初始化全局数据（同步，毫秒级）
    this.globalData = {
      userInfo: null,
      openid: null,
      cloudInitialized: false
    };

    console.log('=== 小程序启动，立即初始化云开发 ===')

    // 2. 立即启动云开发
    if (typeof wx !== 'undefined' && wx.cloud) {
      this.initCloudDevelopment()
    }

    // 3. 立即显示免责声明
    this.checkFirstLaunch()
  },

  // 异步初始化云开发
  initCloudDevelopment: function() {
    console.log('=== 开始初始化云开发 ===')
    console.log('云环境: cloud1-d8gdi44zqfec250b5')

    try {
      wx.cloud.init({
        env: 'cloud1-d8gdi44zqfec250b5',
        traceUser: true,
        success: function() {
          console.log('✅ 云开发初始化成功')
          this.globalData.cloudInitialized = true
        }.bind(this),
        fail: function(err) {
          console.log('❌ 云开发初始化失败:', err)
          this.globalData.cloudInitialized = false
        }.bind(this)
      })
    } catch (error) {
      console.log('❌ 云开发初始化异常:', error)
      this.globalData.cloudInitialized = false
    }
  },

  checkFirstLaunch() {
    const hasLaunched = wx.getStorageSync('hasLaunched')
    if (!hasLaunched) {
      wx.showModal({
        title: '重要提示',
        content: '本工具仅为宠物健康风险评估参考，不能替代执业兽医的专业诊断与治疗。使用本工具即表示您已了解并同意此免责声明。',
        showCancel: false,
        confirmText: '我已了解',
        success: () => {
          wx.setStorageSync('hasLaunched', true)
        }
      })
    }
  }
})