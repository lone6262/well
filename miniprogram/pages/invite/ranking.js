// 邀请排行榜页面 - 重设计版本
var app = getApp()

Page({
  data: {
    loading: true,
    rankList: [],
    myRank: 0,
    myCount: 0,
    top3: [],
    restList: []
  },

  onLoad: function () {
    this.loadRanking()
  },

  loadRanking: function () {
    var self = this
    self.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'getInviteRanking',
      data: {},
      success: function (res) {
        if (res.result && res.result.code === 0) {
          var data = res.result.data
          var list = data.list || []

          self.setData({
            rankList: list,
            myRank: data.myRank,
            myCount: data.myCount,
            top3: list.slice(0, 3),
            restList: list.slice(3),
            loading: false
          })
        } else {
          self.setData({ loading: false })
        }
      },
      fail: function () {
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  }
})
