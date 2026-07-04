// 客服中心页面
const logger = require('../../utils/logger.js')
const log = logger.child('ServiceCenter')
let app = getApp()

Page({
  data: {
    // FAQ 列表（P0 写死，P1 改为后台配置）
    faqList: [
      {
        question: 'AI准确吗？',
        answer: '我们的AI系统基于大量宠物健康数据训练，提供参考性建议。但对于严重症状，建议及时就医。',
        expanded: false
      },
      {
        question: '什么时候必须去医院？',
        answer: '当宠物出现以下症状时，建议立即就医：呼吸困难、持续呕吐、意识模糊、严重外伤、高烧不退等。AI检测到严重症状时会特别提醒。',
        expanded: false
      },
      {
        question: '会员有什么权益？',
        answer: '会员可享受：无限次AI健康评估、详细健康报告、专属客服支持、优先功能体验等权益。',
        expanded: false
      },
      {
        question: '如何查看历史报告？',
        answer: '在用户中心点击「我的报告」即可查看所有历史评估报告，报告永久保存。',
        expanded: false
      },
      {
        question: '如何联系客服？',
        answer: '您可以通过本页面的微信客服联系我们，工作时间为 9:00-18:00。也可以通过「提交反馈」向我们反馈问题。',
        expanded: false
      }
    ],
    // 养宠资料列表
    materialList: [
      { title: '新手养猫指南', checked: true },
      { title: '幼犬疫苗时间表', checked: true },
      { title: '猫咪食物禁忌', checked: true },
      { title: '常见疾病护理', checked: true }
    ],
    // 弹窗显示状态
    showMaterialModal: false,
    // 版本号
    appVersion: '1.5.0'
  },

  onLoad: function() {
    log.info('客服中心页面加载')
  },

  // 一键复制微信号
  copyWechatId: function() {
    const self = this
    wx.setClipboardData({
      data: 'MeworaAI',
      success: function() {
        wx.showToast({
          title: '微信号已复制',
          icon: 'success'
        })
        log.info('用户复制微信号')
      },
      fail: function() {
        wx.showToast({
          title: '复制失败，请重试',
          icon: 'none'
        })
      }
    })
  },

  // 显示养宠资料领取弹窗
  showMaterialModal: function() {
    this.setData({
      showMaterialModal: true
    })
    log.info('显示养宠资料弹窗')
  },

  // 关闭弹窗
  hideMaterialModal: function() {
    this.setData({
      showMaterialModal: false
    })
  },

  // 跳转反馈页面
  goToFeedback: function() {
    wx.navigateTo({
      url: '/pages/service/feedback'
    })
  },

  // 切换FAQ展开状态
  toggleFaq: function(e) {
    const index = e.currentTarget.dataset.index
    const expandedKey = `faqList[${index}].expanded`
    const newValue = !this.data.faqList[index].expanded

    this.setData({
      [expandedKey]: newValue
    })

    log.info('FAQ切换状态:', { index: index, expanded: newValue })
  },

  // 跳转协议中心
  goToAgreement: function() {
    wx.navigateTo({
      url: '/pages/agreement/index'
    })
  },

  // 小程序评分引导
  goToRate: function() {
    wx.showModal({
      title: '感谢支持',
      content: '如果Mewora对您有帮助，欢迎给五星好评！\n\n点击右上角「...」→ 「评价」',
      showCancel: false,
      confirmText: '我知道了'
    })
    log.info('用户触发好评引导')
  },

  // 防止弹窗内容点击穿透
  preventBubble: function() {
    // 阻止事件冒泡
  }
})
