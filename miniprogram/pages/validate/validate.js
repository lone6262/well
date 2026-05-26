// pages/validate/validate.js
Page({
  data: {
    envId: '',
    validating: false,
    validationResult: null,
    logs: []
  },

  onLoad: function () {
    var app = getApp()
    this.setData({
      envId: '云开发已禁用'
    })
    this.addLog('🔍 验证页面加载完成')
    this.addLog('📋 云开发功能已禁用')
  },

  // 开始验证
  startValidation: function () {
    this.setData({
      validating: true,
      validationResult: null,
      logs: []
    })

    this.addLog('🚀 云开发已禁用，无需验证')
    this.showResult(false, '云开发功能已禁用')
  },

  // 显示结果
  showResult: function (success, message, suggestion = '') {
    this.setData({
      validationResult: {
        success: success,
        message: message,
        suggestion: suggestion
      }
    })
  },

  // 添加日志
  addLog: function (message) {
    var timestamp = new Date().toLocaleTimeString()
    this.data.logs.push('[' + timestamp + '] ' + message)
    this.setData({
      logs: this.data.logs
    })
  },

  // 清空日志
  clearLogs: function () {
    this.setData({
      logs: [],
      validationResult: null
    })
  }
})