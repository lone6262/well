// 会员中心页面 — V1.5 商业化增强版
let app = getApp()

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
    couponCount: 0
  },

  onLoad: function() {
    try { wx.removeStorageSync('memberStatus') } catch (e) {}
    this.loadMemberStatus()
    this.loadCouponCount()
  },

  onShow: function() {
    try { wx.removeStorageSync('memberStatus') } catch (e) {}
    this.loadMemberStatus()
    this.loadCouponCount()
  },

  onPullDownRefresh: function() {
    this.loadMemberStatus()
    this.loadCouponCount()
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

          self.setData({
            isMember: data.is_member,
            isFamilyMember: isFamily,
            memberInfo: data,
            typeText: typeText,
            expireText: expireText,
            creditsText: creditsText,
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
