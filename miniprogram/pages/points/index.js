// 点数包购买页
var app = getApp()

Page({
  data: {
    balance: 0,
    expireAt: null,
    expireText: '',
    selectedPack: 'PACK_3',
    purchasing: false
  },

  onLoad: function() {
    this.loadBalance()
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
    var packName = packType === 'PACK_3' ? '3次包(¥19.90)' : '5次包(¥29.90)'

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
