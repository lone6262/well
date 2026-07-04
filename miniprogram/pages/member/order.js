// 会员购买页面 — V1.5 支持个人/家庭多套餐
// V2.0: 价格从云端动态加载，管理后台可配置
const priceService = require('../../utils/price-service')
const { invokePayment } = require('../../utils/pay')
let app = getApp()

// 默认价格映射表（云端价格加载失败时的兜底）
var DEFAULT_PRICE_MAP = {
  monthly: '19.90',
  yearly: '99.00',
  family_monthly: '29.90',
  family_yearly: '199.00',
  renew_monthly: '15.90',
  renew_yearly: '89.00',
  renew_family_monthly: '25.90',
  renew_family_yearly: '179.00'
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
    // V2.0: 动态价格展示
    priceMonthly: '19.90',
    priceYearly: '99.00',
    priceFamilyMonthly: '29.90',
    priceFamilyYearly: '199.00',
    renewMonthly: '15.90',
    renewYearly: '89.00',
    renewFamilyMonthly: '25.90',
    renewFamilyYearly: '179.00',
    // V2.0: 动态额度 & 标准价
    creditsMonthly: 3,
    creditsYearly: 3,
    creditsFamilyMonthly: 6,
    creditsFamilyYearly: 6,
    standardReportDisplay: '9.90',
    monthlyDiscount: '3',
    familyYearlyPerMonth: '16.58',
    yearlySavings: '38',
    // 状态字段
    purchasing: false,
    upgradeMode: false,
    renewMode: false,
    modeTitle: '开通会员',
    fromReport: false,
    returnAssessmentId: '',
    showPayProcessing: false,
    isDestroyed: false
  },

  // 运行时价格缓存
  _priceMap: null,
  _priceLoaded: false,

  onLoad: function(options) {
    if (!options) options = {}

    // 先加载价格，再处理参数
    this.loadPrices(function() {
      if (options.fromReport === 'true' && options.assessmentId) {
        this.setData({
          fromReport: true,
          returnAssessmentId: options.assessmentId
        })
      }

      // 升级模式：月度 → 年度
      if (options.upgrade === 'true') {
        var yearlyPrice = this._priceMap.yearly
        this.setData({
          upgradeMode: true,
          selectedType: 'yearly',
          selectedPrice: yearlyPrice,
          modeTitle: '升级年度会员'
        })
        return
      }

      // 续费模式
      if (options.renew === 'monthly') {
        var renewPrice = this._priceMap.renew_monthly || this._priceMap.monthly
        this.setData({
          renewMode: true,
          selectedType: 'monthly',
          selectedPrice: renewPrice,
          modeTitle: '续费会员'
        })
        return
      }
      if (options.renew === 'yearly') {
        var renewPrice = this._priceMap.renew_yearly || this._priceMap.yearly
        this.setData({
          renewMode: true,
          selectedType: 'yearly',
          selectedPrice: renewPrice,
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
          selectedPrice: this._priceMap[dt] || '99.00'
        })
      }
    }.bind(this))
  },

  /**
   * 通过公共服务加载价格配置
   */
  loadPrices: function(callback) {
    var self = this;
    priceService.fetchPricesWithCallback(function(data) {
      if (data && data.monthly) {
        self._priceMap = {
          monthly: data.monthly.display,
          yearly: data.yearly.display,
          family_monthly: data.familyMonthly.display,
          family_yearly: data.familyYearly.display,
          renew_monthly: data.monthly.renewDisplay,
          renew_yearly: data.yearly.renewDisplay,
          renew_family_monthly: data.familyMonthly.renewDisplay,
          renew_family_yearly: data.familyYearly.renewDisplay
        };
        self.setData({
          priceMonthly: self._priceMap.monthly,
          priceYearly: self._priceMap.yearly,
          priceFamilyMonthly: self._priceMap.family_monthly,
          priceFamilyYearly: self._priceMap.family_yearly,
          renewMonthly: self._priceMap.renew_monthly,
          renewYearly: self._priceMap.renew_yearly,
          renewFamilyMonthly: self._priceMap.renew_family_monthly,
          renewFamilyYearly: self._priceMap.renew_family_yearly,
          creditsMonthly: data.monthly.credits,
          creditsYearly: data.yearly.credits,
          creditsFamilyMonthly: data.familyMonthly.credits,
          creditsFamilyYearly: data.familyYearly.credits,
          standardReportDisplay: data.standardReportDisplay,
          monthlyDiscount: (parseFloat(data.monthly.display) / (parseFloat(data.standardReportDisplay) * data.monthly.credits) * 10).toFixed(1),
          familyYearlyPerMonth: (parseFloat(data.familyYearly.display) / 12).toFixed(2),
          yearlySavings: Math.round((1 - parseFloat(data.yearly.display) / (parseFloat(data.monthly.display) * 12)) * 100)
        });
      } else {
        self._priceMap = {};
        for (var k in DEFAULT_PRICE_MAP) {
          self._priceMap[k] = DEFAULT_PRICE_MAP[k];
        }
      }
      if (callback) callback();
    });
  },

  switchTab: function(e) {
    if (this.data.upgradeMode || this.data.renewMode) return
    var tab = e.currentTarget.dataset.tab
    // 切换 tab 时自动选中该类型的年卡
    var defaultType = tab === 'family' ? 'family_yearly' : 'yearly'
    this.setData({
      activeTab: tab,
      selectedType: defaultType,
      selectedPrice: this._priceMap[defaultType] || DEFAULT_PRICE_MAP[defaultType]
    })
  },

  selectPlan: function(e) {
    if (this.data.upgradeMode || this.data.renewMode) return
    var type = e.currentTarget.dataset.type
    var priceMap = this._priceMap || DEFAULT_PRICE_MAP
    if (priceMap[type]) {
      this.setData({
        selectedType: type,
        selectedPrice: priceMap[type]
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
        confirmColor: '#B35D3A',
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
        confirmColor: '#B35D3A',
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
      confirmColor: '#B35D3A',
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
        name: 'createOrder',
        data: {
          type: 'member',
          memberTier: memberTier,
          token: app.globalData.token
        },
        success: function(res) {
          self.setData({ showPayProcessing: false })
          if (!res.result || res.result.code !== 0) {
            wx.showToast({
              title: (res.result && res.result.msg) || '操作失败',
              icon: 'none',
              duration: 2000
            })
            return
          }
          var data = res.result.data || {}
          if (data.payParams) {
            // 真实支付：调起微信支付，成功后轮询会员激活状态
            invokePayment(data.payParams)
              .then(function() { self._pollMemberActivation(0) })
              .catch(function() {
                wx.showToast({ title: '支付未完成', icon: 'none' })
              })
          } else {
            // mock/0 元：订单已直接完成（真实模式不会走到）
            self._pollMemberActivation(0)
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

  // 支付成功后轮询会员状态：payCallback 异步激活会员，确认到账后再提示成功
  _pollMemberActivation: function(attempt) {
    var self = this
    if (attempt === 0) {
      wx.showLoading({ title: '正在开通...', mask: true })
    }
    wx.cloud.callFunction({
      name: 'getMemberStatus',
      data: { token: app.globalData.token },
      success: function(res) {
        var d = res.result && res.result.data
        var active = !!d && d.is_member === true
        if (active) {
          self._finishActivation(false)
        } else if (attempt < 4) {
          setTimeout(function() { self._pollMemberActivation(attempt + 1) }, 1000)
        } else {
          self._finishActivation(true)
        }
      },
      fail: function() {
        if (attempt < 4) {
          setTimeout(function() { self._pollMemberActivation(attempt + 1) }, 1000)
        } else {
          self._finishActivation(true)
        }
      }
    })
  },

  _finishActivation: function(delayed) {
    var self = this
    wx.hideLoading()
    if (app.globalData.userInfo) {
      app.globalData.userInfo.isMember = true
    }
    try { wx.removeStorageSync('memberStatus') } catch (e) {}
    var toastTitle = delayed
      ? '支付成功，会员开通中，请稍后查看'
      : (self.data.upgradeMode ? '升级成功！' : (self.data.renewMode ? '续费成功！' : '开通成功！'))
    wx.showToast({ title: toastTitle, icon: delayed ? 'none' : 'success', duration: 1500 })
    setTimeout(function() {
      if (self.data.fromReport && self.data.returnAssessmentId) {
        wx.redirectTo({
          url: '/pages/risk/result?assessmentId=' + self.data.returnAssessmentId + '&riskLevel=mid'
        })
      } else {
        wx.navigateBack()
      }
    }, 1500)
  },

  goBack: function() {
    wx.navigateBack()
  },

  goToPoints: function() {
    wx.navigateTo({ url: '/pages/points/index' })
  },

  viewAgreement: function() {
    wx.navigateTo({
      url: '/pages/agreement/member'
    })
  },

  onUnload: function() {
    this.setData({ isDestroyed: true })
  }
})
