// 导航处理模块 - 处理页面跳转和用户交互
const app = getApp()

module.exports = {
  toEmergency: function() {
    console.log('点击急救按钮')
    try {
      wx.switchTab({
        url: '/pages/emergency/index',
        success: function() {
          console.log('跳转急救页面成功')
        },
        fail: function(err) {
          console.error('跳转急救页面失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      console.error('急救按钮点击异常:', error)
    }
  },

  toSymptom: function() {
    console.log('点击症状自查按钮')
    try {
      wx.switchTab({
        url: '/pages/symptom/guide',
        success: function() {
          console.log('跳转症状自查成功')
        },
        fail: function(err) {
          console.error('跳转症状自查失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      console.error('症状自查按钮点击异常:', error)
    }
  },

  toHospital: function() {
    console.log('点击医院导航按钮')
    try {
      wx.switchTab({
        url: '/pages/hospital/list',
        success: function() {
          console.log('跳转医院导航成功')
        },
        fail: function(err) {
          console.error('跳转医院导航失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      console.error('医院导航按钮点击异常:', error)
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

  onShareAppMessage: function() {
    let inviteCode = app.globalData.currentInviteCode || ''
    return {
      title: '守护爱宠健康，从一次自查开始',
      path: '/pages/index/index' + (inviteCode ? '?invite_code=' + inviteCode : ''),
      imageUrl: '/images/share-cover.png'
    }
  }
}
