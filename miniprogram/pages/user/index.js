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

  // 加载用户信息 - 统一使用app.js的登录状态
  loadUserInfo: function() {
    // 检查登录状态（使用统一的登录检查方法）
    var openid = app.getOpenid()
    var userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {}

    // 修复：只要openid存在就认为是已登录，不依赖nickName
    var isLoggedIn = !!openid

    console.log('用户中心 - 登录状态检查:', {
      openid: openid,
      userInfo: userInfo,
      isLoggedIn: isLoggedIn,
      isGuest: app.globalData.isGuest,
      cloudDevelopmentAvailable: app.globalData.cloudDevelopmentAvailable
    })

    this.setData({
      userInfo: {
        nickname: userInfo.nickName || '宠物爱好者',
        avatar: userInfo.avatarUrl || '/images/avatar.png',
        isMember: !!userInfo.isMember,
        isLoggedIn: isLoggedIn
      }
    })

    // 加载用户统计数据
    this.loadUserStats()

    // 加载用户宠物信息
    if (isLoggedIn) {
      this.loadUserPets()
    } else {
      this.setData({
        userPets: []
      })
    }
  },

  // 加载用户统计数据 - 从云端获取
  loadUserStats: function() {
    var self = this
    var openid = app.getOpenid()

    if (!openid) {
      console.log('用户未登录，使用默认统计数据')
      self.setData({
        userStats: {
          checkCount: 0,
          reportCount: 0,
          petCount: 0,
          orderCount: 0,
          favoriteCount: 0
        }
      })
      return
    }

    console.log('从云端加载用户统计数据...')

    // 检查云开发是否可用
    if (!app.globalData.cloudDevelopmentAvailable) {
      console.log('云开发不可用，使用本地统计数据')
      self.loadLocalStats()
      return
    }

    wx.cloud.callFunction({
      name: 'getUserStats', // 需要创建这个云函数
      data: {
        openid: openid
      },
      success: function(res) {
        console.log('用户统计数据加载成功:', res.result)

        if (res.result.code === 0) {
          var stats = res.result.data

          self.setData({
            userStats: {
              checkCount: stats.checkCount || 0,
              reportCount: stats.reportCount || 0,
              petCount: stats.petCount || 0,
              orderCount: stats.orderCount || 0,
              favoriteCount: stats.favoriteCount || 0
            }
          })

          // 保存到本地存储
          wx.setStorageSync('userStats', self.data.userStats)
        } else {
          console.log('云函数返回错误，使用本地数据')
          self.loadLocalStats()
        }
      },
      fail: function(err) {
        console.error('用户统计数据加载失败:', err)
        self.loadLocalStats()
      }
    })
  },

  // 从本地存储加载统计数据（降级方案）
  loadLocalStats: function() {
    var self = this
    var userStats = wx.getStorageSync('userStats') || {
      checkCount: 0,
      reportCount: 0,
      petCount: 0,
      orderCount: 0,
      favoriteCount: 0
    }

    // 从本地宠物数据计算宠物数量
    var localPets = wx.getStorageSync('localPets') || []
    userStats.petCount = localPets.length

    self.setData({
      userStats: userStats
    })

    console.log('使用本地统计数据:', userStats)
  },

  // 加载用户宠物信息 - 从云端获取
  loadUserPets: function() {
    var self = this
    var openid = app.getOpenid()

    if (!openid) {
      console.log('用户未登录')
      self.setData({
        userPets: []
      })
      return
    }

    console.log('从云端加载用户宠物信息...')

    // 检查云开发是否可用
    if (!app.globalData.cloudDevelopmentAvailable) {
      console.log('云开发不可用，使用本地宠物数据')
      self.loadLocalPets()
      return
    }

    wx.cloud.callFunction({
      name: 'getPetList',
      data: {
        openid: openid
      },
      success: function(res) {
        console.log('用户宠物加载成功:', res.result)

        if (res.result.code === 0 && res.result.data.petList) {
          var userPets = res.result.data.petList.map(function(pet) {
            return {
              id: pet.petId,
              petId: pet.petId,
              name: pet.name,
              emoji: pet.type === 'cat' ? '🐱' : '🐶',
              type: pet.type,
              age: pet.age + '个月',
              gender: pet.gender === 'male' ? '弟弟' : '妹妹',
              healthStatus: pet.healthStatus,
              avatar: pet.avatar || ''
            }
          })

          self.setData({
            userPets: userPets
          })

          // 更新统计数据中的宠物数量
          var currentUserStats = self.data.userStats
          currentUserStats.petCount = userPets.length
          self.setData({
            userStats: currentUserStats
          })

          // 保存到本地存储
          wx.setStorageSync('userPets', userPets)
        } else {
          console.log('云端宠物数据为空，使用本地数据')
          self.loadLocalPets()
        }
      },
      fail: function(err) {
        console.error('用户宠物加载失败:', err)
        self.loadLocalPets()
      }
    })
  },

  // 从本地存储加载宠物数据（降级方案）
  loadLocalPets: function() {
    var self = this

    // 优先使用本地存储的宠物数据
    var localPets = wx.getStorageSync('userPets') || []

    if (localPets.length > 0) {
      console.log('从本地存储加载宠物数据:', localPets)
      self.setData({
        userPets: localPets
      })

      // 更新统计数据
      var userStats = self.data.userStats
      userStats.petCount = localPets.length
      self.setData({
        userStats: userStats
      })
    } else {
      // 如果本地存储也没有，使用模拟数据
      console.log('本地存储为空，使用演示数据')
      var mockPets = [
        {
          id: 'mock_1',
          petId: 'mock_1',
          name: '小白',
          emoji: '🐱',
          type: 'cat',
          age: '2个月',
          gender: '弟弟',
          healthStatus: 'good'
        },
        {
          id: 'mock_2',
          petId: 'mock_2',
          name: '大黄',
          emoji: '🐶',
          type: 'dog',
          age: '3个月',
          gender: '妹妹',
          healthStatus: 'warning'
        }
      ]

      self.setData({
        userPets: mockPets
      })

      // 更新统计数据
      var userStats = self.data.userStats
      userStats.petCount = mockPets.length
      self.setData({
        userStats: userStats
      })
    }
  },

  // 用户登录 - 统一使用app.js的登录系统
  login: function() {
    var self = this

    // 检查是否已经登录（有openid）
    if (app.getOpenid()) {
      console.log('用户已经通过静默登录，直接获取用户资料')
      // 已有openid，直接获取用户资料
      app.requestUserAuthorization(function(result) {
        if (result.success) {
          console.log('用户资料获取成功:', result.userInfo)
          self.loadUserInfo()
        } else {
          console.log('用户拒绝授权或获取失败，仍是游客模式')
          self.loadUserInfo()
        }
      })
    } else {
      // 还没有openid，等待静默登录完成
      console.log('等待静默登录完成...')

      // 显示登录中提示
      wx.showLoading({
        title: '登录中...',
        mask: true
      })

      // 注册登录完成回调
      app.onLoginComplete(function(openid) {
        wx.hideLoading()
        console.log('静默登录完成，openid:', openid)

        // 静默登录完成后，获取用户资料
        app.requestUserAuthorization(function(result) {
          if (result.success) {
            console.log('用户资料获取成功:', result.userInfo)
            self.loadUserInfo()
            wx.showToast({
              title: '登录成功',
              icon: 'success'
            })
          } else {
            console.log('用户拒绝授权或获取失败，仍是游客模式')
            self.loadUserInfo()
          }
        })
      })

      // 如果3秒后还没有登录完成，隐藏loading
      setTimeout(function() {
        wx.hideLoading()
      }, 3000)
    }
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

  // 用户退出登录 - 统一清理登录状态
  logout: function() {
    var self = this

    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: function(res) {
        if (res.confirm) {
          // 清除所有登录相关信息
          app.globalData.userInfo = null
          app.globalData.openid = null
          app.globalData.token = null
          app.globalData.isGuest = true

          // 清除本地存储
          wx.removeStorageSync('userInfo')
          wx.removeStorageSync('openid')
          wx.removeStorageSync('token')
          wx.removeStorageSync('isGuest')

          self.setData({
            userInfo: {
              nickname: '宠物爱好者',
              avatar: '/images/avatar.png',
              isMember: false,
              isLoggedIn: false
            },
            userPets: []
          })

          console.log('用户已退出登录，所有登录状态已清除')

          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          })

          // 通知其他页面更新状态
          app.globalData.petsUpdated = true
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

  // 更换头像 - 增强版
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
        console.log('用户选择头像:', tempFilePath)

        // 显示上传中
        wx.showLoading({
          title: '更新中...',
          mask: true
        })

        // 检查是否可以使用云存储
        if (app.globalData.cloudDevelopmentAvailable) {
          // 上传到云存储
          self.uploadAvatarToCloud(tempFilePath)
        } else {
          // 本地存储模式
          self.updateAvatarLocal(tempFilePath)
        }
      }
    })
  },

  // 上传头像到云存储
  uploadAvatarToCloud: function(filePath) {
    var self = this

    var cloudPath = 'user-avatars/' + app.getOpenid() + '_' + Date.now() + '.jpg'

    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: function(res) {
        console.log('头像上传成功:', res.fileID)
        wx.hideLoading()

        // 更新用户头像
        var userInfo = self.data.userInfo
        userInfo.avatar = res.fileID
        userInfo.avatarUrl = res.fileID

        self.setData({
          userInfo: userInfo
        })

        // 保存到全局和本地存储
        app.globalData.userInfo = userInfo
        wx.setStorageSync('userInfo', userInfo)

        wx.showToast({
          title: '头像已更新',
          icon: 'success'
        })

        // 同步到云端用户信息
        self.syncUserInfoToCloud(userInfo)
      },
      fail: function(err) {
        console.error('头像上传失败:', err)
        wx.hideLoading()

        // 失败时使用本地存储
        self.updateAvatarLocal(filePath)
      }
    })
  },

  // 本地存储头像更新
  updateAvatarLocal: function(filePath) {
    var self = this

    wx.hideLoading()

    // 更新用户头像
    var userInfo = self.data.userInfo
    userInfo.avatar = filePath
    userInfo.avatarUrl = filePath

    self.setData({
      userInfo: userInfo
    })

    // 保存到全局和本地存储
    app.globalData.userInfo = userInfo
    wx.setStorageSync('userInfo', userInfo)

    wx.showToast({
      title: '头像已更新（本地模式）',
      icon: 'success'
    })
  },

  // 修改昵称 - 新增功能
  editNickname: function() {
    var self = this

    if (!self.data.userInfo.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false
      })
      return
    }

    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: self.data.userInfo.nickname || '请输入昵称',
      success: function(res) {
        if (res.confirm && res.content) {
          var newNickname = res.content.trim()

          if (newNickname) {
            console.log('用户修改昵称:', newNickname)

            // 更新用户信息
            var userInfo = self.data.userInfo
            userInfo.nickName = newNickname
            userInfo.nickname = newNickname

            self.setData({
              userInfo: userInfo
            })

            // 保存到全局和本地存储
            app.globalData.userInfo = userInfo
            wx.setStorageSync('userInfo', userInfo)

            wx.showToast({
              title: '昵称已更新',
              icon: 'success'
            })

            // 同步到云端
            if (app.globalData.cloudDevelopmentAvailable) {
              self.syncUserInfoToCloud(userInfo)
            }
          } else {
            wx.showToast({
              title: '请输入昵称',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 同步用户信息到云端
  syncUserInfoToCloud: function(userInfo) {
    var self = this
    var openid = app.getOpenid()

    console.log('同步用户信息到云端:', userInfo)

    wx.cloud.callFunction({
      name: 'updateUserInfo', // 需要创建这个云函数
      data: {
        openid: openid,
        userInfo: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl || userInfo.avatar
        }
      },
      success: function(res) {
        console.log('用户信息同步成功')
      },
      fail: function(err) {
        console.error('用户信息同步失败:', err)
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