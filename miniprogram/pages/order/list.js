// 订单列表页面逻辑
const { invokePayment } = require('../../utils/pay')
const logger = require('../../utils/logger.js')
const log = logger.child('OrderList')
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
    // 检查登录状态
    if (!this.checkLogin()) {
      return
    }
    this.loadOrders()
  },

  // 检查登录状态
  checkLogin: function() {
    let openid = app.getOpenid()
    if (!openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/user/index'
        })
      }, 1500)
      return false
    }
    return true
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
      'report': '/images/icons/clipboard.svg',
      'member_monthly': '/images/icons/crown.svg',
      'member_yearly': '/images/icons/crown.svg'
    }
    return iconMap[type] || '/images/icons/gift.svg'
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
  },

  // 点击订单卡片，跳转详情
  onOrderTap: function(e) {
    const order = e.currentTarget.dataset.order
    if (!order || !order._id) return
    wx.navigateTo({
      url: '/pages/order/detail?orderId=' + order._id
    })
  },

  // 阻止操作按钮冒泡（避免触发卡片点击）
  onActionTap: function() {
    // 什么都不做，只是阻止冒泡
  },

  // 立即支付
  payOrder: function(e) {
    const self = this
    const order = e.currentTarget.dataset.order
    const index = e.currentTarget.dataset.index

    if (!order || order.status !== 'pending') {
      wx.showToast({ title: '订单状态异常', icon: 'none' })
      return
    }

    wx.showLoading({ title: '正在发起支付...' })

    // 根据订单类型构造 createOrder 参数
    const createOrderParams = {
      token: app.globalData.token,
      repay: true
    }

    // 按订单类型补充参数
    const type = order.type
    if (type === 'report') {
      createOrderParams.type = 'report'
      createOrderParams.recordId = order.metadata && order.metadata.record_id
      if (!createOrderParams.recordId) {
        wx.hideLoading()
        wx.showToast({ title: '订单信息缺失，无法支付', icon: 'none' })
        return
      }
    } else if (type && type.startsWith('member')) {
      // member_monthly / member_yearly / member_family_monthly / member_family_yearly
      createOrderParams.type = type
      createOrderParams.memberTier = order.metadata && order.metadata.member_tier
      if (!createOrderParams.memberTier) {
        // 兼容旧数据：从 type 推断
        createOrderParams.memberTier = type.replace('member_', '')
      }
    } else if (type === 'points') {
      createOrderParams.type = 'points'
      createOrderParams.packType = order.metadata && order.metadata.pack_type
      if (!createOrderParams.packType) {
        wx.hideLoading()
        wx.showToast({ title: '订单信息缺失，无法支付', icon: 'none' })
        return
      }
    } else if (type === 'bundle') {
      wx.hideLoading()
      wx.showToast({ title: '套餐订单请重新购买', icon: 'none' })
      return
    } else {
      wx.hideLoading()
      wx.showToast({ title: '暂不支持的订单类型', icon: 'none' })
      return
    }

    wx.cloud.callFunction({
      name: 'createOrder',
      data: createOrderParams,
      success: function(res) {
        wx.hideLoading()
        if (!res.result || res.result.code !== 0) {
          wx.showToast({ title: (res.result && res.result.msg) || '发起支付失败', icon: 'none' })
          return
        }
        const data = res.result.data || {}
        if (data.payParams) {
          invokePayment(data.payParams)
            .then(function() {
              wx.showToast({ title: '支付成功', icon: 'success' })
              // 更新本地订单状态为已支付
              self.updateOrderStatus(index, 'paid')
            })
            .catch(function(err) {
              wx.showToast({ title: '支付未完成', icon: 'none' })
              log.warn('支付未完成:', err)
            })
        } else {
          wx.showToast({ title: '支付参数异常', icon: 'none' })
        }
      },
      fail: function() {
        wx.hideLoading()
        wx.showToast({ title: '网络错误，请重试', icon: 'none' })
      }
    })
  },

  // 取消订单
  cancelOrder: function(e) {
    const self = this
    const orderId = e.currentTarget.dataset.id
    const index = e.currentTarget.dataset.index

    if (!orderId) return

    wx.showModal({
      title: '取消订单',
      content: '确认取消该订单？取消后不可恢复。',
      confirmText: '确认取消',
      confirmColor: '#f5222d',
      cancelText: '再想想',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '正在取消...' })
          wx.cloud.callFunction({
            name: 'cancelOrder',
            data: {
              orderId: orderId,
              token: app.globalData.token
            },
            success: function(res2) {
              wx.hideLoading()
              if (res2.result && res2.result.code === 0) {
                wx.showToast({ title: '订单已取消', icon: 'success' })
                self.updateOrderStatus(index, 'closed')
              } else {
                wx.showToast({ title: res2.result.msg || '取消失败', icon: 'none' })
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
  },

  // 更新本地订单状态（避免重新加载整页）
  updateOrderStatus: function(index, newStatus) {
    const orders = this.data.orders
    if (index < 0 || index >= orders.length) return
    const statusTexts = {
      paid: '已支付',
      closed: '已关闭'
    }
    const statusColors = {
      paid: '#52c41a',
      closed: '#999'
    }
    // 用路径式 setData，确保视图更新（直接改 this.data.orders 同一引用不触发渲染）
    this.setData({
      [`orders[${index}].status`]: newStatus,
      [`orders[${index}].statusText`]: statusTexts[newStatus] || orders[index].statusText,
      [`orders[${index}].statusColor`]: statusColors[newStatus] || orders[index].statusColor
    })
  }
})
