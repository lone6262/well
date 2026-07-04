// 首页逻辑 - 重构版本（拆分为模块）
const app = getApp()
const dataLoader = require('./data-loader.js')
const navHandler = require('./nav-handler.js')
const logger = require('../../utils/logger.js')
const log = logger.child('Index')
const priceService = require('../../utils/price-service')

Page({
  data: {
    nearbyHospitals: [],
    petsList: [],
    dailyTip: '定期体检是预防疾病的关键，建议每年至少为宠物进行一次全面体检。',
    loadingPets: false,
    userInfo: {
      avatarUrl: ''
    },
    lastUpdateTime: '正在加载...',
    isLoadingHospitals: true,
    isLoadingLocation: false,
    lastUpdateTimeTimestamp: 0,
    showFollowupPopup: false,
    pendingFollowup: null,
    dailyKnowledge: null,
    isMember: false,
    memberDaysRemaining: 0,
    // V2.0: 动态价格
    firstReportDisplay: '1.00'
  },

  onLoad(options) {
    log.info('首页加载')
    this.loadUserInfo()
    this.loadDailyTip()
    this.loadDailyKnowledge()

    // Phase 4: 捕获邀请码
    if (options && options.invite_code) {
      app.globalData.pendingInviteCode = options.invite_code
      log.info('捕获到邀请码: ***')
    }

    // 使用登录回调机制，确保登录完成后再加载数据
    const self = this
    app.onLoginComplete((openid) => {
      log.info('登录回调触发，准备加载宠物数据')
      self.loadPetList()
      self.loadMemberStatus()
      self.loadPrices()
      self.lastLoadedOpenid = openid
    })

    // V2.0: 同时尝试加载价格（若已登录则直接加载）
    if (app.globalData.openid && app.globalData.token) {
      this.loadPrices()
    }

    log.info('首页加载完成，等待onShow触发医院数据加载')
  },

  onShow() {
    const self = this

    // 检查宠物数据更新标记
    if (app.globalData.petsUpdated) {
      self.loadPetList()
      app.globalData.petsUpdated = false
    }

    // 检查openid变化（重新登录）
    // 必须同时检查 token，避免 onLaunch 清空 token 后、静默登录完成前
    // onShow 用空 token 调用云函数导致"身份验证失败"
    if (app.globalData.openid && app.globalData.token && app.globalData.openid !== self.lastLoadedOpenid) {
      log.info('检测到用户变化，重新加载宠物列表')
      self.loadPetList()
      self.lastLoadedOpenid = app.globalData.openid
    }

    // 医院数据和回访检查需要云函数就绪
    // 如果已登录直接执行，否则等登录回调
    const loadHospitalsIfReady = function() {
      const now = Date.now()
      const lastUpdateTime = self.data.lastUpdateTimeTimestamp || 0
      const REFRESH_INTERVAL = 5 * 60 * 1000
      var isFallbackData = self.data.nearbyHospitals.some(function(h) {
        return h.id && typeof h.id === 'string' && h.id.charAt(0) === 'f'
      })

      if (now - lastUpdateTime > REFRESH_INTERVAL || !self.data.nearbyHospitals.length || isFallbackData) {
        log.info(isFallbackData ? '当前为 fallback 数据，强制刷新' : '刷新附近医院数据')
        self.loadNearbyHospitals()
        self.setData({ lastUpdateTimeTimestamp: now })
      } else {
        log.info('医院数据仍在有效期内，跳过刷新')
      }

      // 检查待处理的回访记录
      self.checkPendingFollowups()
    }

    if (app.globalData.openid && app.globalData.token) {
      loadHospitalsIfReady()
    } else {
      app.onLoginComplete(function() {
        loadHospitalsIfReady()
      })
    }
  },

  // 数据加载方法 - 使用dataLoader模块
  loadUserInfo: function() {
    dataLoader.loadUserInfo(this)
  },

  loadPetList: function() {
    dataLoader.loadPetList(this)
  },

  loadNearbyHospitals: function() {
    dataLoader.loadNearbyHospitals(this)
  },

  loadDailyKnowledge: function() {
    dataLoader.loadDailyKnowledge(this)
  },

  loadMemberStatus: function() {
    dataLoader.loadMemberStatus(this)
  },

  /** 加载云端价格（通过公共服务） */
  loadPrices: function() {
    var self = this
    priceService.fetchPricesWithCallback(function(d) {
      if (d && d.firstReportDisplay) {
        self.setData({ firstReportDisplay: d.firstReportDisplay })
      }
    })
  },

  checkPendingFollowups: function() {
    dataLoader.checkPendingFollowups(this)
  },

  formatUpdateTime(date) {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `今天 ${hours}:${minutes}`
  },


  calculateHealthStatus(pet) {
    const hasRecentVaccine = pet.vaccineDate && this.isDateRecent(pet.vaccineDate)
    const hasRecentDeworming = pet.dewormDate && this.isDateRecent(pet.dewormDate)

    if (hasRecentVaccine && hasRecentDeworming) {
      return 'good'
    } else {
      return 'warning'
    }
  },

  isDateRecent(dateString) {
    if (!dateString) return false

    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now - date
    const diffDays = diffTime / (1000 * 60 * 60 * 24)

    return diffDays <= 30
  },

  getHealthStatusText(status) {
    return status === 'good' ? '状态良好' : '需要关注'
  },

  loadDailyTip() {
    const tips = [
      '定期体检是预防疾病的关键，建议每年至少为宠物进行一次全面体检。',
      '注意观察宠物的食欲和精神状态，异常时及时就医。',
      '保持适量的运动有助于宠物的身心健康。',
      '定期驱虫是预防寄生虫感染的重要措施。',
      '注意宠物的口腔卫生，定期刷牙可以预防牙齿问题。'
    ]

    const randomTip = tips[Math.floor(Math.random() * tips.length)]
    this.setData({
      dailyTip: randomTip
    })
  },

  // 导航方法 - 使用navHandler模块
  toEmergency: navHandler.toEmergency,
  toSymptom: navHandler.toSymptom,
  toHospital: navHandler.toHospital,
  toKnowledge: navHandler.toKnowledge,
  toKnowledgeDetail: navHandler.toKnowledgeDetail,
  goToMember: navHandler.goToMember,
  goToInvite: navHandler.goToInvite,
  goToFollowupList: navHandler.goToFollowupList,

  // 需要绑定this的方法
  closeFollowupPopup: function() {
    navHandler.closeFollowupPopup.call(this)
  },

  goToFollowup: function() {
    navHandler.goToFollowup.call(this)
  },

  toPetProfile() {
    log.info('点击健康档案按钮')
    try {
      wx.navigateTo({
        url: '/pages/pet/profile',
        success: function() {
          log.info('跳转宠物档案成功')
        },
        fail: function(err) {
          log.error('跳转宠物档案失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      log.error('健康档案按钮点击异常:', error)
    }
  },

  viewPetDetail(e) {
    const petId = e.currentTarget.dataset.petId
    const petName = e.currentTarget.dataset.petName

    log.info('查看宠物详情:', petId, petName)

    try {
      // 跳转到宠物档案页面，并传递宠物ID
      wx.navigateTo({
        url: `/pages/pet/profile?petId=${petId}&action=edit`,
        success: function() {
          log.info('跳转宠物档案成功，准备编辑宠物:', petName)
        },
        fail: function(err) {
          log.error('跳转宠物档案失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      log.error('查看宠物详情异常:', error)
    }
  },

  showMoreFeatures() {
    wx.showToast({
      title: '更多功能开发中',
      icon: 'none'
    })
  },

  addPet() {
    log.info('点击添加宠物')
    try {
      wx.navigateTo({
        url: '/pages/pet/profile?action=add',
        success: function() {
          log.info('跳转宠物档案成功，准备打开添加弹窗')
          // 延迟一下，确保页面加载完成
          setTimeout(() => {
            // 这里可以通过事件通知宠物档案页面打开添加弹窗
          }, 500)
        },
        fail: function(err) {
          log.error('跳转宠物档案失败:', err)
        }
      })
    } catch (error) {
      log.error('添加宠物功能异常:', error)
    }
  },

  refreshHealthStatus() {
    log.info('刷新宠物健康状态')
    this.loadPetList()
    wx.showToast({
      title: '刷新成功',
      icon: 'success'
    })
  },

  toUser() {
    log.info('点击用户头像')
    try {
      wx.switchTab({
        url: '/pages/user/index',
        success: function() {
          log.info('跳转用户中心成功')
        },
        fail: function(err) {
          log.error('跳转用户中心失败:', err)
        }
      })
    } catch (error) {
      log.error('用户头像点击异常:', error)
    }
  },

  navigateToHospital(e) {
    const hospital = e.currentTarget.dataset.hospital
    log.info('导航到医院:', hospital)

    if (!hospital) {
      log.error('未找到医院数据')
      wx.showToast({
        title: '医院信息未找到',
        icon: 'none'
      })
      return
    }

    // 检查医院是否有位置信息
    if (!hospital.latitude || !hospital.longitude || hospital.latitude === 0 || hospital.longitude === 0) {
      log.warn('医院位置信息不完整，跳转到医院列表')
      wx.showModal({
        title: '位置信息不完整',
        content: '该医院的详细位置信息还在更新中，是否前往医院列表查看更多信息？',
        confirmText: '前往列表',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/hospital/list'
            })
          }
        }
      })
      return
    }

    // 直接打开地图导航
    try {
      wx.openLocation({
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        name: hospital.name,
        address: hospital.address,
        scale: 15,
        success: function() {
          log.info('地图导航打开成功:', hospital.name)
        },
        fail: function(error) {
          log.error('地图导航打开失败:', error)
          wx.showToast({
            title: '地图打开失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      log.error('导航功能异常:', error)
      wx.showToast({
        title: '导航失败',
        icon: 'none'
      })
    }
  },

  onShareAppMessage: navHandler.onShareAppMessage,

  onUnload() {
    log.info('首页卸载，清理资源')
  }
})
