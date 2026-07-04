// 协议中心页面
const logger = require('../../utils/logger.js')
const log = logger.child('AgreementCenter')

Page({
  data: {
    // 协议列表
    agreementList: [
      {
        id: 'user',
        title: '用户协议',
        desc: '了解平台使用规则和用户权利义务',
        icon: 'user.svg'
      },
      {
        id: 'privacy',
        title: '隐私政策',
        desc: '了解我们如何保护您的个人信息',
        icon: 'clipboard.svg'
      },
      {
        id: 'disclaimer',
        title: '免责声明',
        desc: '了解平台服务的免责范围',
        icon: 'warning.svg'
      },
      {
        id: 'member',
        title: '会员服务协议',
        desc: '了解会员服务的具体条款',
        icon: 'star.svg'
      },
      {
        id: 'child',
        title: '儿童个人信息保护规则',
        desc: '了解儿童个人信息的保护措施',
        icon: 'paw.svg'
      },
      {
        id: 'ai-usage',
        title: 'AI使用说明',
        desc: '了解AI服务的使用限制和注意事项',
        icon: 'question.svg'
      }
    ]
  },

  onLoad: function() {
    log.info('协议中心页面加载')
  },

  // 查看协议详情
  viewAgreement: function(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/agreement/' + id
    })
    log.info('查看协议:', id)
  }
})
