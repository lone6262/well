// 会员中心页面 — V1.5 商业化增强版
// V2.0: 价格/额度从云端动态加载
let app = getApp()
const priceService = require('../../utils/price-service')
const { invokePayment } = require('../../utils/pay')

Page({
  data: {
    loading: true,
    isMember: false,
    isFamilyMember: false,
    memberInfo: {
      type: '',
      expire_date: null,
      days_remaining: 0,
      report_credits_total: 0,
      report_credits_used: 0,
      report_credits_remaining: 0,
      next_reset_at: null
    },
    typeText: '',
    expireText: '',
    creditsText: '',
    currentPerReport: '0.0',
    currentDiscount: '0.0',
    couponCount: 0,
    // V2.0: 点数包余额
    pointsBalance: 0,
    pointsExpireAt: null,
    // V2.0: 动态价格 & 额度
    priceMonthly: '19.90',
    priceYearly: '99.00',
    priceFamilyMonthly: '29.90',
    priceFamilyYearly: '199.00',
    creditsMonthly: 3,
    creditsYearly: 3,
    creditsFamilyMonthly: 6,
    creditsFamilyYearly: 6,
    standardReportDisplay: '29.90',
    perReportMonthly: '',
    perReportYearly: '',
    perReportFamilyMonthly: '',
    perReportFamilyYearly: '',
    discountMonthly: '',
    discountYearly: '',
    discountFamilyMonthly: '',
    discountFamilyYearly: '',
    yearlyPerMonth: '8.25',
    yearlyFamilyPerMonth: '16.58',
    yearlySavings: '38',
    // V2.1: 快捷入口动态文案
    pointsEntryPrice: '19.9起',
    bundleEntrySave: '省¥9.9'
  },

  onLoad: function() {
    // 检查登录状态
    if (!this.checkLogin()) {
      return
    }
    try { wx.removeStorageSync('memberStatus') } catch (e) {}
    this.loadPrices()
    this.loadMemberStatus()
    this.loadCouponCount()
    this.loadPointsBalance()
  },

  onShow: function() {
    // 每次显示时检查登录状态
    if (!this.checkLogin()) {
      return
    }
    try { wx.removeStorageSync('memberStatus') } catch (e) {}
    this.loadPrices()
    this.loadMemberStatus()
    this.loadCouponCount()
    this.loadPointsBalance()
  },

  // 检查登录状态
  checkLogin: function() {
    let openid = app.getOpenid()
    let token = app.globalData.token || wx.getStorageSync('token')
    // 需要 openid 和 token 都存在才认为是已登录
    if (!openid || !token) {
      // 未登录，跳转到首页或显示登录提示
      wx.showModal({
        title: '需要登录',
        content: '请先登录后再访问会员中心',
        confirmText: '去登录',
        cancelText: '返回首页',
        success: function(res) {
          if (res.confirm) {
            // 跳转到用户中心页面（可以触发登录）
            wx.switchTab({
              url: '/pages/user/index'
            })
          } else {
            // 返回首页
            wx.switchTab({
              url: '/pages/index/index'
            })
          }
        }
      })
      return false
    }
    return true
  },

  onPullDownRefresh: function() {
    this.loadPrices()
    this.loadMemberStatus()
    this.loadCouponCount()
    this.loadPointsBalance()
  },

  /** 通过公共服务加载价格配置 */
  loadPrices: function() {
    var self = this
    priceService.fetchPricesWithCallback(function(d) {
      if (!d || !d.monthly) return
      var stdPrice = parseFloat(d.standardReportDisplay)
      var monthlyPrice = parseFloat(d.monthly.display)
      var yearlyPrice = parseFloat(d.yearly.display)
      var familyMonthlyPrice = parseFloat(d.familyMonthly.display)
      var familyYearlyPrice = parseFloat(d.familyYearly.display)

      // 折扣 = (卡价 ÷ (月额度 × 月数)) ÷ 标准价 × 10
      var discountMonthly = (monthlyPrice / d.monthly.credits / stdPrice * 10).toFixed(1)
      var discountYearly = (yearlyPrice / (d.yearly.credits * 12) / stdPrice * 10).toFixed(1)
      var discountFamilyMonthly = (familyMonthlyPrice / d.familyMonthly.credits / stdPrice * 10).toFixed(1)
      var discountFamilyYearly = (familyYearlyPrice / (d.familyYearly.credits * 12) / stdPrice * 10).toFixed(1)

      // 各卡型每份报告的实际成本（折扣价）
      var perReportMonthly = (monthlyPrice / d.monthly.credits).toFixed(1)
      var perReportYearly = (yearlyPrice / (d.yearly.credits * 12)).toFixed(1)
      var perReportFamilyMonthly = (familyMonthlyPrice / d.familyMonthly.credits).toFixed(1)
      var perReportFamilyYearly = (familyYearlyPrice / (d.familyYearly.credits * 12)).toFixed(1)

      self.setData({
        priceMonthly: d.monthly.display,
        priceYearly: d.yearly.display,
        priceFamilyMonthly: d.familyMonthly.display,
        priceFamilyYearly: d.familyYearly.display,
        creditsMonthly: d.monthly.credits,
        creditsYearly: d.yearly.credits,
        creditsFamilyMonthly: d.familyMonthly.credits,
        creditsFamilyYearly: d.familyYearly.credits,
        standardReportDisplay: d.standardReportDisplay,
        perReportMonthly: perReportMonthly,
        perReportYearly: perReportYearly,
        perReportFamilyMonthly: perReportFamilyMonthly,
        perReportFamilyYearly: perReportFamilyYearly,
        discountMonthly: discountMonthly,
        discountYearly: discountYearly,
        discountFamilyMonthly: discountFamilyMonthly,
        discountFamilyYearly: discountFamilyYearly,
        yearlyPerMonth: (yearlyPrice / 12).toFixed(2),
        yearlySavings: Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100),
        yearlyFamilyPerMonth: (familyYearlyPrice / 12).toFixed(2),
        pointsEntryPrice: d.points.pack3.display + '起',
        bundleEntrySave: '省¥' + d.bundles.starter.saveDisplay
      })
    })
  },

  loadMemberStatus: function() {
    let self = this
    self.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'getMemberStatus',
      data: {},
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let data = res.result.data
          let typeText = self.getTypeText(data.type)
          let expireText = data.is_member ? self.formatDate(data.expire_date) : ''
          let creditsText = data.is_member
            ? (data.report_credits_remaining + '/' + data.report_credits_total)
            : '0/0'
          let isFamily = data.type && data.type.startsWith('family_')

          // 根据当前会员类型，取对应的折扣价和折扣率
          var planMap = {
            monthly:      { perReport: 'perReportMonthly',      discount: 'discountMonthly' },
            yearly:       { perReport: 'perReportYearly',       discount: 'discountYearly' },
            family_monthly:  { perReport: 'perReportFamilyMonthly',  discount: 'discountFamilyMonthly' },
            family_yearly:   { perReport: 'perReportFamilyYearly',   discount: 'discountFamilyYearly' },
          }
          var plan = planMap[data.type] || planMap['monthly']
          var currentPerReport = self.data[plan.perReport] || self.data.perReportMonthly
          var currentDiscount = self.data[plan.discount] || self.data.discountMonthly

          self.setData({
            isMember: data.is_member,
            isFamilyMember: isFamily,
            memberInfo: data,
            typeText: typeText,
            expireText: expireText,
            creditsText: creditsText,
            currentPerReport: currentPerReport,
            currentDiscount: currentDiscount,
            loading: false
          })

          try {
            wx.setStorageSync('memberStatus', data)
          } catch (e) {}
        } else {
          self.setData({ loading: false })
          wx.showToast({ title: '获取会员信息失败', icon: 'none' })
        }
      },
      fail: function() {
        try {
          let cached = wx.getStorageSync('memberStatus')
          if (cached) {
            let isFamily = cached.type && cached.type.startsWith('family_')
            self.setData({
              isMember: cached.is_member,
              isFamilyMember: isFamily,
              memberInfo: cached,
              typeText: self.getTypeText(cached.type),
              expireText: cached.is_member ? self.formatDate(cached.expire_date) : '',
              creditsText: cached.is_member
                ? (cached.report_credits_remaining + '/' + cached.report_credits_total)
                : '0/0'
            })
          }
        } catch (e) {}
        self.setData({ loading: false })
        wx.showToast({ title: '网络错误', icon: 'none' })
      },
      complete: function() {
        wx.stopPullDownRefresh()
      }
    })
  },

  /** V1.5: 加载可用优惠券数量 */
  loadCouponCount: function() {
    let self = this
    wx.cloud.callFunction({
      name: 'getUserCoupons',
      data: { status: 'unused' },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let list = res.result.data && res.result.data.list ? res.result.data.list : []
          self.setData({ couponCount: list.length })
        }
      },
      fail: function() { /* 静默失败 */ }
    })
  },

  /** V2.0: 加载点数包余额 */
  loadPointsBalance: function() {
    var self = this
    wx.cloud.callFunction({
      name: 'getPointsBalance',
      data: { token: app.globalData.token },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var d = res.result.data
          self.setData({
            pointsBalance: d.balance || 0,
            pointsExpireAt: d.expireAt || null
          })
        }
      },
      fail: function() { /* 静默失败 */ }
    })
  },

  // ===== 导航方法 =====

  goToPurchase: function() {
    wx.navigateTo({ url: '/pages/member/order' })
  },

  goToPurchaseMonthly: function() {
    wx.navigateTo({ url: '/pages/member/order?defaultType=monthly' })
  },

  goToPurchaseYearly: function() {
    wx.navigateTo({ url: '/pages/member/order?defaultType=yearly' })
  },

  goToPurchaseFamilyMonthly: function() {
    wx.navigateTo({ url: '/pages/member/order?defaultType=family_monthly' })
  },

  goToPurchaseFamilyYearly: function() {
    wx.navigateTo({ url: '/pages/member/order?defaultType=family_yearly' })
  },

  goToPoints: function() {
    wx.navigateTo({ url: '/pages/points/index' })
  },

  goToCoupons: function() {
    wx.navigateTo({ url: '/pages/coupon/list' })
  },

  goToBundle: function() {
    wx.navigateTo({ url: '/pages/bundle/index' })
  },

  goToInvite: function() {
    wx.navigateTo({ url: '/pages/invite/index' })
  },

  goToStatus: function() {
    wx.navigateTo({ url: '/pages/member/status' })
  },

  goBack: function() {
    wx.navigateBack()
  },

  // ===== 测试支付功能（测试完成后移除） =====
  testPayment: function() {
    let self = this
    wx.showModal({
      title: '测试支付确认',
      content: '创建一个0.01元的测试订单来验证微信支付配置是否正确',
      confirmText: '开始测试',
      cancelText: '取消',
      success: function(res) {
        if (res.confirm) {
          self.createTestOrder()
        }
      }
    })
  },

  createTestOrder: function() {
    let self = this
    wx.showLoading({ title: '创建测试订单...' })

    // 模拟创建月卡订单，金额为0.01元
    wx.cloud.callFunction({
      name: 'createOrder',
      data: {
        type: 'member_monthly',
        memberTier: 'monthly',
        token: app.globalData.token,
        _testMode: true,  // 标记为测试模式
        _testAmount: 1    // 测试金额（1分钱）
      },
      success: function(res) {
        wx.hideLoading()
        if (res.result && res.result.code === 0) {
          let data = res.result.data

          // 真实模式：createOrder 返回 payParams，直接调起微信支付
          if (data.payParams) {
            invokePayment(data.payParams)
              .then(function() {
                wx.showModal({
                  title: '支付成功',
                  content: '测试支付已完成！\\n\\n订单号: ' + data.orderId + '\\n金额: ¥0.01',
                  showCancel: false,
                  success: function() {
                    // 刷新会员状态
                    self.loadMemberStatus()
                  }
                })
              })
              .catch(function(err) {
                wx.showToast({
                  title: '支付未完成: ' + (err.errMsg || '未知错误'),
                  icon: 'none',
                  duration: 3000
                })
              })
          } else if (data.status === 'paid') {
            // mock 模式：订单已直接标记为已支付
            wx.showModal({
              title: '模拟支付成功',
              content: '订单已创建并标记为已支付（MOCK模式）。\\n\\n订单号: ' + data.orderId + '\\n金额: ¥0.01',
              showCancel: false
            })
          } else {
            wx.showModal({
              title: '订单创建成功',
              content: '订单已创建，但未返回支付参数。\\n\\n订单号: ' + data.orderId + '\\n状态: ' + data.status,
              showCancel: false
            })
          }
        } else {
          wx.showModal({
            title: '订单创建失败',
            content: res.result.msg || '未知错误',
            showCancel: false
          })
        }
      },
      fail: function(err) {
        wx.hideLoading()
        wx.showModal({
          title: '调用失败',
          content: '云函数调用失败: ' + (err.errMsg || '未知错误'),
          showCancel: false
        })
      }
    })
  },

  getTypeText: function(type) {
    let map = {
      'monthly': '月度会员',
      'yearly': '年度会员',
      'family_monthly': '家庭月度会员',
      'family_yearly': '家庭年度会员',
      'trial': '体验会员'
    }
    return map[type] || '普通用户'
  },

  formatDate: function(dateStr) {
    if (!dateStr) return ''
    let d = new Date(dateStr)
    let year = d.getFullYear()
    let month = d.getMonth() + 1
    let day = d.getDate()
    month = month < 10 ? '0' + month : month
    day = day < 10 ? '0' + day : day
    return year + '-' + month + '-' + day
  }
})
