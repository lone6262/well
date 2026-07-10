// 知识库文章详情页面
const logger = require('../../utils/logger.js')
const log = logger.child('KnowledgeDetail')
let app = getApp()

Page({
  data: {
    article: {},
    nodes: [],
    loading: true,
    relatedSymptoms: [],
    articleId: ''
  },

  onLoad: function(options) {
    let articleId = options.id || ''

    if (!articleId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      this.setData({ loading: false })
      return
    }

    this.setData({ articleId: articleId })
    this.loadArticle()
  },

  // 加载文章详情
  loadArticle: function() {
    let self = this
    let openid = app.getOpenid()

    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      self.setData({ loading: false })
      return
    }

    if (!app.globalData.cloudDevelopmentAvailable) {
      self.setData({ loading: false })
      return
    }

    wx.cloud.callFunction({
      name: 'getKnowledgeDetail',
      data: {
        articleId: self.data.articleId
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          // 云函数返回 data.article，需要正确提取
          let article = res.result.data.article || res.result.data || {}

          // 降级链: content → summary → 默认提示
          let contentBody = article.content || article.summary || ''
          if (!contentBody) {
            contentBody = '## 暂无详细内容\n\n本文正在编辑中，请稍后再试。\n\n如需了解更多宠物健康知识，请浏览其他文章或使用症状自查功能。'
          }

          log.debug('文章标题:', article.title)
          log.debug('原始内容长度:', contentBody.length)
          log.debug('内容预览:', contentBody.substring(0, 100))

          let nodes = self.parseContent(contentBody)

          log.debug('解析后节点类型:', typeof nodes)
          log.debug('解析后内容长度:', String(nodes).length)
          log.debug('解析后内容预览:', String(nodes).substring(0, 200))

          // 字段名映射（数据库 snake_case → 前端 camelCase）
          let categoryMap = {
            'digestive': '消化系统',
            'respiratory': '呼吸系统',
            'behavior': '行为异常',
            'prevention': '预防保健',
            'care': '特殊阶段'
          }
          let petTypeMap = {
            'cat': '猫咪',
            'dog': '狗狗',
            'all': '全部'
          }

          self.setData({
            article: article,
            nodes: nodes,
            relatedSymptoms: article.related_symptoms || article.relatedSymptoms || [],
            petTypeText: petTypeMap[article.target_pet] || '全部',
            categoryName: categoryMap[article.category] || article.category || '',
            loading: false
          })

          // 动态设置导航栏标题
          if (article.title) {
            wx.setNavigationBarTitle({
              title: article.title
            })
          }
        } else {
          self.setData({ loading: false })
          wx.showToast({ title: res.result.msg || '文章不存在', icon: 'none' })
        }
      },
      fail: function(err) {
        log.error('加载文章详情失败:', err)
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },

  // 将文章内容转换为rich-text组件可用的节点数组
  // 使用 rich-text 支持的 HTML 标签: h1 h2 h3 p div
  parseContent: function(content) {
    if (!content) return []

    // 简单处理：将 Markdown 转换为 HTML，然后使用 rich-text 渲染
    let html = content
      // 一级标题
      .replace(/^# (.+)$/gm, '<h1 style="font-size:24px;font-weight:bold;margin:16px 0 8px;color:#2D2A26;">$1</h1>')
      // 二级标题
      .replace(/^## (.+)$/gm, '<h2 style="font-size:20px;font-weight:bold;margin:14px 0 6px;color:#2D2A26;">$1</h2>')
      // 三级标题
      .replace(/^### (.+)$/gm, '<h3 style="font-size:18px;font-weight:bold;margin:12px 0 6px;color:#2D2A26;">$1</h3>')
      // 引用块
      .replace(/^> (.+)$/gm, '<div style="background:#FEF7E0;padding:12px;border-left:4px solid #F5D547;margin:12px 0;border-radius:4px;color:#666;">$1</div>')
      // 列表项
      .replace(/^[-*] (.+)$/gm, '<p style="margin:6px 0;padding-left:16px;">• $1</p>')
      // 粗体
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 普通段落（非空行）
      .replace(/^(?!<[hH]|[pP]|$)(.+)$/gm, '<p style="line-height:1.6;margin:12px 0;color:#4A4743;">$1</p>')

    // 返回 HTML 字符串格式（rich-text 支持直接使用 HTML）
    return html
  },

  // 宠物类型文字
  getPetTypeText: function(petType) {
    let map = { cat: '猫咪', dog: '狗狗', all: '全部' }
    return map[petType] || '全部'
  },

  // 相关症状自查
  onSymptomCheck: function() {
    wx.switchTab({
      url: '/pages/symptom/guide'
    })
  },

  // 分享（带邀请码）
  onShareAppMessage: function() {
    let app = getApp()
    let inviteCode = app.globalData.currentInviteCode || ''
    let path = '/pages/knowledge/detail?id=' + this.data.articleId
    if (inviteCode) { path += '&invite_code=' + inviteCode }
    return {
      title: this.data.article.title || '宠物知识库',
      path: path
    }
  }
})
