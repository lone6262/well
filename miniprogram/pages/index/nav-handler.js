// 导航处理模块 - 处理页面跳转和用户交互
const logger = require('../../utils/logger.js')
const log = logger.child('IndexNavHandler')
const app = getApp()

module.exports = {
  toEmergency: function() {
    log.info('点击急救按钮')
    try {
      wx.switchTab({
        url: '/pages/emergency/index',
        success: function() {
          log.info('跳转急救页面成功')
        },
        fail: function(err) {
          log.error('跳转急救页面失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      log.error('急救按钮点击异常:', error)
    }
  },

  toSymptom: function() {
    log.info('点击症状自查按钮')
    try {
      wx.switchTab({
        url: '/pages/symptom/guide',
        success: function() {
          log.info('跳转症状自查成功')
        },
        fail: function(err) {
          log.error('跳转症状自查失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      log.error('症状自查按钮点击异常:', error)
    }
  },

  toHospital: function() {
    log.info('点击医院导航按钮')
    try {
      wx.switchTab({
        url: '/pages/hospital/list',
        success: function() {
          log.info('跳转医院导航成功')
        },
        fail: function(err) {
          log.error('跳转医院导航失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      log.error('医院导航按钮点击异常:', error)
    }
  },

  toKnowledge: function() {
    wx.navigateTo({
      url: '/pages/knowledge/list'
    })
  },

  toKnowledgeDetail: function(e) {
    let id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({
        url: '/pages/knowledge/detail?id=' + id
      })
    }
  },

  goToMember: function() {
    wx.navigateTo({
      url: '/pages/member/index'
    })
  },

  goToInvite: function() {
    wx.navigateTo({
      url: '/pages/invite/index'
    })
  },

  goToFollowupList: function() {
    wx.navigateTo({ url: '/pages/followup/index' })
  },

  closeFollowupPopup: function() {
    this.setData({ showFollowupPopup: false })
  },

  goToFollowup: function() {
    let f = this.data.pendingFollowup
    if (!f) return

    this.setData({ showFollowupPopup: false })

    let params = 'followupId=' + f._id +
      '&petName=' + encodeURIComponent(f.pet_name || '') +
      '&symptoms=' + encodeURIComponent(f.symptom_list || '')

    wx.navigateTo({
      url: '/pages/followup/submit?' + params
    })
  },

  toToolsHub: function() {
    // 功能开关防御：工具中心被关闭时不跳转
    const ff = app.globalData.featureFlags || {}
    if (ff.enable_tools === false) {
      log.warn('工具中心已被功能开关关闭')
      return
    }
    wx.navigateTo({
      url: '/pages/tools/index/index'
    })
  },

  toPetAge: function() {
    wx.navigateTo({
      url: '/pages/tools/pet-age/pet-age'
    })
  },

  toFoodSafety: function() {
    wx.navigateTo({
      url: '/pages/tools/food-safety/food-safety'
    })
  },

  toPoopScore: function() {
    wx.navigateTo({
      url: '/pages/tools/poop-score/poop-score'
    })
  },

  // Phase 1.5: 反馈入口
  toFeedback: function() {
    wx.navigateTo({
      url: '/pages/service/feedback'
    })
  },

  onShareAppMessage: function() {
    let inviteCode = app.globalData.currentInviteCode || ''
    return {
      title: '守护爱宠健康，从一次自查开始',
      path: '/pages/index/index' + (inviteCode ? '?invite_code=' + inviteCode : ''),
      imageUrl: '/images/share-cover.png'
    }
  }
}
