// 宠物知识库列表页面
let app = getApp()
const { UNIT_CONVERSION } = require('../../utils/constants.js')

// 分类映射表
let CATEGORY_MAP = {
  '全部': '',
  '消化系统': 'digestive',
  '呼吸系统': 'respiratory',
  '行为异常': 'behavior',
  '预防保健': 'prevention',
  '特殊阶段': 'care'
}

Page({
  data: {
    categories: ['全部', '消化系统', '呼吸系统', '行为异常', '预防保健', '特殊阶段'],
    activeCategory: '全部',
    articles: [],
    loading: true,
    page: 1,
    hasMore: false,
    pageSize: 10
  },

  onLoad: function(options) {
    this.loadArticles()
  },

  // 加载文章列表
  loadArticles: function() {
    let self = this
    let openid = app.getOpenid()

    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      self.setData({ loading: false })
      return
    }

    if (!app.globalData.cloudDevelopmentAvailable) {
      self.setData({
        loading: false,
        articles: []
      })
      return
    }

    let category = CATEGORY_MAP[self.data.activeCategory] || ''
    let currentPage = self.data.page

    wx.cloud.callFunction({
      name: 'getKnowledgeList',
      data: {
        category: category,
        page: currentPage,
        pageSize: self.data.pageSize
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let data = res.result.data
          let articles = data.articles || []

          // 格式化文章数据
          articles = articles.map(function(article) {
            article.petTypeText = self.getPetTypeText(article.petType)
            article.summaryText = (article.summary || '').substring(0, 60)
            article.viewText = self.formatViewCount(article.viewCount)
            return article
          })

          self.setData({
            articles: articles,
            hasMore: data.hasMore || false,
            loading: false
          })
        } else {
          self.setData({ loading: false, articles: [] })
        }
      },
      fail: function(err) {
        console.error('加载知识库失败:', err)
        self.setData({ loading: false, articles: [] })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },

  // 切换分类
  onCategoryTap: function(e) {
    let category = e.currentTarget.dataset.category
    if (category === this.data.activeCategory) return

    this.setData({
      activeCategory: category,
      page: 1,
      articles: [],
      loading: true
    })

    this.loadArticles()
  },

  // 点击文章卡片
  onArticleTap: function(e) {
    let articleId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/knowledge/detail?id=' + articleId
    })
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.setData({
      page: 1,
      articles: [],
      loading: true
    })

    let self = this
    self.loadArticles()
    wx.stopPullDownRefresh()
  },

  // 触底加载更多
  onReachBottom: function() {
    if (!this.data.hasMore || this.data.loading) return

    let self = this
    let nextPage = self.data.page + 1

    self.setData({ loading: true })

    let category = CATEGORY_MAP[self.data.activeCategory] || ''

    wx.cloud.callFunction({
      name: 'getKnowledgeList',
      data: {
        category: category,
        page: nextPage,
        pageSize: self.data.pageSize
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let data = res.result.data
          let newArticles = data.articles || []

          newArticles = newArticles.map(function(article) {
            article.petTypeText = self.getPetTypeText(article.petType)
            article.summaryText = (article.summary || '').substring(0, 60)
            article.viewText = self.formatViewCount(article.viewCount)
            return article
          })

          self.setData({
            articles: self.data.articles.concat(newArticles),
            hasMore: data.hasMore || false,
            page: nextPage,
            loading: false
          })
        } else {
          self.setData({ loading: false })
        }
      },
      fail: function(err) {
        console.error('加载更多失败:', err)
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },

  // 宠物类型文字
  getPetTypeText: function(petType) {
    let map = { cat: '🐱猫咪', dog: '🐶狗狗', all: '🐱🐶全部' }
    return map[petType] || '🐱🐶全部'
  },

  // 格式化浏览量
  formatViewCount: function(count) {
    if (!count) return '0'
    if (count >= UNIT_CONVERSION.COUNT_TO_WAN) {
      return (count / UNIT_CONVERSION.COUNT_TO_WAN).toFixed(1) + 'w'
    }
    return String(count)
  }
})
