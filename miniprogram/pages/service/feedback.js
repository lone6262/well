// 意见反馈页面
const logger = require('../../utils/logger.js')
const log = logger.child('Feedback')
let app = getApp()

Page({
  data: {
    // 反馈类型
    feedbackTypes: [
      { value: 'bug', label: 'Bug反馈' },
      { value: 'suggestion', label: '功能建议' },
      { value: 'report', label: 'AI报告问题' },
      { value: 'member', label: '会员问题' },
      { value: 'other', label: '其它' }
    ],
    selectedType: '',
    // 表单内容
    feedbackContent: '',
    // 上传的图片
    uploadedImages: [],
    // 联系方式
    contactWechat: '',
    contactPhone: '',
    contactEmail: '',
    // 提交中状态
    isSubmitting: false,
    // 最大图片数量
    maxImages: 9
  },

  onLoad: function() {
    log.info('意见反馈页面加载')
  },

  // 选择反馈类型
  selectType: function(e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      selectedType: type
    })
    log.info('选择反馈类型:', type)
  },

  // 输入问题描述
  onContentInput: function(e) {
    this.setData({
      feedbackContent: e.detail.value
    })
  },

  // 选择图片
  chooseImage: function() {
    const self = this
    const remainCount = this.data.maxImages - this.data.uploadedImages.length

    if (remainCount <= 0) {
      wx.showToast({
        title: '最多上传9张图片',
        icon: 'none'
      })
      return
    }

    wx.chooseImage({
      count: remainCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        self.uploadImages(res.tempFilePaths)
      }
    })
  },

  // 上传图片到云存储
  uploadImages: function(tempFilePaths) {
    const self = this
    const cloudPath = 'feedback/' + app.getOpenid() + '_' + Date.now()

    wx.showLoading({
      title: '上传中...',
      mask: true
    })

    // 逐个上传图片
    const uploadPromises = tempFilePaths.map((filePath, index) => {
      return new Promise((resolve, reject) => {
        const fileName = cloudPath + '_' + index + '.jpg'
        wx.cloud.uploadFile({
          cloudPath: fileName,
          filePath: filePath,
          success: function(res) {
            log.info('图片上传成功:', res.fileID)
            resolve(res.fileID)
          },
          fail: function(err) {
            log.error('图片上传失败:', err)
            reject(err)
          }
        })
      })
    })

    Promise.all(uploadPromises).then(fileIds => {
      wx.hideLoading()
      self.setData({
        uploadedImages: self.data.uploadedImages.concat(fileIds)
      })
      wx.showToast({
        title: '上传成功',
        icon: 'success'
      })
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({
        title: '上传失败，请重试',
        icon: 'none'
      })
    })
  },

  // 预览图片
  previewImage: function(e) {
    const index = e.currentTarget.dataset.index
    wx.previewImage({
      current: this.data.uploadedImages[index],
      urls: this.data.uploadedImages
    })
  },

  // 删除图片
  deleteImage: function(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.uploadedImages
    images.splice(index, 1)

    this.setData({
      uploadedImages: images
    })

    log.info('删除图片:', index)
  },

  // 输入微信号
  onWechatInput: function(e) {
    this.setData({
      contactWechat: e.detail.value
    })
  },

  // 输入手机号
  onPhoneInput: function(e) {
    this.setData({
      contactPhone: e.detail.value
    })
  },

  // 输入邮箱
  onEmailInput: function(e) {
    this.setData({
      contactEmail: e.detail.value
    })
  },

  // 提交反馈
  submitFeedback: function() {
    const self = this

    // 表单验证
    if (!this.data.selectedType) {
      wx.showToast({
        title: '请选择反馈类型',
        icon: 'none'
      })
      return
    }

    if (!this.data.feedbackContent || this.data.feedbackContent.trim() === '') {
      wx.showToast({
        title: '请填写问题描述',
        icon: 'none'
      })
      return
    }

    // 开始提交
    this.setData({
      isSubmitting: true
    })

    wx.showLoading({
      title: '提交中...',
      mask: true
    })

    const feedbackData = {
      type: this.data.selectedType,
      content: this.data.feedbackContent,
      images: this.data.uploadedImages,
      contact: {
        wechat: this.data.contactWechat,
        phone: this.data.contactPhone,
        email: this.data.contactEmail
      },
      openid: app.getOpenid(),
      createTime: new Date(),
      status: 'pending'
    }

    // 调用云函数保存反馈
    wx.cloud.callFunction({
      name: 'saveFeedback',
      data: feedbackData,
      success: function(res) {
        wx.hideLoading()
        self.setData({
          isSubmitting: false
        })

        if (res.result && res.result.code === 0) {
          wx.showToast({
            title: '提交成功，感谢反馈！',
            icon: 'success',
            duration: 2000
          })

          // 延迟返回
          setTimeout(function() {
            wx.navigateBack()
          }, 2000)
        } else {
          wx.showToast({
            title: '提交失败，请重试',
            icon: 'none'
          })
        }

        log.info('反馈提交成功')
      },
      fail: function(err) {
        wx.hideLoading()
        self.setData({
          isSubmitting: false
        })

        // 云函数调用失败，降级处理
        log.warn('云函数调用失败，尝试本地保存:', err)

        // 保存到本地存储
        try {
          const localFeedbacks = wx.getStorageSync('localFeedbacks') || []
          localFeedbacks.push(feedbackData)
          wx.setStorageSync('localFeedbacks', localFeedbacks)

          wx.showToast({
            title: '已保存到本地，网络恢复后将自动上传',
            icon: 'none',
            duration: 3000
          })

          setTimeout(function() {
            wx.navigateBack()
          }, 3000)
        } catch (e) {
          wx.showToast({
            title: '保存失败，请重试',
            icon: 'none'
          })
        }
      }
    })
  }
})
