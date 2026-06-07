// 订单列表页面逻辑
let app = getApp()

Page({
  data: {
    orders: [],
    loading: true,
    page: 1,
    hasMore: true,
    pageSize: 20
  },

  onLoad: function() {
    this.loadOrders()
  },

  onPullDownRefresh: function() {
    this.setData({ page: 1, hasMore: true, orders: [] })
    this.loadOrders()
  },

  onReachBottom: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadOrders()
    }
  },

  loadOrders: function() {
    let self = this

    if (!self.data.hasMore) return

    self.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'orderList',
      data: {
        page: self.data.page,
        pageSize: self.data.pageSize
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let newOrders = res.result.data.list || []
          // 为每个订单添加显示文本（WXML不能调用JS函数）
          // 注意：此处不能重新声明 self，外层 self 已是正确的 Page 引用
          for (let i = 0; i < newOrders.length; i++) {
            newOrders[i].typeText = self.getOrderTypeDisplay(newOrders[i].type)
            newOrders[i].typeIcon = self.getOrderTypeIcon(newOrders[i].type)
            newOrders[i].statusText = self.getStatusText(newOrders[i].status)
            newOrders[i].statusColor = self.getStatusColor(newOrders[i].status)
            newOrders[i].timeText = self.formatTime(newOrders[i].created_at)
            newOrders[i].amountDisplay = newOrders[i].amount ? (newOrders[i].amount / 100).toFixed(2) : '0.00'
          }
          let allOrders = self.data.orders.concat(newOrders)

          self.setData({
            orders: allOrders,
            page: self.data.page + 1,
            hasMore: newOrders.length >= self.data.pageSize,
            loading: false
          })
        } else {
          self.setData({ loading: false })
          wx.showToast({ title: res.result.msg || '获取订单失败', icon: 'none' })
        }
      },
      fail: function(err) {
        self.setData({ loading: false })
        wx.showToast({ title: '网络错误', icon: 'none' })
      },
      complete: function() {
        wx.stopPullDownRefresh()
      }
    })
  },

  getOrderTypeDisplay: function(type) {
    let typeMap = {
      'report': 'AI健康报告',
      'member_monthly': '月度会员',
      'member_yearly': '年度会员'
    }
    return typeMap[type] || '其他'
  },

  getOrderTypeIcon: function(type) {
    let iconMap = {
      'report': '📋',
      'member_monthly': '📅',
      'member_yearly': '🗓️'
    }
    return iconMap[type] || '📦'
  },

  getStatusColor: function(status) {
    let colorMap = {
      'paid': '#52c41a',
      'pending': '#faad14',
      'refunded': '#999',
      'closed': '#999',
      'failed': '#f5222d'
    }
    return colorMap[status] || '#999'
  },

  getStatusText: function(status) {
    let textMap = {
      'paid': '已支付',
      'pending': '待支付',
      'refunded': '已退款',
      'closed': '已关闭',
      'failed': '支付失败'
    }
    return textMap[status] || '未知'
  },

  formatAmount: function(amount) {
    return (amount / 100).toFixed(2)
  },

  formatTime: function(timeStr) {
    if (!timeStr) return ''
    let date = new Date(timeStr)
    let year = date.getFullYear()
    let month = date.getMonth() + 1
    let day = date.getDate()
    let hour = date.getHours()
    let minute = date.getMinutes()

    month = month < 10 ? '0' + month : month
    day = day < 10 ? '0' + day : day
    hour = hour < 10 ? '0' + hour : hour
    minute = minute < 10 ? '0' + minute : minute

    return year + '-' + month + '-' + day + ' ' + hour + ':' + minute
  },

  goBack: function() {
    wx.navigateBack()
  }
})
