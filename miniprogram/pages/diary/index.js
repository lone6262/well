// 宠物日记时间轴页
const logger = require('../../utils/logger.js')
const log = logger.child('DiaryPage')
let app = getApp()

Page({
  data: {
    diaries: [],
    loading: true,
    page: 1,
    hasMore: false,
    showShareImage: false,
    shareImageBase64: ''
  },

  onLoad: function() {
    wx.setNavigationBarTitle({ title: '宠物日记' })
    this.loadDiaries()
  },

  loadDiaries: function() {
    const self = this
    if (!app.globalData.cloudDevelopmentAvailable) {
      self.setData({ loading: false, diaries: [] })
      return
    }
    wx.cloud.callFunction({
      name: 'getPetDiary',
      data: { token: app.globalData.token, page: 1, pageSize: 20 },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          const diaries = (res.result.data.diaries || []).map(function(d) {
            d.dateText = self.formatDate(d.date)
            return d
          })
          self.setData({
            diaries: diaries,
            hasMore: res.result.data.hasMore || false,
            page: 1,
            loading: false
          })
        } else {
          self.setData({ loading: false, diaries: [] })
        }
      },
      fail: function(err) {
        log.error('加载日记失败:', err)
        self.setData({ loading: false, diaries: [] })
      }
    })
  },

  loadMore: function() {
    const self = this
    const nextPage = self.data.page + 1
    wx.cloud.callFunction({
      name: 'getPetDiary',
      data: { token: app.globalData.token, page: nextPage, pageSize: 20 },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          const newDiaries = (res.result.data.diaries || []).map(function(d) {
            d.dateText = self.formatDate(d.date)
            return d
          })
          self.setData({
            diaries: self.data.diaries.concat(newDiaries),
            hasMore: res.result.data.hasMore || false,
            page: nextPage
          })
        }
      }
    })
  },

  onReachBottom: function() {
    if (this.data.hasMore) this.loadMore()
  },

  // date 是 "YYYY-MM-DD" 北京日期字符串
  formatDate: function(dateStr) {
    if (!dateStr) return '未知日期'
    const parts = String(dateStr).split('-')
    if (parts.length === 3) {
      return parseInt(parts[1], 10) + '月' + parseInt(parts[2], 10) + '日'
    }
    return dateStr
  },

  // 转发（button open-type="share" 触发）
  onShareAppMessage: function(e) {
    const id = (e && e.target && e.target.dataset && e.target.dataset.id) || ''
    let d = this.data.diaries.find(function(x) { return x._id === id })
    if (!d) d = this.data.diaries[0] || {}
    return {
      title: (d.pet_name || '毛孩子') + '的小秘密：' + (d.content || '').substring(0, 20) + '...',
      path: '/pages/index/index?from=diary_share'
    }
  },

  // 生成海报图片
  shareDiaryImage: function(e) {
    const diaryId = e.currentTarget.dataset.id
    const self = this
    wx.showLoading({ title: '生成图片...' })
    wx.cloud.callFunction({
      name: 'generateDiaryShare',
      data: { token: app.globalData.token, diary_id: diaryId },
      success: function(res) {
        wx.hideLoading()
        if (res.result && res.result.code === 0 && res.result.data.posterBase64) {
          self.setData({ shareImageBase64: res.result.data.posterBase64, showShareImage: true })
        } else {
          wx.showToast({ title: '生成失败', icon: 'none' })
        }
      },
      fail: function() {
        wx.hideLoading()
        wx.showToast({ title: '生成失败', icon: 'none' })
      }
    })
  },

  closeShareImage: function() {
    this.setData({ showShareImage: false })
  },

  goBack: function() {
    wx.navigateBack({
      fail: function() {
        wx.switchTab({ url: '/pages/index/index' })
      }
    })
  }
})
