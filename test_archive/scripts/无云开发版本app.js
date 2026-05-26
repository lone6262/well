// app.js - 无云开发版本，彻底解决timeout问题
App({
  onLaunch: function () {
    console.log('小程序启动开始')

    // 初始化全局数据（无云开发模式）
    this.globalData = {
      env: "", // 禁用云开发
      userInfo: null,
      openid: null,
      localMode: true, // 直接启用本地模式
      networkStatus: 'unknown'
    };

    console.log('全局数据初始化完成')
    console.log('🔄 本地模式已启用（跳过云开发初始化）')

    // 检查网络状态
    this.checkNetworkStatus()

    // 检查是否首次启动
    this.checkFirstLaunch()

    console.log('小程序启动完成')
  },

  // 网络状态检查
  checkNetworkStatus() {
    if (wx.getNetworkType) {
      wx.getNetworkType({
        success: (res) => {
          this.globalData.networkStatus = res.networkType
          console.log('当前网络类型:', res.networkType)
        },
        fail: () => {
          console.log('无法获取网络类型')
          this.globalData.networkStatus = 'unknown'
        }
      })
    }

    // 监听网络状态变化
    if (wx.onNetworkStatusChange) {
      wx.onNetworkStatusChange((res) => {
        this.globalData.networkStatus = res.isConnected ? res.networkType : 'none'
        console.log('网络状态变化:', this.globalData.networkStatus)
      })
    }
  },

  // 检查是否首次启动
  checkFirstLaunch() {
    setTimeout(() => {
      try {
        const hasLaunched = wx.getStorageSync('hasLaunched')
        if (!hasLaunched) {
          console.log('首次启动，显示免责声明')
          wx.showModal({
            title: '重要提示',
            content: '本工具仅为宠物健康风险评估参考，不能替代执业兽医的专业诊断与治疗。使用本工具即表示您已了解并同意此免责声明。',
            showCancel: false,
            confirmText: '我已了解',
            success: () => {
              try {
                wx.setStorageSync('hasLaunched', true)
                console.log('用户已同意免责声明')
              } catch (err) {
                console.error('存储免责声明失败:', err)
              }
            },
            fail: () => {
              console.log('免责声明弹窗失败')
            }
          })
        } else {
          console.log('非首次启动，跳过免责声明')
        }
      } catch (error) {
        console.error('检查首次启动失败:', error)
      }
    }, 500)
  },

  // 本地数据存储（替代云数据库）
  saveLocalData(key, data) {
    try {
      wx.setStorageSync(key, data)
      console.log('✅ 本地数据存储成功:', key)
      return true
    } catch (error) {
      console.error('❌ 本地数据存储失败:', error)
      return false
    }
  },

  // 本地数据获取（替代云数据库）
  getLocalData(key) {
    try {
      const data = wx.getStorageSync(key)
      console.log('✅ 本地数据获取成功:', key)
      return data
    } catch (error) {
      console.error('❌ 本地数据获取失败:', error)
      return null
    }
  },

  // 检查云开发是否可用（用于兼容）
  isCloudAvailable() {
    return false // 无云开发版本，直接返回false
  },

  // 兼容性方法：模拟云开发调用
  cloudCall(options) {
    console.log('⚠️ 云开发调用已重定向到本地模式')

    // 如果是数据库操作，重定向到本地存储
    if (options.collection) {
      const localData = this.getLocalData(options.collection) || []
      return Promise.resolve({
        result: localData,
        errMsg: 'cloud.callFunction:ok (local mode)'
      })
    }

    // 其他操作直接返回成功
    return Promise.resolve({
      result: { success: true, mode: 'local' },
      errMsg: 'cloud.callFunction:ok (local mode)'
    })
  }
})