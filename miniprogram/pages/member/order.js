// 会员购买页面
let app = getApp()

Page({
  data: {
    selectedType: 'yearly',
    purchasing: false,
    upgradeMode: false,
    renewMode: false,
    monthlyPrice: '29.90',
    yearlyPrice: '99.00',
    monthlyRenewPrice: '25.90',
    yearlyRenewPrice: '89.00',
    yearlySave: '省38%',
    monthlySave: '约3折',
    fromReport: false,
    returnAssessmentId: '',
    showPayProcessing: false,
    isDestroyed: false
  },

  onLoad: function(options) {
    if (!options) options = {}

    // 从 URL 参数接收来源信息
    if (options.fromReport === 'true' && options.assessmentId) {
      this.setData({
        fromReport: true,
        returnAssessmentId: options.assessmentId
      })
    }

    // 升级模式：月度 → 年度
    if (options.upgrade === 'true') {
      this.setData({
        upgradeMode: true,
        selectedType: 'yearly'
      })
    }

    // 续费模式：月度续费
    if (options.renew === 'monthly') {
      this.setData({
        renewMode: true,
        selectedType: 'monthly',
        monthlyPrice: '25.90'
      })
    }

    // 续费模式：年度续费
    if (options.renew === 'yearly') {
      this.setData({
        renewMode: true,
        selectedType: 'yearly',
        yearlyPrice: '89.00'
      })
    }
  },

  selectPlan: function(e) {
    let type = e.currentTarget.dataset.type
    // 升级/续费模式下锁定套餐选择
    if (this.data.upgradeMode || this.data.renewMode) return
    if (type === 'monthly' || type === 'yearly') {
      this.setData({ selectedType: type })
    }
  },

  confirmPurchase: function() {
    let self = this
    if (self.data.purchasing) return

    let isYearly = self.data.selectedType === 'yearly'
    let priceText = isYearly ? self.data.yearlyPrice : self.data.monthlyPrice
    let typeName = isYearly ? '年度会员' : '月度会员'

    // 升级确认
    if (self.data.upgradeMode) {
      wx.showModal({
        title: '升级会员',
        content: '从月度会员升级到年度会员\n确认以 ¥' + priceText + ' 升级？',
        confirmText: '确认升级',
        confirmColor: '#667eea',
        success: function(res) {
          if (res.confirm) self.doPurchase()
        }
      })
      return
    }

    // 续费确认
    if (self.data.renewMode) {
      wx.showModal({
        title: '续费会员',
        content: '确认以 ¥' + priceText + ' 续费' + typeName + '？',
        confirmText: '确认续费',
        confirmColor: '#667eea',
        success: function(res) {
          if (res.confirm) self.doPurchase()
        }
      })
      return
    }

    // 新开通确认
    wx.showModal({
      title: '确认开通',
      content: '确认以 ¥' + priceText + ' 开通' + typeName + '？',
      confirmText: '确认开通',
      confirmColor: '#667eea',
      success: function(res) {
        if (res.confirm) self.doPurchase()
      }
    })
  },

  doPurchase: function() {
    let self = this
    self.setData({ purchasing: true, showPayProcessing: true })

    // 模拟支付网关延迟 1.5 秒
    setTimeout(function() {
      if (self.data.isDestroyed) return
      wx.cloud.callFunction({
        name: 'memberActivate',
        data: { type: self.data.selectedType, token: app.globalData.token },
        success: function(res) {
          self.setData({ showPayProcessing: false })
          if (res.result && res.result.code === 0) {
            // 更新全局状态
            if (app.globalData.userInfo) {
              app.globalData.userInfo.isMember = true
            }
            // 清除缓存，下次获取最新数据
            try { wx.removeStorageSync('memberStatus') } catch (e) {}

            let toastTitle = self.data.upgradeMode ? '升级成功！' : (self.data.renewMode ? '续费成功！' : '开通成功！')
            wx.showToast({
              title: toastTitle,
              icon: 'success',
              duration: 1500
            })

            setTimeout(function() {
              if (self.data.fromReport && self.data.returnAssessmentId) {
                wx.redirectTo({
                  url: '/pages/risk/result?assessmentId=' + self.data.returnAssessmentId + '&riskLevel=mid'
                })
              } else {
                wx.navigateBack()
              }
            }, 1500)
          } else {
            wx.showToast({
              title: res.result.msg || '操作失败',
              icon: 'none',
              duration: 2000
            })
          }
        },
        fail: function() {
          self.setData({ showPayProcessing: false })
          wx.showToast({ title: '网络错误，请重试', icon: 'none' })
        },
        complete: function() {
          self.setData({ purchasing: false })
        }
      })
    }, 1500)
  },

  goBack: function() {
    wx.navigateBack()
  },

  onUnload: function() {
    // 页面卸载标记，防止 setTimeout 回调在页面销毁后执行
    this.setData({ isDestroyed: true })
  }
})
