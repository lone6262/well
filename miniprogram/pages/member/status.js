// 会员状态与权益页面
let app = getApp()

Page({
  data: {
    loading: true,
    isMember: false,
    memberInfo: {},
    typeText: '',
    expireText: '',
    benefitValue: '',
    creditsText: '',
    cancelling: false
  },

  onLoad: function() {
    this.loadMemberStatus()
  },

  onShow: function() {
    try { wx.removeStorageSync('memberStatus') } catch (e) {}
    if (!this.data.loading) {
      this.loadMemberStatus()
    }
  },

  loadMemberStatus: function() {
    let self = this
    self.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'getMemberStatus',
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let data = res.result.data
          let typeMap = { monthly: '月度会员', yearly: '年度会员' }

          let expireDate = data.expire_date ? new Date(data.expire_date) : null
          let expireText = expireDate
            ? (expireDate.getFullYear() + '-' + String(expireDate.getMonth() + 1).padStart(2, '0') + '-' + String(expireDate.getDate()).padStart(2, '0'))
            : ''

          let remaining = data.report_credits_remaining || 0
          let total = data.report_credits_total || 0
          let benefitValue = total ? (total * 9.9).toFixed(1) : '49.5'

          self.setData({
            loading: false,
            isMember: data.is_member || false,
            memberInfo: data,
            typeText: typeMap[data.type] || '',
            expireText: expireText,
            creditsText: remaining + ' / ' + total,
            benefitValue: benefitValue
          })
        } else {
          self.setData({ loading: false })
        }
      },
      fail: function() {
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },

  cancelAutoRenew: function() {
    let self = this
    if (self.data.cancelling) return

    wx.showModal({
      title: '确认取消',
      content: '取消自动续费后，会员权益将保留至到期日。确认取消？',
      confirmColor: '#f5222d',
      success: function(res) {
        if (res.confirm) {
          self.doCancel()
        }
      }
    })
  },

  doCancel: function() {
    let self = this
    self.setData({ cancelling: true })

    wx.cloud.callFunction({
      name: 'cancelMembership',
      data: { token: app.globalData.token },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          wx.showToast({ title: '已取消自动续费', icon: 'success' })
          self.loadMemberStatus()
        } else {
          wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' })
        }
      },
      fail: function() {
        wx.showToast({ title: '网络错误', icon: 'none' })
      },
      complete: function() {
        self.setData({ cancelling: false })
      }
    })
  },

  goToPurchase: function() {
    wx.navigateTo({ url: '/pages/member/order' })
  },

  goBack: function() {
    wx.navigateBack()
  }
})
