// 会员中心页面
let app = getApp()

Page({
  data: {
    loading: true,
    isMember: false,
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
    benefitValue: ''
  },

  onLoad: function() {
    // 清除旧缓存，确保拉取最新数据
    try { wx.removeStorageSync('memberStatus') } catch (e) {}
    this.loadMemberStatus()
  },

  onShow: function() {
    // 每次显示时清除缓存强制刷新，确保购买/续费后数据同步
    try { wx.removeStorageSync('memberStatus') } catch (e) {}
    this.loadMemberStatus()
  },

  onPullDownRefresh: function() {
    this.loadMemberStatus()
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
          let benefitValue = data.is_member
            ? (data.report_credits_total * 9.9).toFixed(1)
            : '49.5'

          self.setData({
            isMember: data.is_member,
            memberInfo: data,
            typeText: typeText,
            expireText: expireText,
            creditsText: creditsText,
            benefitValue: benefitValue,
            loading: false
          })

          // 缓存到本地
          try {
            wx.setStorageSync('memberStatus', data)
          } catch (e) { /* ignore */ }
        } else {
          self.setData({ loading: false })
          wx.showToast({ title: '获取会员信息失败', icon: 'none' })
        }
      },
      fail: function() {
        // 使用缓存降级
        try {
          let cached = wx.getStorageSync('memberStatus')
          if (cached) {
            self.setData({
              isMember: cached.is_member,
              memberInfo: cached,
              typeText: self.getTypeText(cached.type),
              expireText: cached.is_member ? self.formatDate(cached.expire_date) : '',
              creditsText: cached.is_member
                ? (cached.report_credits_remaining + '/' + cached.report_credits_total)
                : '0/0',
              benefitValue: cached.report_credits_total
                ? (cached.report_credits_total * 9.9).toFixed(1)
                : '49.5'
            })
          }
        } catch (e) { /* ignore */ }
        self.setData({ loading: false })
        wx.showToast({ title: '网络错误', icon: 'none' })
      },
      complete: function() {
        wx.stopPullDownRefresh()
      }
    })
  },

  goToPurchase: function() {
    // 年度会员 → 无需操作
    if (this.data.isMember && this.data.memberInfo.type === 'yearly') {
      wx.showToast({
        title: '您已是年度会员',
        icon: 'none',
        duration: 2000
      })
      return
    }
    // 月度会员 → 选择续费或升级
    if (this.data.isMember && this.data.memberInfo.type === 'monthly') {
      let self = this
      wx.showActionSheet({
        itemList: ['续费月度会员', '升级年度会员'],
        success: function(res) {
          if (res.tapIndex === 0) {
            // 续费月度 - 检查额度是否已用完
            if (self.data.memberInfo.report_credits_remaining > 0) {
              wx.showToast({
                title: '额度未用完，暂无需续费',
                icon: 'none',
                duration: 2000
              })
              return
            }
            wx.navigateTo({ url: '/pages/member/order?renew=monthly' })
          } else if (res.tapIndex === 1) {
            // 升级年度
            wx.navigateTo({ url: '/pages/member/order?upgrade=true' })
          }
        }
      })
      return
    }
    // 非会员 → 跳转开通页
    wx.navigateTo({ url: '/pages/member/order' })
  },

  goBack: function() {
    wx.navigateBack()
  },

  getTypeText: function(type) {
    let map = {
      'monthly': '月度会员',
      'yearly': '年度会员'
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
