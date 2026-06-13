// 点数包购买页 — V2.1: 价格从 getPrices 云端加载
var app = getApp()

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
  },

  onLoad: function() {
    this.loadPrices()
    this.loadBalance()
  },

  /** V2.1: 从 getPrices 加载点数包价格 */
  loadPrices: function() {
    var self = this
    wx.cloud.callFunction({
      name: 'getPrices',
      data: {},
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var d = res.result.data
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
        }
      }
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

  selectPack: function(e) {
    this.setData({ selectedPack: e.currentTarget.dataset.pack })
  },

  purchasePack: function() {
    var self = this
    if (self.data.purchasing) return
    var packType = self.data.selectedPack
    var packDisplay = packType === 'PACK_3' ? self.data.pack3Display : self.data.pack5Display
    var packName = packType === 'PACK_3' ? '3次包(¥' + packDisplay + ')' : '5次包(¥' + packDisplay + ')'

    wx.showModal({
      title: '确认购买',
      content: '购买' + packName + '？\n购买后90天有效。',
      success: function(res) {
        if (res.confirm) {
          self.setData({ purchasing: true })
          wx.cloud.callFunction({
            name: 'purchasePoints',
            data: { packType: packType, token: app.globalData.token },
            success: function(res2) {
              self.setData({ purchasing: false })
              if (res2.result && res2.result.code === 0) {
                wx.showToast({ title: '购买成功！', icon: 'success' })
                setTimeout(function() { self.loadBalance() }, 1500)
              } else {
                wx.showToast({ title: res2.result.msg || '购买失败', icon: 'none' })
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
