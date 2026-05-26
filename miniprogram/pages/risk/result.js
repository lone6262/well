// 风险结果页面逻辑 - ES5完全兼容版本
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
    recordId: '',
    riskLevel: '',
    riskDisplayInfo: {},
    matchedRule: '',
    petInfo: {},
    selectedSymptoms: []
  },

  onLoad: function(options) {
    var recordId = options.recordId
    var riskLevel = options.riskLevel

    if (!recordId || !riskLevel) {
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
      recordId: recordId,
      riskLevel: riskLevel,
      riskDisplayInfo: riskDisplayInfo
    })

    // 加载评估详情
    this.loadAssessmentDetail()
  },

  // 加载评估详情（ES5兼容版本）
  loadAssessmentDetail: function() {
    try {
      // 这里应该调用云函数获取详细信息
      // 暂时使用模拟数据
      var mockData = {
        matchedRule: '高风险-呼吸困难',
        petInfo: {
          name: '咪咪',
          type: 'cat'
        },
        selectedSymptoms: ['呼吸困难', '咳嗽']
      }

      this.setData(mockData)
    } catch (error) {
      console.error('加载评估详情失败:', error)
    }
  },

  // 查看详细建议
  viewReport: function() {
    // V1.0版本暂时显示固定建议
    wx.showModal({
      title: '护理建议',
      content: this.getAdviceByRiskLevel(),
      showCancel: false
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
  }
})