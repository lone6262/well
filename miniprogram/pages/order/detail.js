// 订单详情页面
let app = getApp()

let TYPE_MAP = {
  report: { text: 'AI报告', icon: '/images/icons/clipboard.svg' },
  member: { text: '会员', icon: '/images/icons/crown.svg' },
  member_monthly: { text: '月度会员', icon: '/images/icons/crown.svg' },
  member_yearly: { text: '年度会员', icon: '/images/icons/crown.svg' }
}

let STATUS_MAP = {
  pending: { text: '待支付', color: '#faad14' },
  paid: { text: '已支付', color: '#52c41a' },
  refund_requested: { text: '退款中', color: '#1890ff' },
  refunded: { text: '已退款', color: '#1890ff' },
  failed: { text: '支付失败', color: '#f5222d' },
  closed: { text: '已关闭', color: '#999' }
}

Page({
  data: {
    loading: true,
    order: null,
    typeText: '',
    typeIcon: '',
    statusText: '',
    statusColor: '',
    amountDisplay: '',
    createdText: '',
    paidText: ''
  },

  onLoad: function(options) {
    if (options.orderId) {
      this.loadOrder(options.orderId)
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' })
    }
  },

  loadOrder: function(orderId) {
    let self = this
    self.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'orderDetail',
      data: { orderId: orderId },
      success: function(res) {
        if (res.result && res.result.code === 0 && res.result.data.order) {
          let order = res.result.data.order
          let typeInfo = TYPE_MAP[order.type] || { text: '订单', icon: '/images/icons/gift.svg' }
          let statusInfo = STATUS_MAP[order.status] || { text: '未知', color: '#999' }

          let createdText = self.formatDate(order.created_at)
          let paidText = self.formatDate(order.paid_at)

          self.setData({
            loading: false,
            order: order,
            typeText: typeInfo.text,
            typeIcon: typeInfo.icon,
            statusText: statusInfo.text,
            statusColor: statusInfo.color,
            amountDisplay: order.amountDisplay || ((order.amount || 0) / 100).toFixed(2),
            createdText: createdText,
            paidText: paidText
          })
        } else {
          self.setData({ loading: false })
          wx.showToast({ title: '订单不存在', icon: 'none' })
        }
      },
      fail: function() {
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },

  formatDate: function(date) {
    if (!date) return ''
    let d = new Date(date)
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  },

  copyOrderNo: function() {
    wx.setClipboardData({
      data: this.data.order.out_trade_no || '',
      success: function() {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  goBack: function() {
    wx.navigateBack()
  },

  // 申请退款
  requestRefund: function() {
    var self = this
    var order = self.data.order
    if (!order) return

    wx.showModal({
      title: '申请退款',
      content: '确认申请退款 ¥' + self.data.amountDisplay + '？\n\n本产品为虚拟商品，一经生成不支持退款，系统故障除外。退款一般 T+1~3 个工作日到账。',
      confirmText: '确认退款',
      cancelText: '再想想',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '提交中...' })
          wx.cloud.callFunction({
            name: 'requestRefund',
            data: {
              orderId: order._id,
              reason: '用户主动申请退款',
              token: app.globalData.token
            },
            success: function(res2) {
              wx.hideLoading()
              if (res2.result && res2.result.code === 0) {
                wx.showToast({ title: '退款申请已提交', icon: 'success' })
                // 刷新订单状态
                setTimeout(function() { self.loadOrder() }, 1500)
              } else {
                wx.showToast({ title: res2.result.msg || '提交失败', icon: 'none' })
              }
            },
            fail: function() {
              wx.hideLoading()
              wx.showToast({ title: '网络错误', icon: 'none' })
            }
          })
        }
      }
    })
  }
})
