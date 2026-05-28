// 用户中心页面逻辑 - ES5完全兼容版本
var app = getApp()

Page({
  data: {
    userInfo: {
      nickname: '',
      avatar: '',
      isMember: false
    },
    userStats: {
      checkCount: 0,
      reportCount: 0,
      petCount: 0,
      orderCount: 0,
      favoriteCount: 0
    },
    userPets: [],
    appVersion: '1.0.0'
  },

  onLoad: function() {
    this.loadUserInfo()
  },

  onShow: function() {
    this.loadUserInfo()
  },

  // 加载用户信息
  loadUserInfo: function() {
    var userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {}

    this.setData({
      userInfo: {
        nickname: userInfo.nickname || '宠物爱好者',
        avatar: userInfo.avatar || '/images/avatar.png',
        isMember: userInfo.isMember || false,
        isLoggedIn: !!userInfo.nickname
      }
    })

    // 加载用户统计数据
    this.loadUserStats()

    // 加载用户宠物信息
    this.loadUserPets()
  },

  // 加载用户统计数据
  loadUserStats: function() {
    var userStats = wx.getStorageSync('userStats') || {
      checkCount: 0,
      reportCount: 0,
      petCount: 0,
      orderCount: 0,
      favoriteCount: 0
    }

    this.setData({
      userStats: userStats
    })
  },

  // 加载用户宠物信息
  loadUserPets: function() {
    var userPets = wx.getStorageSync('userPets') || []

    this.setData({
      userPets: userPets
    })
  },

  // 用户登录
  login: function() {
    var self = this

    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: function(res) {
        var userInfo = res.userInfo

        // 保存用户信息到全局和本地存储
        app.globalData.userInfo = userInfo
        wx.setStorageSync('userInfo', userInfo)

        self.setData({
          userInfo: {
            nickname: userInfo.nickName,
            avatar: userInfo.avatarUrl,
            isMember: true,
            isLoggedIn: true
          }
        })

        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })

        // 调用云函数记录用户登录
        self.recordUserLogin(userInfo)
      },
      fail: function() {
        wx.showModal({
          title: '提示',
          content: '需要授权才能使用完整功能',
          showCancel: false
        })
      }
    })
  },

  // 记录用户登录到本地存储（云开发已禁用）
  recordUserLogin: function(userInfo) {
    // 使用本地存储记录用户登录，替代云函数
    var loginRecord = {
      nickname: userInfo.nickName,
      avatar: userInfo.avatarUrl,
      loginTime: new Date().toISOString(),
      loginTimeStr: new Date().toLocaleString()
    }

    // 获取历史登录记录
    var loginHistory = wx.getStorageSync('loginHistory') || []

    // 添加新的登录记录
    loginHistory.push(loginRecord)

    // 保存到本地存储
    wx.setStorageSync('loginHistory', loginHistory)

    // 只保留最近10条记录
    if (loginHistory.length > 10) {
      wx.setStorageSync('loginHistory', loginHistory.slice(-10))
    }

    console.log('用户登录记录已保存到本地', loginRecord)
  },

  // 用户退出登录
  logout: function() {
    var self = this

    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: function(res) {
        if (res.confirm) {
          // 清除用户信息
          app.globalData.userInfo = {}
          wx.removeStorageSync('userInfo')

          self.setData({
            userInfo: {
              nickname: '宠物爱好者',
              avatar: '/images/avatar.png',
              isMember: false,
              isLoggedIn: false
            }
          })

          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })
        }
      }
    })
  },

  // 查看自查记录
  viewHistory: function() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 查看我的报告
  viewReports: function() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 查看宠物档案
  viewPets: function() {
    if (!this.data.userInfo.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false
      })
      return
    }

    wx.navigateTo({
      url: '/pages/pet/profile'
    })
  },

  // 查看收藏医院
  viewFavorites: function() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 更换头像
  changeAvatar: function() {
    if (!this.data.userInfo.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false
      })
      return
    }

    var self = this

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        var tempFilePath = res.tempFilePaths[0]

        // 更新头像
        var userInfo = self.data.userInfo
        userInfo.avatar = tempFilePath

        self.setData({
          userInfo: userInfo
        })

        // 保存到本地存储
        wx.setStorageSync('userInfo', userInfo)
        app.globalData.userInfo = userInfo

        wx.showToast({
          title: '头像已更新',
          icon: 'success'
        })
      }
    })
  },

  // 查看所有宠物
  viewAllPets: function() {
    wx.navigateTo({
      url: '/pages/pet/profile'
    })
  },

  // 查看宠物详情
  viewPetDetail: function(e) {
    var pet = e.currentTarget.dataset.pet

    wx.navigateTo({
      url: '/pages/pet/profile?petId=' + pet.petId
    })
  },

  // 添加新宠物
  addNewPet: function() {
    wx.navigateTo({
      url: '/pages/pet/profile?action=add'
    })
  },

  // 设置
  settings: function() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 查看我的订单
  viewOrders: function() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 分享应用
  shareApp: function() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })

    wx.showToast({
      title: '点击右上角分享',
      icon: 'none'
    })
  },

  // 联系我们
  contactUs: function() {
    wx.showModal({
      title: '联系我们',
      content: '客服微信：pet-care-support\n工作时间：9:00-18:00',
      showCancel: false
    })
  },

  // 关于我们
  about: function() {
    wx.showModal({
      title: '关于我们',
      content: '宠物症状自查小程序\n版本：V1.0\n\n致力于帮助宠物主人快速识别健康问题，提供专业的就医指导。',
      showCancel: false
    })
  },

  // 分享配置
  onShareAppMessage: function() {
    return {
      title: '宠物症状自查 - 守护您的宠物健康',
      path: '/pages/index/index',
      imageUrl: '/images/share-cover.png'
    }
  }
})