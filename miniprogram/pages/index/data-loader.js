// 数据加载模块 - 从云数据库加载首页数据
const app = getApp()
const petMapper = require('../../utils/pet-mapper.js')
const logger = require('../../utils/logger.js')
const log = logger.child('IndexDataLoader')

function loadUserInfo(pageCtx) {
  let openid = app.getOpenid()

  // 先用本地缓存显示
  if (app.globalData.userInfo) {
    pageCtx.setData({
      userInfo: app.globalData.userInfo
    })
  }

  // 从云端同步最新用户信息
  if (openid && app.globalData.cloudDevelopmentAvailable) {
    wx.cloud.callFunction({
      name: 'saveUserProfile',
      data: {
        action: 'get'
      },
      success: function(res) {
        if (res.result && res.result.code === 0 && res.result.data) {
          let cloudUserInfo = res.result.data
          let userInfo = {
            avatarUrl: cloudUserInfo.avatarUrl || app.globalData.userInfo.avatarUrl || '/images/avatar.png',
            nickName: cloudUserInfo.nickName || app.globalData.userInfo.nickName || '宠物爱好者'
          }
          pageCtx.setData({ userInfo: userInfo })
          app.globalData.userInfo = userInfo
          wx.setStorageSync('userInfo', userInfo)
        }
      },
      fail: function(err) {
        log.info('云端用户信息同步失败，使用本地数据', err)
      }
    })
  }
}

function loadPetList(pageCtx) {
  const openid = app.getOpenid()

  if (!openid || (typeof openid === 'string' && openid.indexOf('mock_') === 0)) {
    log.info('用户未登录，引导登录')
    pageCtx.setData({
      petsList: [],
      loadingPets: false
    })
    return
  }

  log.info('从数据库加载宠物列表...')
  pageCtx.setData({ loadingPets: true })

  wx.cloud.callFunction({
    name: 'getPetList',
    data: { token: app.globalData.token },
    success: function(res) {
      log.info('宠物列表云函数调用成功')

      if (res.result.code === 0) {
        const petList = res.result.data.petList || []

        if (petList.length === 0) {
          log.info('宠物列表为空')
          pageCtx.setData({
            petsList: [],
            loadingPets: false
          })
          return
        }

        log.info('云端返回宠物数据:', petList.length + '只')

        // 使用统一的映射工具处理数据，确保与档案页面数据结构一致
        const mappedPets = petMapper.mapPetListFromCloud(petList)

        const pets = mappedPets.map(function(pet) {
          let healthStatus, healthStatusText

          if (pet.healthStatus && pet.healthStatusText) {
            healthStatus = pet.healthStatus
            healthStatusText = pet.healthStatusText
          } else {
            healthStatus = pageCtx.calculateHealthStatus(pet)
            healthStatusText = pageCtx.getHealthStatusText(healthStatus)
          }

          return {
            id: pet.petId,  // 使用 petId 作为 id，用于跳转
            _id: pet._id,   // 保留 _id 用于匹配
            petId: pet.petId,  // 保留 petId 用于匹配
            name: pet.name,
            avatar: pet.avatar || (pet.type === 'cat' ? '猫咪' : '狗狗'),
            type: pet.type,
            age: pet.age,
            healthStatus: healthStatus,
            healthStatusText: healthStatusText,
            hasAvatar: !!pet.avatar,
            isRealAvatar: !!pet.avatar
          }
        })

        pageCtx.setData({
          petsList: pets,
          loadingPets: false
        })

        log.info('首页宠物数据更新完成:', pets.length + '只')
      } else {
        log.error('宠物列表返回错误:', res.result.msg)
        pageCtx.setData({
          petsList: [],
          loadingPets: false
        })
        wx.showToast({
          title: res.result.msg || '数据加载失败',
          icon: 'none',
          duration: 2000
        })
      }
    },
    fail: function(err) {
      log.error('宠物列表云函数调用失败:', err)
      pageCtx.setData({
        petsList: [],
        loadingPets: false
      })
      wx.showToast({
        title: '网络连接失败',
        icon: 'none',
        duration: 2000
      })
    }
  })
}

