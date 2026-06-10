// 会员购买页面 — V1.5 支持个人/家庭多套餐
let app = getApp()

// 价格映射表
var PRICE_MAP = {
  monthly: '19.90',
  yearly: '99.00',
  family_monthly: '29.90',
  family_yearly: '199.00'
}

var MEMBER_TYPE_MAP = {
  monthly: '个人月卡',
  yearly: '个人年卡',
  family_monthly: '家庭月卡',
  family_yearly: '家庭年卡'
}

Page({
  data: {
    activeTab: 'personal',
    selectedType: 'yearly',
    selectedPrice: '99.00',
    purchasing: false,
    upgradeMode: false,
    renewMode: false,
    modeTitle: '开通会员',
    fromReport: false,
    returnAssessmentId: '',
    showPayProcessing: false,
    isDestroyed: false
  },

  onLoad: function(options) {
    if (!options) options = {}

    if (options.fromReport === 'true' && options.assessmentId) {
      this.setData({
        fromReport: true,
        returnAssessmentId: options.assessmentId
      })
    }

    // 升级模式：月度 → 年度
    if (options.upgrade === 'true') {
      this.setData({
        upgradeMode: true,
        selectedType: 'yearly',
        selectedPrice: PRICE_MAP.yearly,
        modeTitle: '升级年度会员'
      })
      return
    }

    // 续费模式
    if (options.renew === 'monthly') {
      this.setData({
        renewMode: true,
        selectedType: 'monthly',
        selectedPrice: PRICE_MAP.monthly,
        modeTitle: '续费会员'
      })
      return
    }
    if (options.renew === 'yearly') {
      this.setData({
        renewMode: true,
        selectedType: 'yearly',
        selectedPrice: PRICE_MAP.yearly,
        modeTitle: '续费会员'
      })
      return
    }

    // 从会员中心传入默认类型
    if (options.defaultType) {
      var dt = options.defaultType
      var tab = dt.startsWith('family_') ? 'family' : 'personal'
      this.setData({
        activeTab: tab,
        selectedType: dt,
        selectedPrice: PRICE_MAP[dt] || '99.00'
      })
    }
  },

  switchTab: function(e) {
    if (this.data.upgradeMode || this.data.renewMode) return
    var tab = e.currentTarget.dataset.tab
    // 切换 tab 时自动选中该类型的年卡
    var defaultType = tab === 'family' ? 'family_yearly' : 'yearly'
    this.setData({
      activeTab: tab,
      selectedType: defaultType,
      selectedPrice: PRICE_MAP[defaultType]
    })
  },

  selectPlan: function(e) {
    if (this.data.upgradeMode || this.data.renewMode) return
    var type = e.currentTarget.dataset.type
    if (PRICE_MAP[type]) {
      this.setData({
        selectedType: type,
        selectedPrice: PRICE_MAP[type]
      })
    }
  },

  confirmPurchase: function() {
    var self = this
    if (self.data.purchasing) return

    var typeName = MEMBER_TYPE_MAP[self.data.selectedType] || '会员'
    var priceText = self.data.selectedPrice

    if (self.data.upgradeMode) {
      wx.showModal({
        title: '升级会员',
        content: '确认以 ¥' + priceText + ' 升级为' + typeName + '？',
        confirmText: '确认升级',
        confirmColor: '#667eea',
        success: function(res) {
          if (res.confirm) self.doPurchase()
        }
      })
      return
    }

    if (self.data.renewMode) {
      wx.showModal({
        title: '续费会员',
        content: '确认以 ¥' + priceText + ' 续费' + typeName + '？',
        confirmText: '确认续费',
        confirmColor: '#667eea',
        success: function(res) {
          if (res.confirm) self.doPurchase()
        }
      })
      return
    }

    wx.showModal({
      title: '确认开通',
      content: '确认以 ¥' + priceText + ' 开通' + typeName + '？',
      confirmText: '确认开通',
      confirmColor: '#667eea',
      success: function(res) {
        if (res.confirm) self.doPurchase()
      }
    })
  },

  doPurchase: function() {
    var self = this
    self.setData({ purchasing: true, showPayProcessing: true })

    setTimeout(function() {
      if (self.data.isDestroyed) return

      // 映射前端类型到云函数 memberTier 参数
      var memberTier = self.data.selectedType

      wx.cloud.callFunction({
        name: 'memberActivate',
        data: {
          type: memberTier,
          token: app.globalData.token
        },
        success: function(res) {
          self.setData({ showPayProcessing: false })
          if (res.result && res.result.code === 0) {
            if (app.globalData.userInfo) {
              app.globalData.userInfo.isMember = true
            }
            try { wx.removeStorageSync('memberStatus') } catch (e) {}

            var toastTitle = self.data.upgradeMode ? '升级成功！' : (self.data.renewMode ? '续费成功！' : '开通成功！')
            wx.showToast({
              title: toastTitle,
              icon: 'success',
              duration: 1500
            })

            setTimeout(function() {
              if (self.data.fromReport && self.data.returnAssessmentId) {
                wx.redirectTo({
                  url: '/pages/risk/result?assessmentId=' + self.data.returnAssessmentId + '&riskLevel=mid'
                })
              } else {
                wx.navigateBack()
              }
            }, 1500)
          } else {
            wx.showToast({
              title: (res.result && res.result.msg) || '操作失败',
              icon: 'none',
              duration: 2000
            })
          }
        },
        fail: function() {
          self.setData({ showPayProcessing: false })
          wx.showToast({ title: '网络错误，请重试', icon: 'none' })
        },
        complete: function() {
          self.setData({ purchasing: false })
        }
      })
    }, 1500)
  },

  goBack: function() {
    wx.navigateBack()
  },

  onUnload: function() {
    this.setData({ isDestroyed: true })
  }
})
