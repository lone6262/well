// 自查记录/健康报告列表页面
let app = getApp()

Page({
  data: {
    type: 'checkRecords',
    records: [],
    loading: true,
    page: 1,
    hasMore: false,
    pageTitle: '自查记录'
  },

  onLoad: function(options) {
    let type = options.type || 'checkRecords'
    let showReport = options.showReport === 'true'
    let pageTitle = type === 'reports' ? '健康报告' : '自查记录'

    this.setData({
      type: type,
      showReport: showReport,
      pageTitle: pageTitle
    })

    // 动态设置导航栏标题
    wx.setNavigationBarTitle({
      title: pageTitle
    })

    this.loadRecords()
  },

  // 加载记录列表
  loadRecords: function() {
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
        records: []
      })
      return
    }

    wx.cloud.callFunction({
      name: 'getRecordList',
      data: {
        token: getApp().globalData.token,
        page: 1,
        pageSize: 20
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let data = res.result.data
          let records = data.records || []

          // 格式化记录数据
          records = records.map(function(record) {
            record.riskText = self.getRiskText(record.riskLevel)
            record.riskColor = self.getRiskColor(record.riskLevel)
            record.dateText = self.formatDate(record.createdAt)
            record.symptomsText = (record.symptoms || []).join('、')
            return record
          })

          self.setData({
            records: records,
            hasMore: data.hasMore || false,
            page: 1,
            loading: false
          })
        } else {
          self.setData({ loading: false, records: [] })
        }
      },
      fail: function(err) {
        console.error('加载记录失败:', err)
        self.setData({ loading: false, records: [] })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },

  // 查看记录详情
  viewDetail: function(e) {
    let record = e.currentTarget.dataset.record

    // 健康报告模式：直接跳转AI报告页
    if (this.data.showReport) {
      wx.navigateTo({
        url: '/pages/ai-report/index?recordId=' + record._id
      })
    } else {
      // 自查记录模式：跳转评估结果页
      wx.navigateTo({
        url: '/pages/risk/result?assessmentId=' + record._id + '&riskLevel=' + record.riskLevel
      })
    }
  },

  // 加载更多
  loadMore: function() {
    let self = this
    let openid = app.getOpenid()
    let nextPage = self.data.page + 1

    wx.cloud.callFunction({
      name: 'getRecordList',
      data: {
        token: getApp().globalData.token,
        page: nextPage,
        pageSize: 20
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          let data = res.result.data
          let newRecords = data.records || []

          newRecords = newRecords.map(function(record) {
            record.riskText = self.getRiskText(record.riskLevel)
            record.riskColor = self.getRiskColor(record.riskLevel)
            record.dateText = self.formatDate(record.createdAt)
            record.symptomsText = (record.symptoms || []).join('、')
            return record
          })

          self.setData({
            records: self.data.records.concat(newRecords),
            hasMore: data.hasMore || false,
            page: nextPage
          })
        }
      }
    })
  },

  // 风险等级文字
  getRiskText: function(level) {
    let map = { low: '低风险', mid: '中风险', high: '高风险' }
    return map[level] || '未知'
  },

  // 风险等级颜色
  getRiskColor: function(level) {
    let map = { low: '#52c41a', mid: '#faad14', high: '#f5222d' }
    return map[level] || '#999999'
  },

  // 格式化日期
  formatDate: function(dateStr) {
    if (!dateStr) return '未知时间'
    let date = new Date(dateStr)
    let month = date.getMonth() + 1
    let day = date.getDate()
    let hour = date.getHours()
    let minute = date.getMinutes()
    return month + '月' + day + '日 ' + (hour < 10 ? '0' : '') + hour + ':' + (minute < 10 ? '0' : '') + minute
  },

  // 删除记录
  deleteRecord: function(e) {
    let self = this;
    let recordId = e.currentTarget.dataset.id;
    if (!recordId) return;
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条记录吗？',
      success: function(res) {
        if (res.confirm) {
          if (!app.globalData.cloudDevelopmentAvailable) {
            // 本地存储模式
            let records = self.data.records.filter(function(r) { return r._id !== recordId; });
            self.setData({ records: records });
            wx.showToast({ title: '已删除', icon: 'success' });
            return;
          }
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'deleteRecord',
            data: { recordId: recordId, token: app.globalData.token },
            success: function(res) {
              wx.hideLoading();
              if (res.result && res.result.code === 0) {
                let records = self.data.records.filter(function(r) { return r._id !== recordId; });
                self.setData({ records: records });
                wx.showToast({ title: '已删除', icon: 'success' });
              } else {
                wx.showToast({ title: res.result.msg || '删除失败', icon: 'none' });
              }
            },
            fail: function(err) {
              wx.hideLoading();
              console.error('删除云函数调用失败:', err);
              wx.showToast({ title: '删除失败，请确认云函数已部署', icon: 'none', duration: 2000 });
            }
          });
        }
      }
    });
  },

  // 返回
  goBack: function() {
    wx.navigateBack({
      fail: function() {
        wx.switchTab({ url: '/pages/user/index' })
      }
    })
  }
})
