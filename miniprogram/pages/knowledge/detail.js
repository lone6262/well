// 知识库文章详情页面
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
          let article = res.result.data || {}

          // 降级链: content → summary → 默认提示
          let contentBody = article.content || article.summary || ''
          if (!contentBody) {
            contentBody = '## 暂无详细内容\n\n本文正在编辑中，请稍后再试。\n\n如需了解更多宠物健康知识，请浏览其他文章或使用症状自查功能。'
          }
          let nodes = self.parseContent(contentBody)

          // 字段名映射（数据库 snake_case → 前端 camelCase）
          let categoryMap = {
            'digestive': '消化系统',
            'respiratory': '呼吸系统',
            'behavior': '行为异常',
            'prevention': '预防保健',
            'care': '特殊阶段'
          }
          let petTypeMap = {
            'cat': '🐱猫咪',
            'dog': '🐶狗狗',
            'all': '🐱🐶全部'
          }

          self.setData({
            article: article,
            nodes: nodes,
            relatedSymptoms: article.related_symptoms || article.relatedSymptoms || [],
            petTypeText: petTypeMap[article.target_pet] || '🐱🐶全部',
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
        console.error('加载文章详情失败:', err)
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },

  // 将文章内容转换为rich-text组件可用的节点数组
  parseContent: function(content) {
    if (!content) return []

    let lines = content.split('\n')
    let nodes = []

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      let trimmed = line.trim()

      if (!trimmed) continue

      // 二级标题
      if (trimmed.indexOf('## ') === 0) {
        nodes.push({
          name: 'h2',
          attrs: { class: 'content-h2' },
          children: [{
            type: 'text',
            text: trimmed.substring(3)
          }]
        })
      }
      // 三级标题
      else if (trimmed.indexOf('### ') === 0) {
        nodes.push({
          name: 'h3',
          attrs: { class: 'content-h3' },
          children: [{
            type: 'text',
            text: trimmed.substring(4)
          }]
        })
      }
      // 列表项
      else if (trimmed.indexOf('- ') === 0) {
        nodes.push({
          name: 'div',
          attrs: { class: 'content-li' },
          children: [{
            type: 'text',
            text: trimmed.substring(2)
          }]
        })
      }
      // 普通段落
      else {
        nodes.push({
          name: 'p',
          attrs: { class: 'content-p' },
          children: [{
            type: 'text',
            text: trimmed
          }]
        })
      }
    }

    return nodes
  },

  // 宠物类型文字
  getPetTypeText: function(petType) {
    let map = { cat: '🐱猫咪', dog: '🐶狗狗', all: '🐱🐶全部' }
    return map[petType] || '🐱🐶全部'
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
