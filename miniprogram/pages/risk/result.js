// 风险结果页面逻辑 - 数据库版本
const logger = require('../../utils/logger.js')
const log = logger.child('RiskResult')
const priceService = require('../../utils/price-service')
const { invokePayment } = require('../../utils/pay')
const helper = require('../../utils/coupon-helper')
let app = getApp()

// 本地风险显示信息函数
function getRiskDisplayInfo(riskLevel) {
  let riskInfo = {
    low: {
      color: '#52c41a',  // 绿色
      icon: '/images/icons/check.svg',
      title: '低风险',
      description: '居家观察，注意宠物状态变化'
    },
    mid: {
      color: '#faad14',  // 黄色
      icon: '/images/icons/warning.svg',
      title: '中风险',
      description: '建议线上问诊或近期就医'
    },
    high: {
      color: '#f5222d',  // 红色
      icon: '/images/icons/alert.svg',
      title: '高风险',
      description: '立即就医，不要拖延'
    }
  };

  return riskInfo[riskLevel] || riskInfo.low;
}

Page({
  data: {
    assessmentId: '',
    riskLevel: '',
    riskDisplayInfo: {},
    matchedRule: '',
    petInfo: {},
    selectedSymptoms: [],
    assessmentDetail: null,
    loading: true,
    quotaInfo: null,
    // V2.0: 动态价格
   standardReportDisplay: '9.90',
   firstReportDisplay: '0.00',
   riskMonthlyPrice: '19.90',
    riskMonthlyCredits: 3,
    // 点数包推荐文案（付费时点数包单份更划算）
    pointsPackDisplay: '19.90',
    pointsPackCount: 3,
    pointsPerReport: '6.6',
    purchasing: false,
    reportPurchased: false,
    hasExistingReport: false,
    showPayOptions: false,
    showDisclaimerModal: false,
    disclaimerAgreed: false,
    isMember: false,
    // 优惠券（仅付费报告）
    coupons: [],
    hasCoupons: false,
    selectedCouponId: '',
    couponDiscountFen: 0,
    couponDiscountDisplay: '0.00',
    finalPriceDisplay: ''
  },

  onLoad: function(options) {
    let assessmentId = options.assessmentId
    let riskLevel = options.riskLevel
    let petId = options.petId

    log.info('风险结果页面加载, assessmentId:', assessmentId, 'riskLevel:', riskLevel, 'petId:', petId)

    if (!assessmentId || !riskLevel) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      let self = this
      setTimeout(function() {
        wx.navigateBack()
      }, 1500)
      return
    }

    // 设置风险显示信息
    let riskDisplayInfo = getRiskDisplayInfo(riskLevel)

    this.setData({
      assessmentId: assessmentId,
      riskLevel: riskLevel,
      riskDisplayInfo: riskDisplayInfo,
      petId: petId
    })

    // 加载评估详情
    this.loadAssessmentDetail()
    // 并行发起配额检查，避免 AI 报告卡片延迟 1 秒
    this.checkReportQuota()
    // V2.0: 加载动态价格
    this.loadPrices()
  },

  // 从云函数加载评估详情和宠物信息
  loadAssessmentDetail: function() {
    let self = this
    let assessmentId = self.data.assessmentId

    // 设置会员状态
    self.setData({ isMember: app.globalData.userInfo && app.globalData.userInfo.isMember || false })

    log.info('从云函数加载评估详情, assessmentId:', assessmentId)

    // 检查云开发是否可用
    if (!app.globalData.cloudDevelopmentAvailable) {
      log.info('[WARN] 云开发不可用，使用本地模拟数据')
      self.loadLocalMockData()
      return
    }

    wx.cloud.callFunction({
      name: 'getRecordDetail',
      data: {
        assessmentId: assessmentId,
        token: getApp().globalData.token
      },
      success: function(res) {
        log.info('评估详情加载成功:', res.result)

        if (res.result.code === 0) {
          let data = res.result.data

          self.setData({
            assessmentDetail: data.assessmentDetail,
            matchedRule: data.assessmentDetail.matchedRule || '',
            selectedSymptoms: data.assessmentDetail.symptom_names || data.assessmentDetail.symptoms || [], // 优先使用symptom_names（中文名称）
            petInfo: data.petInfo || {},
            loading: false
          })

          // 检查是否已有AI报告（配额检查已在 onLoad 中并行发起）
          if (data.assessmentDetail.has_ai_report || data.assessmentDetail.aiCacheId) {
            self.setData({ hasExistingReport: true, reportPurchased: true })
          }

          // Phase 4: 处理邀请奖励（首次自查后触发）
          self.processInviteRewardIfNeeded(assessmentId)

        } else {
          log.info('评估记录获取失败:', res.result.msg)
          self.setData({
            loading: false
          })
          wx.showToast({
            title: res.result.msg || '获取失败',
            icon: 'none'
          })
        }
      },
      fail: function(err) {
        log.error('评估详情加载失败:', err)
        self.setData({
          loading: false
        })

        // 云函数调用失败，尝试本地模拟数据
        log.info('[WARN] 云函数调用失败，尝试本地模拟数据')
        app.globalData.cloudDevelopmentAvailable = false
        self.loadLocalMockData()
      }
    })
  },

  // === 新增：加载本地模拟数据（降级方案）===
  loadLocalMockData: function() {
    let self = this

    log.info('=== 使用本地模拟数据 ===')

    let mockData = {
      assessmentDetail: {
        _id: self.data.assessmentId,
        assessmentId: self.data.assessmentId,
        symptoms: ['食欲不振', '精神萎靡'],
        riskLevel: self.data.riskLevel,
        matchedRule: '风险规则匹配示例',
        assessmentDate: new Date().toISOString()
      },
      petInfo: {
        name: '示例宠物',
        type: 'cat',
        breed: '英国短毛猫',
        age: 2,
        weight: 4.5
      }
    }

    self.setData({
      assessmentDetail: mockData.assessmentDetail,
      matchedRule: mockData.assessmentDetail.matchedRule,
      selectedSymptoms: mockData.assessmentDetail.symptoms,
      petInfo: mockData.petInfo,
      loading: false
    })

    wx.showToast({
      title: '本地模式（演示数据）',
      icon: 'none',
      duration: 1500
    })
  },

  // 查看详细建议
  viewReport: function() {
    let advice = this.getAdviceByRiskLevel()
    let symptoms = this.data.selectedSymptoms

    let content = advice + '\n\n检测到以下症状：\n'

    if (symptoms && symptoms.length > 0) {
      for (let i = 0; i < symptoms.length; i++) {
        content += '• ' + symptoms[i] + '\n'
      }
    }

    wx.showModal({
      title: '详细评估报告',
      content: content,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 查看附近医院
  viewHospitals: function() {
    wx.switchTab({
      url: '/pages/hospital/list'
    })
  },

  // 根据风险等级获取建议
  getAdviceByRiskLevel: function() {
    let adviceMap = {
      low: '居家观察：注意宠物状态变化，保持良好的饮食和作息。如有异常变化，请及时就医。',
      mid: '建议线上问诊：症状可能需要专业评估，建议咨询线上兽医或近期就医检查。',
      high: '立即就医：请不要拖延，立即前往最近的宠物医院就诊。'
    }

    return adviceMap[this.data.riskLevel] || '请咨询专业兽医'
  },

  // 前往急救通道（高风险）
  goToEmergency: function() {
    // 根据文档传递参数
    try {
      wx.setStorageSync('fromRiskResult', true)
      wx.setStorageSync('riskLevel', 'high')
      wx.setStorageSync('petId', this.data.petId)
    } catch (e) {
      log.error('存储参数失败:', e)
    }

    wx.switchTab({
      url: '/pages/emergency/index'
    })
  },

  // Phase 4: 处理邀请奖励
  processInviteRewardIfNeeded: function(recordId) {
    let inviteCode = app.globalData.pendingInviteCode
    if (!inviteCode) return

    // 清除邀请码，防止重复触发
    app.globalData.pendingInviteCode = null

    wx.cloud.callFunction({
      name: 'processInviteReward',
      data: { recordId: recordId, inviteCode: inviteCode },
      success: function(res) {
        if (res.result && res.result.code === 0 && res.result.data.rewarded) {
          wx.showToast({ title: '邀请奖励已发放！', icon: 'success', duration: 2000 })
        }
      },
      fail: function() {
        // 静默失败，不影响用户体验
      }
    })
  },

  // 返回首页
  goHome: function() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 跳转会员页面
  goToMember: function() {
    wx.navigateTo({
      url: '/pages/member/order'
    })
  },

  // 跳转点数包页面（额度不足时，点数包单份更划算）
  goToPoints: function() {
    wx.navigateTo({
      url: '/pages/points/index'
    })
  },

  // 跳转会员页面（带返回报告生成参数）
  goToMemberWithReport: function() {
    wx.navigateTo({
      url: '/pages/member/order?fromReport=true&assessmentId=' + this.data.assessmentId
    })
  },

  // 查看历史记录
  viewHistory: function() {
    wx.showToast({
      title: '历史记录功能开发中',
      icon: 'none'
    })
  },

  // 重新评估
  reassess: function() {
    wx.navigateBack()
  },

  // 通过公共服务加载价格配置
  loadPrices: function() {
    var self = this
    priceService.fetchPricesWithCallback(function(d) {
      if (!d) return
      var pack = d.points && d.points.pack3
      var packDisplay = pack && pack.display ? pack.display : '19.90'
      var packCount = pack && pack.count ? pack.count : 3
      var perReport = (parseFloat(packDisplay) / packCount).toFixed(1)
      self.setData({
        standardReportDisplay: d.standardReportDisplay,
        firstReportDisplay: d.firstReportDisplay,
        riskMonthlyPrice: d.monthly.display,
        riskMonthlyCredits: d.monthly.credits,
        pointsPackDisplay: packDisplay,
        pointsPackCount: packCount,
        pointsPerReport: perReport
      })
    })
  },

  checkReportQuota: function() {
    let self = this
    wx.cloud.callFunction({
      name: 'checkReportQuota',
      data: { token: app.globalData.token },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          self.setData({ quotaInfo: res.result.data })
          // 仅付费报告加载可选券
          if (res.result.data && res.result.data.quota_source === 'paid') {
            self.loadCouponsForReport()
          }
          // 检查是否有待支付订单，引导恢复
          self.checkPendingOrder()
        }
      }
    })
  },

  // 当前报告订单原价（分）= 后端 quotaInfo.price（权威）；orderType=report
  orderPriceFen: function() {
    return (this.data.quotaInfo && this.data.quotaInfo.price) || 0
  },

  // 加载可用报告券（后端按 orderType=report 过滤，含 universal）；默认预选最优
  loadCouponsForReport: function() {
    var self = this
    if (!app.globalData.cloudDevelopmentAvailable) return
    helper.loadCoupons(
      app.globalData.token, 'report', this.orderPriceFen(),
      function(snap) { self.setData(snap) },
      function() {}
    )
  },

  // 券选择变化时重算折扣与实付
  recomputeCoupon: function() {
    var enriched = helper.enrichCoupons(this.data.coupons, this.orderPriceFen())
    this.setData(helper.computeFinal(enriched, this.data.selectedCouponId, this.orderPriceFen()))
  },

  selectCoupon: function(e) {
    var id = e.currentTarget.dataset.id || ''
    var next = helper.toggleSelect(this.data.selectedCouponId, id, this.data.coupons)
    this.setData({ selectedCouponId: next })
    this.recomputeCoupon()
  },

  // 检查是否有待支付订单（支付中断恢复）
  checkPendingOrder: function() {
    var self = this
    if (!app.globalData.cloudDevelopmentAvailable) return
    wx.cloud.callFunction({
      name: 'orderList',
      data: { token: app.globalData.token, status: 'pending', limit: 1 },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var orders = res.result.data && res.result.data.orders
          if (orders && orders.length > 0) {
            var order = orders[0]
            wx.showModal({
              title: '待支付订单',
              content: '您有一笔未完成的订单（' + (order.description || 'AI报告') + '），是否继续支付？',
              confirmText: '继续支付',
              cancelText: '取消订单',
              success: function(modalRes) {
                if (modalRes.confirm) {
                  // 继续支付：直接生成报告（内部会复用订单逻辑）
                  self.generateReport(self.data.assessmentId)
                } else {
                  // 取消订单
                  wx.cloud.callFunction({
                    name: 'cancelOrder',
                    data: { orderId: order._id, token: app.globalData.token },
                    success: function() {
                      wx.showToast({ title: '订单已取消', icon: 'success' })
                    }
                  })
                }
              }
            })
          }
        }
      }
    })
  },

  // 获取AI报告（generateAIReport 内部统一处理：查额度 → 生成报告 → 扣额度 → 创建订单）
  getAIReport: function() {
    let self = this
    let quotaInfo = self.data.quotaInfo
    let assessmentId = self.data.assessmentId

    if (self.data.purchasing) return

    // 合规：先检查免责声明是否已接受（每人仅需勾选一次）
    var disclaimerAccepted = wx.getStorageSync('disclaimer_accepted_report')
    if (!disclaimerAccepted) {
      self.setData({ showDisclaimerModal: true, disclaimerAgreed: false })
      return
    }

    self._proceedToGetReport()
  },

  // 切换免责声明勾选
  toggleDisclaimerAgree: function() {
    this.setData({ disclaimerAgreed: !this.data.disclaimerAgreed })
  },

  // 确认免责声明
  confirmDisclaimer: function() {
    if (!this.data.disclaimerAgreed) {
      wx.showToast({ title: '请先勾选同意声明', icon: 'none' })
      return
    }
    wx.setStorageSync('disclaimer_accepted_report', true)
    this.setData({ showDisclaimerModal: false })
    this._proceedToGetReport()
  },

  // 实际执行获取报告逻辑
  _proceedToGetReport: function() {
    var self = this
    var quotaInfo = self.data.quotaInfo
    var assessmentId = self.data.assessmentId

    // 防重复点击
    if (self.data.purchasing) return

   // 首份免费，确认后直接生成
   if (quotaInfo && quotaInfo.quota_source === 'first_report') {
     wx.showModal({
       title: '获取AI健康报告',
       content: '新用户首份免费，包含症状分析、护理建议、就医指导等8大章节。',
       confirmText: '确认获取',
        cancelText: '再想想',
        success: function(res) {
          if (res.confirm) {
            self.generateReport(assessmentId)
          }
        }
      })
      return
    }

    // 会员/邀请免费额度 或 付费：直接生成（generateAIReport 内部扣额度）
    self.generateReport(assessmentId)
  },

  // 选择单份购买
  paySingleReport: function() {
    let self = this
    self.setData({ showPayOptions: false })
    self.generateReport(self.data.assessmentId)
  },

  // 选择开通会员
  chooseMembership: function() {
    let self = this
    self.setData({ showPayOptions: false })
    self.goToMemberWithReport()
  },

  // 关闭支付选项面板
  closePayOptions: function() {
    this.setData({ showPayOptions: false })
  },

  // 生成AI报告：先 createOrder（解析额度/下单）→ 需支付则 requestPayment → generateAIReport
  generateReport: function(recordId) {
    let self = this
    self.setData({ purchasing: true })
    wx.showLoading({ title: '正在下单...' })

    wx.cloud.callFunction({
      name: 'createOrder',
      data: { type: 'report', recordId: recordId, couponId: self.data.selectedCouponId || '', token: app.globalData.token },
      success: function(res) {
        wx.hideLoading()
        if (!res.result || res.result.code !== 0) {
          self.setData({ purchasing: false })
          wx.showToast({ title: (res.result && res.result.msg) || '下单失败', icon: 'none' })
          return
        }
        var data = res.result.data || {}
        // 该记录已有报告，直接查看
        if (data.existingReportId) {
          self.setData({ purchasing: false, reportPurchased: true })
          wx.navigateTo({ url: '/pages/ai-report/index?recordId=' + recordId })
          return
        }
        // 付费订单：先调起支付，成功后生成
        if (data.payParams) {
          self._payAndGenerate(recordId, data.payParams)
        } else {
          // 免费/mock/0 元：订单已就绪，直接生成
          self._invokeGenerate(recordId)
        }
      },
      fail: function() {
        wx.hideLoading()
        self.setData({ purchasing: false })
        wx.showToast({ title: '下单失败，请重试', icon: 'none' })
      }
    })
  },

  // 调起支付，成功后生成报告
  _payAndGenerate: function(recordId, payParams) {
    let self = this
    invokePayment(payParams)
      .then(function() {
        self._invokeGenerate(recordId)
      })
      .catch(function(err) {
        self.setData({ purchasing: false })
        // 用户取消或支付失败：订单保留 PENDING，可稍后继续或被自动关闭
        wx.showToast({ title: '支付未完成', icon: 'none' })
        log.warn('report payment unfinished', err)
      })
  },

  // 实际生成报告（订单已就绪/已支付）
  _invokeGenerate: function(recordId) {
    let self = this
    wx.showLoading({ title: '正在生成AI报告...' })
    wx.cloud.callFunction({
      name: 'generateAIReport',
      data: { recordId: recordId, token: app.globalData.token },
      success: function(res) {
        wx.hideLoading()
        self.setData({ purchasing: false })
        if (res.result && res.result.code === 0) {
          self.setData({ reportPurchased: true })
          wx.navigateTo({ url: '/pages/ai-report/index?recordId=' + recordId })
        } else if (res.result && res.result.data && res.result.data.needPayment) {
          wx.showToast({ title: '请先完成支付', icon: 'none' })
        } else {
          wx.showToast({ title: (res.result && res.result.msg) || '生成报告失败', icon: 'none' })
        }
      },
      fail: function() {
        wx.hideLoading()
        self.setData({ purchasing: false })
        wx.showToast({ title: '生成报告失败', icon: 'none' })
      }
    })
  },

  // 查看已有报告
  viewExistingReport: function() {
    let self = this
    wx.navigateTo({
      url: '/pages/ai-report/index?recordId=' + self.data.assessmentId
    })
  }
})