/**
 * 格式化医院数据为前端展示格式
 */
function formatHospitals(hospitals) {
  return hospitals.slice(0, 3).map(function(hospital) {
    let distanceStr = '1km'
    if (typeof hospital.distance === 'number' && hospital.distance >= 0) {
      if (hospital.distance >= 1000) {
        distanceStr = Math.round(hospital.distance / 1000) + 'km'
      } else {
        distanceStr = Math.round(hospital.distance) + 'm'
      }
    }

    return {
      id: hospital.hospitalId || hospital.id || Date.now() + Math.random(),
      name: hospital.name || '宠物医院',
      distance: distanceStr,
      address: hospital.address || '地址信息更新中',
      is24h: hospital.is24h !== false,
      phone: hospital.phone || '电话咨询',
      latitude: hospital.latitude || 0,
      longitude: hospital.longitude || 0
    }
  })
}

/**
 * 获取 fallback 医院数据
 */
function getFallbackHospitals() {
  return [
    { id: 'f1', name: '爱心宠物医院', distance: '500m', address: '提供24小时急诊服务', is24h: true, phone: '请电话确认', latitude: 0, longitude: 0 },
    { id: 'f2', name: '宠物中心医院', distance: '1km', address: '全天候医疗服务', is24h: true, phone: '请电话确认', latitude: 0, longitude: 0 },
    { id: 'f3', name: '萌宠宠物诊所', distance: '800m', address: '常规门诊服务', is24h: false, phone: '请电话确认', latitude: 0, longitude: 0 }
  ]
}

function loadNearbyHospitals(pageCtx) {
  if (pageCtx.data.isLoadingLocation) {
    log.info('位置请求正在进行中，跳过重复请求')
    return
  }

  log.info('开始加载实时附近医院数据...')

  pageCtx.setData({
    isLoadingLocation: true,
    isLoadingHospitals: true,
    lastUpdateTime: '正在定位...'
  })

  // 全局超时保护：10 秒内必须出结果（含授权弹窗等待），否则展示 fallback
  var loaded = false
  var globalTimeout = setTimeout(function() {
    if (loaded) return
    loaded = true
    log.info('医院加载全局超时，展示 fallback 数据')
    pageCtx.setData({
      isLoadingLocation: false,
      isLoadingHospitals: false,
      nearbyHospitals: getFallbackHospitals(),
      lastUpdateTime: pageCtx.formatUpdateTime(new Date()) + ' (默认)'
    })
    wx.showToast({ title: '定位超时，使用推荐数据', icon: 'none', duration: 2000 })
  }, 10000)

  app.getUserLocation().then(function(location) {
    log.info('用户位置获取成功:', location)

    if (app.globalData.cloudDevelopmentAvailable) {
      return new Promise(function(resolve, reject) {
        wx.cloud.callFunction({
          name: 'searchHospitals',
          data: {
            latitude: location.latitude,
            longitude: location.longitude,
            radius: 5000
          },
          success: function(res) {
            if (res.result && res.result.code === 0 && res.result.data && res.result.data.hospitals && res.result.data.hospitals.length > 0) {
              log.info('云函数返回真实医院数据:', res.result.data.hospitals.length)
              resolve(res.result.data.hospitals)
            } else {
              log.info('云函数无数据，使用 fallback')
              reject('no_data')
            }
          },
          fail: function(err) {
            log.info('云函数调用失败:', err)
            reject(err)
          }
        })
      })
    } else {
      var mapService = require('../../utils/mapService.js')
      return mapService.searchNearbyHospitals(
        location.latitude,
        location.longitude,
        3000
      )
    }
  }).then(function(hospitals) {
    if (loaded) return
    loaded = true
    clearTimeout(globalTimeout)

    var nearbyHospitals = formatHospitals(hospitals)
    var currentTime = new Date()
    var timeString = pageCtx.formatUpdateTime(currentTime)

    pageCtx.setData({
      nearbyHospitals: nearbyHospitals,
      lastUpdateTime: timeString,
      isLoadingHospitals: false,
      isLoadingLocation: false,
      lastUpdateTimeTimestamp: Date.now()
    })

    log.info('附近医院数据加载完成:', nearbyHospitals.length, '家')
    wx.showToast({ title: '医院数据已更新', icon: 'success', duration: 1500 })
  }).catch(function(error) {
    if (loaded) return
    loaded = true
    clearTimeout(globalTimeout)

    log.info('附近医院数据加载失败:', error)
    pageCtx.setData({
      isLoadingLocation: false,
      isLoadingHospitals: false,
      nearbyHospitals: getFallbackHospitals(),
      lastUpdateTime: pageCtx.formatUpdateTime(new Date()) + ' (默认)'
    })
    wx.showToast({ title: '使用推荐医院数据', icon: 'none', duration: 2000 })
  })
}

