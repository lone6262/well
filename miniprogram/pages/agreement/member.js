// 会员服务协议页 — V2.1: 价格从 getPrices 云端加载
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
    wx.cloud.callFunction({
      name: 'getPrices',
      data: {},
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var d = res.result.data
          self.setData({
            monthlyDisplay: d.agreementPrices.monthlyDisplay,
            yearlyDisplay: d.agreementPrices.yearlyDisplay,
            monthlyCredits: d.agreementPrices.monthlyCredits,
          })
        }
      }
    })
  },

  goBack: function() {
    wx.navigateBack()
  }
})
