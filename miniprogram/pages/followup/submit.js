// 回访提交页面
let app = getApp()

Page({
  data: {
    followupId: '',
    petName: '',
    symptoms: '',
    symptomList: [],
    selectedStatus: '',
    visitedVet: false,
    notes: '',
    submitting: false,
    submitted: false,
    // 状态选项
    statusOptions: [
      { key: 'improved', label: '好转', icon: '/images/icons/check.svg', color: '#52c41a' },
      { key: 'no_change', label: '无变化', icon: '/images/icons/warning.svg', color: '#faad14' },
      { key: 'worsened', label: '恶化', icon: '/images/icons/cross.svg', color: '#f5222d' }
    ]
  },

  // 安全解码 URL 参数：兼容已 encodeURIComponent 编码（来自首页弹窗）和未编码（来自列表页）两种入口
  decodeParam: function(value) {
    if (!value) return ''
    try {
      // 含 % 开头的转义序列才尝试解码，避免对普通文本误操作
      if (value.indexOf('%') === -1) return value
      return decodeURIComponent(value)
    } catch (e) {
      return value
    }
  },

  onLoad: function(options) {
    if (options.followupId) {
      let decodedSymptoms = this.decodeParam(options.symptoms)
      let symptomArr = decodedSymptoms ? decodedSymptoms.split('、') : []
      this.setData({
        followupId: options.followupId,
        petName: this.decodeParam(options.petName),
        symptoms: decodedSymptoms,
        symptomList: symptomArr
      })
    }
  },

  // 选择恢复状态
  selectStatus: function(e) {
    let status = e.currentTarget.dataset.status
    this.setData({ selectedStatus: status })
  },

  // 切换是否就医
  toggleVetVisit: function(e) {
    this.setData({ visitedVet: e.detail.value })
  },

  // 输入补充说明
  onNotesInput: function(e) {
    this.setData({ notes: e.detail.value })
  },

  // 提交回访
  submitFollowup: function() {
    let self = this

    if (self.data.submitting) return

    if (!self.data.selectedStatus) {
      wx.showToast({ title: '请选择恢复状态', icon: 'none' })
      return
    }

    self.setData({ submitting: true })

    wx.cloud.callFunction({
      name: 'followupSubmit',
      data: {
        followupId: self.data.followupId,
        status: self.data.selectedStatus,
        visitedVet: self.data.visitedVet,
        notes: self.data.notes
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          self.setData({ submitted: true })
          wx.showToast({ title: '提交成功', icon: 'success' })
        } else {
          wx.showToast({ title: res.result.msg || '提交失败', icon: 'none' })
        }
      },
      fail: function() {
        wx.showToast({ title: '网络错误', icon: 'none' })
      },
      complete: function() {
        self.setData({ submitting: false })
      }
    })
  },

  // 返回首页
  goHome: function() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 返回
  goBack: function() {
    wx.navigateBack()
  }
})