function loadDailyKnowledge(pageCtx) {
  if (!app.globalData.cloudDevelopmentAvailable) return

  wx.cloud.callFunction({
    name: 'getKnowledgeList',
    data: { featured: true, page: 1, pageSize: 1 },
    success: function(res) {
      if (res.result && res.result.code === 0) {
        let articles = res.result.data.articles || res.result.data.list || []
        if (articles.length > 0) {
          pageCtx.setData({ dailyKnowledge: articles[0] })
        }
      }
    },
    fail: function() {
      // 静默失败，使用健康提示兜底
    }
  })
}

function loadMemberStatus(pageCtx) {
  if (!app.globalData.cloudDevelopmentAvailable) return

  wx.cloud.callFunction({
    name: 'getMemberStatus',
    data: {},
    success: function(res) {
      if (res.result && res.result.code === 0 && res.result.data) {
        let memberData = res.result.data
        let isActive = memberData.status === 'active'
        let remaining = 0
        if (isActive && memberData.expireDate) {
          let diff = new Date(memberData.expireDate) - new Date()
          remaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
        }
        pageCtx.setData({
          isMember: isActive,
          memberDaysRemaining: remaining
        })
      }
    },
    fail: function() {
      // 静默失败，不影响首页
    }
  })
}

function checkPendingFollowups(pageCtx) {
  let openid = app.getOpenid()

  if (!openid || !app.globalData.cloudDevelopmentAvailable) return

  // 每次打开首页只弹一次，避免重复
  if (pageCtx._followupChecked) return
  pageCtx._followupChecked = true

  wx.cloud.callFunction({
    name: 'getFollowupList',
    data: { status: 'pending', page: 1, pageSize: 3 },
    success: function(res) {
      if (res.result && res.result.code === 0) {
        let list = res.result.data.list || []
        let now = new Date()

        let overdue = list.filter(function(item) {
          return item.followup_at && new Date(item.followup_at) <= now
        })

        if (overdue.length > 0) {
          pageCtx.setData({
            showFollowupPopup: true,
            pendingFollowup: overdue[0]
          })
        }
      }
    },
    fail: function() {
      // 静默失败，不影响首页体验
    }
  })
}

function loadPetDiary(pageCtx) {
  if (!app.globalData.cloudDevelopmentAvailable) return

  wx.cloud.callFunction({
    name: 'getPetDiary',
    data: { page: 1, pageSize: 1, onlyToday: true },
    success: function(res) {
      if (res.result && res.result.code === 0) {
        var diaries = (res.result.data && res.result.data.diaries) || []
        if (diaries.length > 0) {
          var d = diaries[0]
          pageCtx.setData({
            todayDiary: {
              _id: d._id,
              content: d.content,
              petName: d.pet_name || '毛孩子'
            }
          })
        } else {
          pageCtx.setData({ todayDiary: null })
        }
      }
    },
    fail: function() {
      // 接口异常隐藏日记卡，不阻塞首页
      pageCtx.setData({ todayDiary: null })
    }
  })
}

module.exports = {
  loadUserInfo: loadUserInfo,
  loadPetList: loadPetList,
  loadNearbyHospitals: loadNearbyHospitals,
  loadDailyKnowledge: loadDailyKnowledge,
  loadMemberStatus: loadMemberStatus,
  checkPendingFollowups: checkPendingFollowups,
  loadPetDiary: loadPetDiary
}
