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
    cancelling: false,
    // V1.5 新增
    autoRenew: false,
    showAutoRenewToggle: false,
    isFamilyMember: false,
    daysRemaining: 999,
    showRenewReminder: false,
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
          let typeMap = {
            monthly: '月度会员',
            yearly: '年度会员',
            family_monthly: '家庭月度会员',
            family_yearly: '家庭年度会员',
            trial: '体验会员',
          }

          let expireDate = data.expire_date ? new Date(data.expire_date) : null
          let expireText = expireDate
            ? (expireDate.getFullYear() + '-' + String(expireDate.getMonth() + 1).padStart(2, '0') + '-' + String(expireDate.getDate()).padStart(2, '0'))
            : ''

          let remaining = data.report_credits_remaining || 0
          let total = data.report_credits_total || 0
          let benefitValue = total ? (total * 9.9).toFixed(1) : '49.5'
          let daysRemaining = data.days_remaining || 0
          let isFamily = data.type && data.type.startsWith('family_')

          self.setData({
            loading: false,
            isMember: data.is_member || false,
            memberInfo: data,
            typeText: typeMap[data.type] || '',
            expireText: expireText,
            creditsText: remaining + ' / ' + total,
            benefitValue: benefitValue,
            autoRenew: data.auto_renew || false,
            showAutoRenewToggle: data.is_member && data.type !== 'trial',
            isFamilyMember: isFamily,
            daysRemaining: daysRemaining,
            showRenewReminder: data.is_member && daysRemaining <= 7,
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

  /**
   * V1.5: 自动续费开关切换
   */
  toggleAutoRenew: function(e) {
    let self = this
    let enabled = e.detail.value

    wx.showModal({
      title: enabled ? '开启自动续费' : '关闭自动续费',
      content: enabled
        ? '开启后会员到期前 3 天将自动续费，可随时在会员中心关闭。'
        : '关闭后会员权益将保留至到期日。确认关闭？',
      confirmColor: enabled ? '#4A90E2' : '#f5222d',
      success: function(res) {
        if (res.confirm) {
          self.doToggleAutoRenew(enabled)
        } else {
          // 回滚 switch 状态
          self.setData({ autoRenew: !enabled })
        }
      }
    })
  },

  doToggleAutoRenew: function(enabled) {
    let self = this

    wx.cloud.callFunction({
      name: 'toggleAutoRenew',
      data: { enabled: enabled, token: app.globalData.token },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          wx.showToast({ title: enabled ? '已开启自动续费' : '已关闭自动续费', icon: 'success' })
          self.setData({ autoRenew: enabled })
        } else {
          wx.showToast({ title: res.result.msg || '操作失败', icon: 'none' })
          self.setData({ autoRenew: !enabled })
        }
      },
      fail: function() {
        wx.showToast({ title: '网络错误', icon: 'none' })
        self.setData({ autoRenew: !enabled })
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

  /**
   * V1.5: 跳转家庭成员管理
   */
  goToFamily: function() {
    wx.navigateTo({ url: '/pages/member/family' })
  },

  /**
   * V1.5: 跳转点数包购买
   */
  goToPoints: function() {
    wx.navigateTo({ url: '/pages/points/index' })
  },

  goToPurchase: function() {
    wx.navigateTo({ url: '/pages/member/order' })
  },

  goBack: function() {
    wx.navigateBack()
  }
})
