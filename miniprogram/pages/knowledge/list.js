// 宠物知识库列表页面
const logger = require('../../utils/logger.js')
const log = logger.child('KnowledgeList')
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
    isMember: false,
    page: 1,
    hasMore: false,
    pageSize: 10,
    searchKeyword: '',
    showSearchResult: false,
    totalResults: 0,
    isSearching: false
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

          // 检查会员状态
          var isMember = app.globalData.userInfo && app.globalData.userInfo.isMember
          self.setData({ isMember: isMember })

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
        log.error('加载知识库失败:', err)
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
    let article = this.data.articles.find(function(a) { return a._id === articleId })

    // 会员专享文章：非会员引导开通
    if (article && article.member_only && !this.data.isMember) {
      wx.showModal({
        title: '会员专享内容',
        content: '该文章为会员专享，开通会员即可阅读全部内容',
        confirmText: '开通会员',
        confirmColor: '#B35D3A',
        success: function(res) {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/member/order' })
          }
        }
      })
      return
    }

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

    // 搜索模式：加载更多搜索结果
    if (this.data.isSearching) {
      self.loadMoreSearchResults()
      return
    }

    // 普通模式：加载更多分类文章
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
        log.error('加载更多失败:', err)
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },

  // 宠物类型文字
  getPetTypeText: function(petType) {
    let map = { cat: '猫咪', dog: '狗狗', all: '全部' }
    return map[petType] || '全部'
  },

  // 格式化浏览量
  formatViewCount: function(count) {
    if (!count) return '0'
    if (count >= UNIT_CONVERSION.COUNT_TO_WAN) {
      return (count / UNIT_CONVERSION.COUNT_TO_WAN).toFixed(1) + 'w'
    }
    return String(count)
  },

  // 搜索输入
  onSearchInput: function(e) {
    let keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
  },

  // 搜索确认
  onSearchConfirm: function() {
    let keyword = this.data.searchKeyword.trim()
    if (!keyword) {
      wx.showToast({ title: '请输入搜索关键词', icon: 'none' })
      return
    }
    this.performSearch(keyword)
  },

  // 清除搜索
  onClearSearch: function() {
    this.setData({
      searchKeyword: '',
      showSearchResult: false,
      isSearching: false
    })
    this.loadArticles()
  },

  // 执行搜索
  performSearch: function(keyword) {
    let self = this
    let openid = app.getOpenid()

    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    if (!app.globalData.cloudDevelopmentAvailable) {
      wx.showToast({ title: '网络异常', icon: 'none' })
      return
    }

    self.setData({
      loading: true,
      isSearching: true,
      page: 1,
      articles: []
    })

    wx.cloud.callFunction({
      name: 'searchKnowledge',
      data: {
        keyword: keyword,
        page: 1,
        pageSize: self.data.pageSize
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let data = res.result.data
          let articles = data.articles || []

          // 格式化文章数据
          articles = articles.map(function(article) {
            article.petTypeText = self.getPetTypeText(article.petType || article.target_pet)
            article.summaryText = (article.summary || '').substring(0, 60)
            article.viewText = self.formatViewCount(article.view_count || article.viewCount || 0)
            return article
          })

          self.setData({
            articles: articles,
            hasMore: data.hasMore || false,
            loading: false,
            showSearchResult: true,
            totalResults: data.total || 0
          })

          if (articles.length === 0) {
            wx.showToast({ title: '未找到相关文章', icon: 'none' })
          }
        } else {
          self.setData({ loading: false, articles: [] })
          wx.showToast({ title: res.result.msg || '搜索失败', icon: 'none' })
        }
      },
      fail: function(err) {
        log.error('搜索知识库失败:', err)
        self.setData({ loading: false, articles: [] })
        wx.showToast({ title: '搜索失败', icon: 'none' })
      }
    })
  },

  // 搜索状态下的加载更多
  loadMoreSearchResults: function() {
    let self = this
    let keyword = self.data.searchKeyword.trim()
    let nextPage = self.data.page + 1

    if (!keyword) return

    self.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'searchKnowledge',
      data: {
        keyword: keyword,
        page: nextPage,
        pageSize: self.data.pageSize
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let data = res.result.data
          let newArticles = data.articles || []

          newArticles = newArticles.map(function(article) {
            article.petTypeText = self.getPetTypeText(article.petType || article.target_pet)
            article.summaryText = (article.summary || '').substring(0, 60)
            article.viewText = self.formatViewCount(article.view_count || article.viewCount || 0)
            return article
          })

          self.setData({
            articles: self.data.articles.concat(newArticles),
            hasMore: data.hasMore || false,
            page: nextPage,
            loading: false,
            totalResults: data.total || self.data.totalResults
          })
        } else {
          self.setData({ loading: false })
        }
      },
      fail: function(err) {
        log.error('加载搜索结果失败:', err)
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  }
})
