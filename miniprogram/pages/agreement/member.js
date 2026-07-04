// 会员服务协议页 — V2.1: 价格从 getPrices 云端加载
const priceService = require('../../utils/price-service')
Page({
  data: {
    monthlyDisplay: '19.90',
    yearlyDisplay: '99.00',
    monthlyCredits: 3,
  },

  onLoad: function() {
    this.loadPrices()
  },

  loadPrices: function() {
    var self = this
    priceService.fetchPricesWithCallback(function(d) {
      if (!d || !d.agreementPrices) return
      self.setData({
        monthlyDisplay: d.agreementPrices.monthlyDisplay,
        yearlyDisplay: d.agreementPrices.yearlyDisplay,
        monthlyCredits: d.agreementPrices.monthlyCredits,
      })
    })
  },

  goBack: function() {
    wx.navigateBack()
  }
})
