// 风险结果页面逻辑 - 数据库版本
var app = getApp()

// 本地风险显示信息函数
function getRiskDisplayInfo(riskLevel) {
  var riskInfo = {
    low: {
      color: '#52c41a',  // 绿色
      icon: '🟢',
      title: '低风险',
      description: '居家观察，注意宠物状态变化'
    },
    mid: {
      color: '#faad14',  // 黄色
      icon: '🟡',
      title: '中风险',
      description: '建议线上问诊或近期就医'
    },
    high: {
      color: '#f5222d',  // 红色
      icon: '🔴',
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
    loading: true
  },

  onLoad: function(options) {
    var assessmentId = options.assessmentId
    var riskLevel = options.riskLevel
    var petId = options.petId

    console.log('风险结果页面加载, assessmentId:', assessmentId, 'riskLevel:', riskLevel, 'petId:', petId)

    if (!assessmentId || !riskLevel) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      var self = this
      setTimeout(function() {
        wx.navigateBack()
      }, 1500)
      return
    }

    // 设置风险显示信息
    var riskDisplayInfo = getRiskDisplayInfo(riskLevel)

    this.setData({
      assessmentId: assessmentId,
      riskLevel: riskLevel,
      riskDisplayInfo: riskDisplayInfo,
      petId: petId
    })

    // 加载评估详情
    this.loadAssessmentDetail()
  },

  // 从云函数加载评估详情和宠物信息
  loadAssessmentDetail: function() {
    var self = this
    var assessmentId = self.data.assessmentId

    console.log('从云函数加载评估详情, assessmentId:', assessmentId)

    // 检查云开发是否可用
    if (!app.globalData.cloudDevelopmentAvailable) {
      console.log('⚠️ 云开发不可用，使用本地模拟数据')
      self.loadLocalMockData()
      return
    }

    wx.cloud.callFunction({
      name: 'getRecordDetail',
      data: {
        openid: app.getOpenid(),
        assessmentId: assessmentId
      },
      success: function(res) {
        console.log('评估详情加载成功:', res.result)

        if (res.result.code === 0) {
          var data = res.result.data

          self.setData({
            assessmentDetail: data.assessmentDetail,
            matchedRule: data.assessmentDetail.matchedRule || '',
            selectedSymptoms: data.assessmentDetail.symptoms || [],
            petInfo: data.petInfo || {},
            loading: false
          })

        } else {
          console.log('评估记录获取失败:', res.result.msg)
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
        console.error('评估详情加载失败:', err)
        self.setData({
          loading: false
        })

        // 云函数调用失败，尝试本地模拟数据
        console.log('⚠️ 云函数调用失败，尝试本地模拟数据')
        app.globalData.cloudDevelopmentAvailable = false
        self.loadLocalMockData()
      }
    })
  },

  // === 新增：加载本地模拟数据（降级方案）===
  loadLocalMockData: function() {
    var self = this

    console.log('=== 使用本地模拟数据 ===')

    var mockData = {
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
    var advice = this.getAdviceByRiskLevel()
    var symptoms = this.data.selectedSymptoms

    var content = advice + '\n\n检测到以下症状：\n'

    if (symptoms && symptoms.length > 0) {
      for (var i = 0; i < symptoms.length; i++) {
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

  // 根据风险等级获取建议
  getAdviceByRiskLevel: function() {
    var adviceMap = {
      low: '居家观察：注意宠物状态变化，保持良好的饮食和作息。如有异常变化，请及时就医。',
      mid: '建议线上问诊：症状可能需要专业评估，建议咨询线上兽医或近期就医检查。',
      high: '立即就医：请不要拖延，立即前往最近的宠物医院就诊。'
    }

    return adviceMap[this.data.riskLevel] || '请咨询专业兽医'
  },

  // 前往急救通道
  goToEmergency: function() {
    wx.switchTab({
      url: '/pages/emergency/index'
    })
  },

  // 返回首页
  goHome: function() {
    wx.reLaunch({
      url: '/pages/index/index'
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
  }
})