// AI健康报告页面
const logger = require('../../utils/logger.js')
const log = logger.child('AiReport')
let app = getApp()

Page({
  data: {
    report: {},
    sections: [],
    loading: true,
    expandedSections: [],
    recordId: ''
  },

  onLoad: function(options) {
    let recordId = options.recordId || ''

    if (!recordId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      this.setData({ loading: false })
      return
    }

    this.setData({ recordId: recordId })
    this.loadReport()
  },

  // 加载AI报告
  loadReport: function() {
    let self = this

    if (!app.globalData.cloudDevelopmentAvailable) {
      self.setData({ loading: false })
      return
    }

    wx.cloud.callFunction({
      name: 'generateAIReport',
      data: {
        recordId: self.data.recordId,
        token: app.globalData.token
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let reportData = res.result.data || {}
          let reportContent = reportData.content || {}

          // 校验报告内容有效性：如果关键字段全为空，展示友好提示
          if (!reportContent.risk_summary && !reportContent.home_care) {
            log.warn('AI报告内容为空，显示提示信息')
            self.setData({ loading: false })
            wx.showModal({
              title: '报告生成中',
              content: 'AI报告内容正在处理中，请稍后重新查看。如果问题持续，请尝试重新提交评估。',
              showCancel: false,
              confirmText: '知道了'
            })
            return
          }

          let sections = self.parseSections(reportContent)
          let expandedSections = []

          for (let i = 0; i < sections.length; i++) {
            expandedSections.push(sections[i].expanded)
          }

          self.setData({
            report: {
              risk_level: reportData.risk_level || 'low',
              created_at: reportData.created_at || '刚刚',
              source: reportData.source || '',
              pet_name: reportData.pet_name || ''
            },
            sections: sections,
            expandedSections: expandedSections,
            loading: false
          })
        } else {
          self.setData({ loading: false })
          wx.showToast({ title: res.result.msg || '报告生成失败', icon: 'none' })
        }
      },
      fail: function(err) {
        log.error('加载AI报告失败:', err)
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },

  // 解析报告内容为显示用的章节
  parseSections: function(reportContent) {
    let sections = []

    // 风险概述
    sections.push({
      key: 'risk_summary',
      title: '风险概述',
      icon: '/images/icons/warning.svg',
      type: 'text',
      content: reportContent.risk_summary || '暂无风险概述信息',
      expanded: true
    })

    // 症状分析
    let symptomList = reportContent.symptom_analysis || []
    sections.push({
      key: 'symptom_analysis',
      title: '症状分析',
      icon: '/images/icons/pin.svg',
      type: 'symptoms',
      content: symptomList,
      expanded: true
    })

    // 家庭护理建议
    let homeCareList = reportContent.home_care || []
    sections.push({
      key: 'home_care',
      title: '家庭护理建议',
      icon: '/images/icons/paw.svg',
      type: 'list',
      content: homeCareList,
      expanded: true
    })

    // 观察指标
    let observationList = reportContent.observation_indicators || []
    sections.push({
      key: 'observation',
      title: '观察指标',
      icon: '/images/icons/eye.svg',
      type: 'list',
      content: observationList,
      expanded: false
    })

    // 风险升级信号
    let escalationList = reportContent.escalation_signals || []
    sections.push({
      key: 'escalation',
      title: '风险升级信号',
      icon: '/images/icons/alert.svg',
      type: 'list',
      content: escalationList,
      expanded: false
    })

    // 就医建议（可能是对象或字符串）
    let vetRec = reportContent.vet_recommendation
    let vetText = '暂无就医建议'
    if (vetRec) {
      if (typeof vetRec === 'string') {
        vetText = vetRec
      } else if (typeof vetRec === 'object') {
        let parts = []
        if (vetRec.needed !== undefined) {
          parts.push(vetRec.needed ? '建议就医' : '暂不需要就医')
        }
        if (vetRec.urgency) {
          let urgencyMap = { low: '低紧急', medium: '中等紧急', high: '紧急' }
          parts.push('紧急程度：' + (urgencyMap[vetRec.urgency] || vetRec.urgency))
        }
        if (vetRec.what_to_tell_vet) {
          parts.push('就诊告知：' + vetRec.what_to_tell_vet)
        }
        if (vetRec.preparation) {
          parts.push('就诊准备：' + vetRec.preparation)
        }
        if (vetRec.estimated_cost) {
          parts.push('预估费用：' + vetRec.estimated_cost)
        }
        if (vetRec.recommended_checkup) {
          parts.push('建议检查：' + vetRec.recommended_checkup)
        }
        if (vetRec.time_sensitivity) {
          parts.push('时间敏感性：' + vetRec.time_sensitivity)
        }
        if (vetRec.home_remedies_to_avoid && vetRec.home_remedies_to_avoid.length > 0) {
          parts.push('不建议尝试：' + vetRec.home_remedies_to_avoid.join('、'))
        }
        vetText = parts.length > 0 ? parts.join('\n') : '暂无就医建议'
      }
    }
    sections.push({
      key: 'vet_recommendation',
      title: '就医建议',
      icon: '/images/icons/hospital.svg',
      type: 'text',
      content: vetText,
      expanded: false
    })

    // 常见误区
    let misconceptionsList = reportContent.common_misconceptions || []
    sections.push({
      key: 'misconceptions',
      title: '常见误区',
      icon: '/images/icons/warning.svg',
      type: 'misconceptions',
      content: misconceptionsList,
      expanded: false
    })

    // 免责声明
    sections.push({
      key: 'disclaimer',
      title: '免责声明',
      icon: '/images/icons/clipboard.svg',
      type: 'text',
      content: reportContent.disclaimer || '本报告由AI生成，仅供参考，不构成专业兽医诊断建议。如有疑问请咨询专业兽医。',
      expanded: false
    })

    return sections
  },

  // 展开/收起章节
  toggleSection: function(e) {
    let index = e.currentTarget.dataset.index
    let expandedSections = this.data.expandedSections.slice()
    expandedSections[index] = !expandedSections[index]
    this.setData({ expandedSections: expandedSections })
  },

  // 分享（带邀请码）
  onShareAppMessage: function() {
    let app = getApp()
    let inviteCode = app.globalData.currentInviteCode || ''
    let path = '/pages/ai-report/index?recordId=' + this.data.recordId
    if (inviteCode) { path += '&invite_code=' + inviteCode }
    return {
      title: '宠物健康AI报告',
      path: path
    }
  },

  // 返回首页
  goHome: function() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 查看记录
  goHistory: function() {
    wx.navigateTo({
      url: '/pages/user/records'
    })
  }
})