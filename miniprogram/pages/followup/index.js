// 回访记录列表页面
let app = getApp()

let STATUS_TABS = [
  { key: 'all', text: '全部' },
  { key: 'pending', text: '待回访' },
  { key: 'improved', text: '已好转' },
  { key: 'no_change', text: '无变化' },
  { key: 'worsened', text: '恶化' }
]

let STATUS_MAP = {
  pending: { text: '待回访', color: '#faad14' },
  improved: { text: '已好转', color: '#52c41a' },
  no_change: { text: '无变化', color: '#1890ff' },
  worsened: { text: '恶化', color: '#f5222d' }
}

Page({
  data: {
    tabs: STATUS_TABS,
    currentTab: 'all',
    list: [],
    loading: true,
    loadingMore: false,
    page: 1,
    hasMore: true,
    empty: false
  },

  onLoad: function() {
    this.loadList()
  },

  onPullDownRefresh: function() {
    this.setData({ page: 1, list: [], hasMore: true })
    this.loadList(function() {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom: function() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore()
    }
  },

  switchTab: function(e) {
    let key = e.currentTarget.dataset.key
    if (key === this.data.currentTab) return
    this.setData({
      currentTab: key,
      page: 1,
      list: [],
      hasMore: true,
      loading: true
    })
    this.loadList()
  },

  loadList: function(callback) {
    let self = this
    self.setData({ loading: true, empty: false })

    wx.cloud.callFunction({
      name: 'getFollowupList',
      data: {
        page: 1,
        pageSize: 10,
        status: self.data.currentTab === 'all' ? '' : self.data.currentTab
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let records = res.result.data.list || []
          records = self.formatRecords(records)
          self.setData({
            list: records,
            hasMore: res.result.data.hasMore || false,
            empty: records.length === 0,
            page: 1
          })
        }
      },
      fail: function() {
        wx.showToast({ title: '加载失败', icon: 'none' })
      },
      complete: function() {
        self.setData({ loading: false })
        if (callback) callback()
      }
    })
  },

  loadMore: function() {
    let self = this
    if (!self.data.hasMore) return

    let nextPage = self.data.page + 1
    self.setData({ loadingMore: true })

    wx.cloud.callFunction({
      name: 'getFollowupList',
      data: {
        page: nextPage,
        pageSize: 10,
        status: self.data.currentTab === 'all' ? '' : self.data.currentTab
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let newRecords = self.formatRecords(res.result.data.list || [])
          self.setData({
            list: self.data.list.concat(newRecords),
            hasMore: res.result.data.hasMore || false,
            page: nextPage
          })
        }
      },
      complete: function() {
        self.setData({ loadingMore: false })
      }
    })
  },

  formatRecords: function(records) {
    return records.map(function(r) {
      let statusInfo = STATUS_MAP[r.status] || { text: '未知', color: '#999' }
      let d = r.created_at ? new Date(r.created_at) : null
      let dateText = d
        ? (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))
        : ''
      return {
        _id: r._id,
        pet_name: r.pet_name || '未知宠物',
        symptom_list: r.symptom_list || '',
        status: r.status,
        statusText: statusInfo.text,
        statusColor: statusInfo.color,
        dateText: dateText,
        visited_vet: r.visited_vet || false
      }
    })
  },

  onItemClick: function(e) {
    let id = e.currentTarget.dataset.id
    let status = e.currentTarget.dataset.status
    if (status === 'pending') {
      wx.navigateTo({ url: '/pages/followup/submit?followupId=' + id })
    }
  },

  goBack: function() {
    wx.navigateBack()
  }
})
