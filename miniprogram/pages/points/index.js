// 点数包购买页 — V2.1: 价格从 getPrices 云端加载
var app = getApp()
const priceService = require('../../utils/price-service')
const { invokePayment } = require('../../utils/pay')

Page({
  data: {
    balance: 0,
    expireAt: null,
    expireText: '',
    selectedPack: 'PACK_3',
    purchasing: false,
    // 动态价格（兜底为旧值）
    pack3Display: '19.90',
    pack5Display: '29.90',
    standardReportDisplay: '9.90',
    // V2.1: 预计算展示字段
    pack3PerUse: '6.63',
    pack5PerUse: '5.98',
    pack3Save: '9.80',
    pack5Save: '19.60',
    pack3SavePct: '33',
    pack5SavePct: '40',
    pack3Original: '29.70',
    pack5Original: '49.50',
    // 优惠券（点数券）
    coupons: [],
    hasCoupons: false,
    selectedCouponId: '',     // 选中的 user_coupon._id；'' = 不使用
    couponDiscountFen: 0,
    couponDiscountDisplay: '0.00',
    finalPriceDisplay: '',
  },

  onLoad: function() {
    // 检查登录状态
    if (!this.checkLogin()) {
      return
    }
    this.loadPrices()
    this.loadBalance()
    this.loadCoupons()
  },

  // 检查登录状态
  checkLogin: function() {
    let openid = app.getOpenid()
    if (!openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/user/index'
        })
      }, 1500)
      return false
    }
    return true
  },

  /** 通过公共服务加载点数包价格 */
  loadPrices: function() {
    var self = this
    priceService.fetchPricesWithCallback(function(d) {
      if (!d || !d.points) return
      var stdPrice = parseFloat(d.standardReportDisplay)
      var p3 = parseFloat(d.points.pack3.display)
      var p5 = parseFloat(d.points.pack5.display)
      self.setData({
        pack3Display: d.points.pack3.display,
        pack5Display: d.points.pack5.display,
        standardReportDisplay: d.standardReportDisplay,
        pack3PerUse: (p3 / 3).toFixed(2),
        pack5PerUse: (p5 / 5).toFixed(2),
        pack3Save: (stdPrice * 3 - p3).toFixed(2),
        pack5Save: (stdPrice * 5 - p5).toFixed(2),
        pack3SavePct: ((1 - p3 / (stdPrice * 3)) * 100).toFixed(0),
        pack5SavePct: ((1 - p5 / (stdPrice * 5)) * 100).toFixed(0),
        pack3Original: (stdPrice * 3).toFixed(2),
        pack5Original: (stdPrice * 5).toFixed(2),
        })
      })
  },

  loadBalance: function() {
    var self = this
    if (!app.globalData.cloudDevelopmentAvailable) return
    wx.cloud.callFunction({
      name: 'getPointsBalance',
      data: { token: app.globalData.token },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var d = res.result.data
          self.setData({
            balance: d.balance || 0,
            expireAt: d.expireAt,
            expireText: d.expireAt ? new Date(d.expireAt).toLocaleDateString('zh-CN') : ''
          })
        }
      }
    })
  },

  // 加载可用点数券（后端按 orderType=points 过滤）
  loadCoupons: function() {
    var self = this
    if (!app.globalData.cloudDevelopmentAvailable) return
    wx.cloud.callFunction({
      name: 'getUserCoupons',
      data: { token: app.globalData.token, status: 'unused', orderType: 'points' },
      success: function(res) {
        if (!res.result || res.result.code !== 0) return
        var list = (res.result.data && res.result.data.coupons) || []
        list = self.enrichCoupons(list)
        // 默认预选折扣最大且可用的券
        var usable = list.filter(function(c) { return c.usable })
        var best = ''
        if (usable.length > 0) {
          var bestC = usable.reduce(function(a, b) { return b.discountFen > a.discountFen ? b : a })
          best = bestC._id
        }
        self.setData({ coupons: list, hasCoupons: list.length > 0, selectedCouponId: best })
        self.recomputeCouponDiscount()
      }
    })
  },

  // 当前选中包价格（分）
  currentPackPriceFen: function() {
    var packDisplay = this.data.selectedPack === 'PACK_3' ? this.data.pack3Display : this.data.pack5Display
    return Math.round(parseFloat(packDisplay) * 100)
  },

  // 为每张券计算对当前包的折扣与可用性（与后端 autoSelectCoupon 口径一致）
  enrichCoupons: function(list) {
    var packPriceFen = this.currentPackPriceFen()
    return list.map(function(c) {
      var discountFen = 0
      var usable = true
      if (c.minAmount && packPriceFen < c.minAmount) {
        usable = false
      } else if (c.discountType === 'fixed') {
        discountFen = c.discountValue || 0
      } else if (c.discountType === 'percent') {
        discountFen = Math.floor(packPriceFen * (100 - (c.discountValue || 100)) / 100)
      }
      discountFen = Math.min(discountFen, packPriceFen)
      return Object.assign({}, c, {
        discountFen: discountFen,
        discountDisplay: (discountFen / 100).toFixed(2),
        usable: usable
      })
    })
  },

  // 选中包/券变化时重算折扣与实付
  recomputeCouponDiscount: function() {
    var coupons = this.enrichCoupons(this.data.coupons)
    var packPriceFen = this.currentPackPriceFen()
    var selected = this.data.selectedCouponId
    var sel = coupons.filter(function(c) { return c._id === selected })[0]
    if (sel && !sel.usable) { sel = null; selected = '' }
    var discountFen = sel ? sel.discountFen : 0
    var payFen = Math.max(packPriceFen - discountFen, 0)
    this.setData({
      coupons: coupons,
      selectedCouponId: selected,
      couponDiscountFen: discountFen,
      couponDiscountDisplay: (discountFen / 100).toFixed(2),
      finalPriceDisplay: (payFen / 100).toFixed(2)
    })
  },

  selectPack: function(e) {
    this.setData({ selectedPack: e.currentTarget.dataset.pack })
    this.recomputeCouponDiscount()
  },

  selectCoupon: function(e) {
    var id = e.currentTarget.dataset.id || ''
    if (!id) {
      this.setData({ selectedCouponId: '' })
    } else {
      var c = this.data.coupons.filter(function(x) { return x._id === id })[0]
      if (c && !c.usable) return
      if (id === this.data.selectedCouponId) id = ''   // 再次点击取消选择
      this.setData({ selectedCouponId: id })
    }
    this.recomputeCouponDiscount()
  },

  purchasePack: function() {
    var self = this
    if (self.data.purchasing) return
    var packType = self.data.selectedPack
    var packDisplay = packType === 'PACK_3' ? self.data.pack3Display : self.data.pack5Display
    var packName = packType === 'PACK_3' ? '3次包' : '5次包'
    var finalDisplay = self.data.finalPriceDisplay || packDisplay
    var content = self.data.couponDiscountFen > 0
      ? '购买' + packName + '（原价¥' + packDisplay + '，券后¥' + finalDisplay + '）？\n购买后90天有效。'
      : '购买' + packName + '（¥' + finalDisplay + '）？\n购买后90天有效。'

    wx.showModal({
      title: '确认购买',
      content: content,
      success: function(res) {
        if (res.confirm) {
          self.setData({ purchasing: true })
          wx.cloud.callFunction({
            name: 'createOrder',
            data: { type: 'points', packType: packType, couponId: self.data.selectedCouponId || '', token: app.globalData.token },
            success: function(res2) {
              if (!res2.result || res2.result.code !== 0) {
                self.setData({ purchasing: false })
                wx.showToast({ title: (res2.result && res2.result.msg) || '购买失败', icon: 'none' })
                return
              }
              var data = res2.result.data || {}
              if (data.payParams) {
                // 真实支付：调起微信支付，成功后点数由 payCallback 异步到账
                invokePayment(data.payParams)
                  .then(function() {
                    self.setData({ purchasing: false })
                    wx.showToast({ title: '购买成功！', icon: 'success' })
                    setTimeout(function() { self.loadBalance() }, 1500)
                  })
                  .catch(function() {
                    self.setData({ purchasing: false })
                    wx.showToast({ title: '支付未完成', icon: 'none' })
                  })
              } else {
                // mock/0 元：点数已即时到账
                self.setData({ purchasing: false })
                wx.showToast({ title: '购买成功！', icon: 'success' })
                setTimeout(function() { self.loadBalance() }, 1500)
              }
            },
            fail: function() {
              self.setData({ purchasing: false })
              wx.showToast({ title: '网络错误', icon: 'none' })
            }
          })
        }
      }
    })
  },

  goBack: function() { wx.navigateBack() }
})
