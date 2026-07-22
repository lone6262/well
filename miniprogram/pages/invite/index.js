// 邀请好友页面 - 重设计版本
const logger = require('../../utils/logger.js')
const log = logger.child('InviteIndex')
var app = getApp()

Page({
  data: {
    loading: true,
    stats: {
      totalInvites: 0,
      pendingInvites: 0,
      rewardedInvites: 0,
      rewardCredits: 0,
      trialGranted: false,
      nextMilestone: 3,
      trialThreshold: 3
    },
    inviteCode: '',
    topRankers: [],
    posterGenerating: false,
    milestonePercent: 0
  },

  onLoad: function () {
    // 检查登录状态
    if (!this.checkLogin()) {
      return
    }
    this.initInvite()
  },

  onShow: function () {
    this.loadStats()
    this.loadTopRankers()
  },

  // 初始化邀请码
  initInvite: function () {
    var self = this

    // 优先使用全局缓存的邀请码
    if (app.globalData.currentInviteCode) {
      self.setData({ inviteCode: app.globalData.currentInviteCode, loading: false })
      // 统计与排行由 onShow 负责刷新，此处无需重复加载
      return
    }

    // 创建新邀请码
    wx.cloud.callFunction({
      name: 'createInvite',
      data: {},
      success: function (res) {
        if (res.result && res.result.code === 0) {
          var code = res.result.data.inviteCode
          self.setData({ inviteCode: code })
          app.globalData.currentInviteCode = code
        }
      },
      fail: function (err) {
        log.warn('createInvite failed:', err)
      },
      complete: function () {
        self.setData({ loading: false })
      }
    })
  },

  // 加载邀请统计
  loadStats: function () {
    var self = this

    wx.cloud.callFunction({
      name: 'getInviteStats',
      data: {},
      success: function (res) {
        if (res.result && res.result.code === 0 && res.result.data) {
          var s = res.result.data
          var rewarded = s.rewardedInvites || 0
          var threshold = s.trialThreshold || 3
          var percent = threshold > 0
            ? Math.min(100, Math.round((rewarded / threshold) * 100))
            : 0
          self.setData({
            stats: s,
            milestonePercent: percent
          })
        }
      },
      fail: function (err) {
        log.warn('getInviteStats failed:', err)
      }
    })
  },

  // 加载排行预览
  loadTopRankers: function () {
    var self = this

    wx.cloud.callFunction({
      name: 'getInviteRanking',
      data: {},
      success: function (res) {
        if (res.result && res.result.code === 0) {
          self.setData({
            topRankers: (res.result.data.list || []).slice(0, 3)
          })
        }
      },
      fail: function (err) {
        log.warn('getInviteRanking failed:', err)
      }
    })
  },

  // 分享给好友
  onShareAppMessage: function () {
    var inviteCode = this.data.inviteCode || ''
    return {
      title: '守护爱宠健康，从一次自查开始',
      path: '/pages/index/index?invite_code=' + inviteCode,
      imageUrl: '/images/share-cover.png'
    }
  },

  // 生成海报 - 取小程序码 + Canvas 绘制并导出 PNG（主路径）
  // 说明：原服务端 generateSharePoster 返回 SVG，真机相册/预览 API 不支持 SVG 导致空白，
  //       故统一走前端 Canvas 2d → canvasToTempFilePath 导出 PNG（真机可用）。
  //       小程序码由 getInviteQrcode 云函数生成（带邀请码 scene），canvas drawImage 绘制；
  //       码图获取失败则降级为纯文字海报。inviteCode/统计由 createInvite、getInviteStats 填充。
  generatePoster: function () {
    var self = this
    if (self.data.posterGenerating) return
    self.setData({ posterGenerating: true })
    // 先取小程序码 fileID（云函数生成并缓存），失败传 null 走文字降级
    wx.cloud.callFunction({
      name: 'getInviteQrcode',
      data: { inviteCode: self.data.inviteCode },
      success: function (res) {
        var fileId =
          res.result && res.result.code === 0 && res.result.data && res.result.data.fileId
            ? res.result.data.fileId
            : null
        self._generatePosterByCanvas(fileId)
      },
      fail: function () {
        self._generatePosterByCanvas(null)
      }
    })
  },

  // 保存或预览海报图片
  _saveOrPreviewPoster: function (filePath) {
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success: function () {
        wx.showToast({ title: '海报已保存到相册', icon: 'success' })
      },
      fail: function (err) {
        if (err.errMsg && err.errMsg.indexOf('auth deny') !== -1) {
          wx.showModal({
            title: '提示',
            content: '需要您授权保存图片到相册',
            showCancel: false
          })
        } else {
          // 保存失败，改为预览
          wx.previewImage({
            urls: [filePath],
            current: filePath
          })
        }
      }
    })
  },

  // Canvas 绘制海报（主路径）：canvas 2d → drawImage 画小程序码 → canvasToTempFilePath 导出 PNG
  // @param {string|null} qrFileId - 小程序码云文件 ID（getInviteQrcode 返回），null 则不画码（文字降级）
  _generatePosterByCanvas: function (qrFileId) {
    var self = this
    var userInfo = app.globalData.userInfo || {}
    var nickname = (userInfo.nickName || userInfo.nickname || '宠物爱好者').substring(0, 20)
    var stats = self.data.stats
    var trialThreshold = stats.trialThreshold || 3

    var query = wx.createSelectorQuery()
    query.select('#posterCanvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res[0] || !res[0].node) {
        self.setData({ posterGenerating: false })
        wx.showToast({ title: '海报生成失败', icon: 'none' })
        return
      }

      var canvas = res[0].node
      var ctx = canvas.getContext('2d')
      var dpr = wx.getSystemInfoSync().pixelRatio
      canvas.width = 600 * dpr
      canvas.height = 800 * dpr
      ctx.scale(dpr, dpr)

      // 背景渐变
      var gradient = ctx.createLinearGradient(0, 0, 0, 800)
      gradient.addColorStop(0, '#B35D3A')
      gradient.addColorStop(1, '#E8A87C')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 600, 800)

      // 装饰圆形
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.beginPath()
      ctx.arc(520, 80, 120, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(80, 650, 100, 0, Math.PI * 2)
      ctx.fill()

      // App 标题
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Mewora 宠物AI助手', 300, 80)

      // Slogan
      ctx.font = '28px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillText('守护爱宠健康，从一次自查开始', 300, 130)

      // 推荐人信息
      ctx.font = '24px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fillText('来自「' + nickname + '」的推荐', 300, 200)

      // 统计信息
      ctx.font = '20px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText('已成功邀请 ' + stats.rewardedInvites + ' 位好友', 300, 250)

      // 分割线
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(100, 290)
      ctx.lineTo(500, 290)
      ctx.stroke()

      // 功能亮点
      ctx.font = '22px sans-serif'
      ctx.fillStyle = '#ffd700'
      ctx.fillText('邀请好友，双方各得1次免费AI报告', 300, 340)
      ctx.fillText('邀请' + trialThreshold + '人，额外获得7天会员体验', 300, 380)

      // 邀请码（底部）
      ctx.font = '16px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fillText('邀请码: ' + (self.data.inviteCode || ''), 300, 720)

      // 统一导出入口：确保所有绘制（含异步码图）完成后再 canvasToTempFilePath
      var exportPoster = function () {
        setTimeout(function () {
          wx.canvasToTempFilePath({
            canvas: canvas,
            success: function (r) {
              self.setData({ posterGenerating: false })
              self._saveOrPreviewPoster(r.tempFilePath)
            },
            fail: function () {
              self.setData({ posterGenerating: false })
              wx.showToast({ title: '海报生成失败', icon: 'none' })
            }
          })
        }, 100)
      }

      // 绘制小程序码（canvas 2d 异步：getImageInfo 拿本地路径 → createImage → onload 后 drawImage）
      if (qrFileId) {
        wx.getImageInfo({
          src: qrFileId,
          success: function (imgInfo) {
            var qrImg = canvas.createImage()
            qrImg.onload = function () {
              // 码 160×160 居中（亮点 y380 下方、邀请码 y720 上方的留白区）
              ctx.drawImage(qrImg, 220, 420, 160, 160)
              // 码下方提示
              ctx.font = '18px sans-serif'
              ctx.fillStyle = 'rgba(255,255,255,0.6)'
              ctx.fillText('长按识别小程序码', 300, 610)
              exportPoster()
            }
            qrImg.onerror = function () {
              exportPoster()
            }
            qrImg.src = imgInfo.path
          },
          fail: function () {
            exportPoster()
          }
        })
      } else {
        // 无码降级：保留提示文案后导出
        ctx.font = '18px sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.fillText('长按识别小程序码', 300, 610)
        exportPoster()
      }
    })
  },

  // 检查登录状态
  checkLogin: function () {
    let openid = app.getOpenid()
    if (!openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/user/index'
        })
      }, 1500)
      return false
    }
    return true
  },

  // 查看完整排行
  toRanking: function () {
    wx.navigateTo({ url: '/pages/invite/ranking' })
  }
})
