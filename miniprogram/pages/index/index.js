// 首页逻辑 - 完整版本
const app = getApp()

Page({
  data: {
    nearbyHospitals: [
      { id: 1, name: '爱心宠物医院', distance: 0.5, address: '朝阳区望京街道', is24h: true },
      { id: 2, name: '宠物中心医院', distance: 1.2, address: '海淀区中关村大街', is24h: true },
      { id: 3, name: '萌宠宠物诊所', distance: 2.0, address: '丰台区方庄地区', is24h: false }
    ],
    petsList: [],
    dailyTip: '定期体检是预防疾病的关键，建议每年至少为宠物进行一次全面体检。',
    loadingPets: false,
    userInfo: {
      avatarUrl: ''
    },
    lastUpdateTime: '更新中...',
    isLoadingHospitals: false,
    hospitalLoadTimer: null
  },

  onLoad() {
    console.log('首页加载')
    this.loadUserInfo()
    this.loadDailyTip()

    // 使用登录回调机制，确保登录完成后再加载数据
    const self = this
    app.onLoginComplete((openid) => {
      console.log('登录回调触发，准备加载宠物数据')
      self.loadPetList()
      self.lastLoadedOpenid = openid
    })

    // 延迟加载附近医院，不阻塞首页显示
    setTimeout(() => {
      self.loadNearbyHospitals()
    }, 500)
  },

  onShow() {
    const self = this

    // 检查宠物数据更新标记
    if (app.globalData.petsUpdated) {
      self.loadPetList()
      app.globalData.petsUpdated = false
    }

    // 检查openid变化（重新登录）
    if (app.globalData.openid && app.globalData.openid !== self.lastLoadedOpenid) {
      console.log('检测到用户变化，重新加载宠物列表')
      self.loadPetList()
      self.lastLoadedOpenid = app.globalData.openid
    }

    // 防抖：避免频繁刷新附近医院数据
    if (self.data.hospitalLoadTimer) {
      clearTimeout(self.data.hospitalLoadTimer)
    }

    const timer = setTimeout(() => {
      self.loadNearbyHospitals()
    }, 2000) // 2秒防抖

    self.setData({
      hospitalLoadTimer: timer
    })
  },

  // 加载用户信息
  loadUserInfo() {
    const self = this
    if (app.globalData.userInfo) {
      self.setData({
        userInfo: app.globalData.userInfo
      })
    }
  },

  // 从云数据库加载宠物列表 - 增强版
  loadPetList() {
    const self = this

    // 使用统一的登录状态检查方法
    const openid = app.getOpenid()

    if (!openid) {
      console.log('⚠️ 用户未登录，显示引导界面')
      self.setData({
        petsList: [],
        loadingPets: false
      })

      // 显示添加宠物引导
      wx.showModal({
        title: '添加宠物',
        content: '还没有宠物档案，是否立即添加？',
        confirmText: '立即添加',
        cancelText: '稍后再说',
        success: function(res) {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/pet/profile'
            })
          }
        }
      })
      return
    }

    console.log('🔄 从数据库加载宠物列表...', openid)
    self.setData({ loadingPets: true })

    wx.cloud.callFunction({
      name: 'getPetList',
      data: {
        openid: openid
      },
      success: function(res) {
        console.log('✅ 宠物列表云函数调用成功:', res.result)

        if (res.result.code === 0) {
          const petList = res.result.data.petList || []

          if (petList.length === 0) {
            console.log('📭 宠物列表为空，显示添加引导')
            self.setData({
              petsList: [],
              loadingPets: false
            })

            // 显示添加宠物引导
            wx.showModal({
              title: '添加宠物',
              content: '还没有宠物档案，是否立即添加？',
              confirmText: '立即添加',
              cancelText: '稍后再说',
              success: function(modalRes) {
                if (modalRes.confirm) {
                  wx.navigateTo({
                    url: '/pages/pet/profile'
                  })
                }
              }
            })
            return
          }

          console.log('📋 云端返回宠物数据:', petList)

          const pets = petList.map(pet => {
            // 优先使用云函数返回的健康状态
            let healthStatus, healthStatusText

            if (pet.healthStatus && pet.healthStatusText) {
              healthStatus = pet.healthStatus
              healthStatusText = pet.healthStatusText
              console.log(`✅ 宠物${pet.name}使用云端健康状态: ${healthStatusText}`)
            } else {
              healthStatus = self.calculateHealthStatus(pet)
              healthStatusText = self.getHealthStatusText(healthStatus)
              console.log(`⚠️ 宠物${pet.name}前端计算健康状态: ${healthStatusText}`)
            }

            return {
              id: pet.petId,
              name: pet.name,
              avatar: pet.avatar || (pet.type === 'cat' ? '🐱' : '🐶'),
              type: pet.type,
              age: pet.age,
              healthStatus: healthStatus,
              healthStatusText: healthStatusText,
              hasAvatar: !!pet.avatar, // 是否有真实头像
              isRealAvatar: !!pet.avatar // 是否为真实头像（用于显示逻辑）
            }
          })

          self.setData({
            petsList: pets,
            loadingPets: false
          })

          console.log('✅ 首页宠物数据更新完成:', pets)

          // 同时加载附近医院数据
          self.loadNearbyHospitals()
        } else {
          console.error('❌ 宠物列表返回错误:', res.result.msg)
          self.setData({
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
        console.error('❌ 宠物列表云函数调用失败:', err)
        self.setData({
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
  },

  // 加载附近医院数据（实时） - 增强版
  loadNearbyHospitals() {
    const self = this
    const mapService = require('../../utils/mapService.js')

    console.log('🔄 开始加载实时附近医院数据...')

    // 显示加载状态
    self.setData({
      isLoadingHospitals: true,
      lastUpdateTime: '更新中...'
    })

    // 首先获取用户位置
    this.getUserLocationForHospitals().then(location => {
      console.log('✅ 用户位置获取成功:', location)

      // 调用地图服务搜索附近医院
      return mapService.searchNearbyHospitals(
        location.latitude,
        location.longitude,
        3000 // 搜索3公里内的医院
      )
    }).then(hospitals => {
      console.log('✅ 医院搜索成功:', hospitals)

      // 格式化医院数据用于首页显示
      const nearbyHospitals = hospitals.slice(0, 3).map(hospital => {
        console.log('🔍 处理医院数据:', hospital)

        // 安全处理距离数据，带单位
        let distanceStr = '1km'
        if (typeof hospital.distance === 'number' && hospital.distance >= 0) {
          if (hospital.distance >= 1000) {
            distanceStr = Math.round(hospital.distance / 1000) + 'km'
          } else {
            distanceStr = Math.round(hospital.distance) + 'm'
          }
        } else if (typeof hospital.distance === 'string') {
          // 如果是字符串，尝试转换为数字
          const numDistance = parseFloat(hospital.distance)
          if (!isNaN(numDistance) && numDistance >= 0) {
            if (numDistance >= 1000) {
              distanceStr = Math.round(numDistance / 1000) + 'km'
            } else {
              distanceStr = Math.round(numDistance) + 'm'
            }
          }
        }

        const formatted = {
          id: hospital.hospitalId || Date.now(),
          name: hospital.name || '宠物医院',
          distance: distanceStr,
          address: hospital.address || '地址信息更新中',
          is24h: hospital.is24h !== false,
          phone: hospital.phone || '电话咨询',
          latitude: hospital.latitude || 0,
          longitude: hospital.longitude || 0
        }

        console.log('✅ 格式化后:', formatted)
        return formatted
      })

      // 获取当前时间用于更新时间显示
      const currentTime = new Date()
      const timeString = this.formatUpdateTime(currentTime)

      self.setData({
        nearbyHospitals: nearbyHospitals,
        lastUpdateTime: timeString,
        isLoadingHospitals: false
      })

      console.log('✅ 附近医院数据实时加载完成:', nearbyHospitals)
      console.log('🕒 更新时间:', timeString)

      // 显示更新成功提示
      wx.showToast({
        title: '医院数据已更新',
        icon: 'success',
        duration: 1500
      })
    }).catch(error => {
      console.log('❌ 附近医院实时数据加载失败:', error)

      // API失败时，使用优化后的默认数据
      const fallbackHospitals = [
        { id: Date.now(), name: '爱心宠物医院', distance: '0.5', address: '提供24小时急诊服务', is24h: true, phone: '请电话确认', latitude: 0, longitude: 0 },
        { id: Date.now() + 1, name: '宠物中心医院', distance: '1.2', address: '全天候医疗服务', is24h: true, phone: '请电话确认', latitude: 0, longitude: 0 },
        { id: Date.now() + 2, name: '萌宠宠物诊所', distance: '2.0', address: '常规门诊服务', is24h: false, phone: '请电话确认', latitude: 0, longitude: 0 }
      ]

      const currentTime = new Date()
      const timeString = this.formatUpdateTime(currentTime) + ' (默认)'

      self.setData({
        nearbyHospitals: fallbackHospitals,
        lastUpdateTime: timeString,
        isLoadingHospitals: false
      })

      wx.showToast({
        title: '使用推荐医院数据',
        icon: 'none',
        duration: 2000
      })
    })
  },

  // 格式化更新时间
  formatUpdateTime(date) {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `今天 ${hours}:${minutes}`
  },

  // 获取用户位置（专门用于医院搜索）- 增强版，带缓存失效
  getUserLocationForHospitals() {
    const self = this
    return new Promise(function(resolve, reject) {
      const LOCATION_CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存
      const currentTime = Date.now()

      // 检查缓存的位置是否仍然有效
      if (app.globalData.latitude &&
          app.globalData.longitude &&
          app.globalData.locationUpdateTime &&
          (currentTime - app.globalData.locationUpdateTime) < LOCATION_CACHE_DURATION) {

        console.log('使用缓存的位置信息（有效期内）')
        resolve({
          latitude: app.globalData.latitude,
          longitude: app.globalData.longitude
        })
        return
      }

      // 需要重新获取位置
      console.log('正在获取实时位置信息...')

      // 先检查位置权限
      wx.getSetting({
        success: (settingRes) => {
          if (!settingRes.authSetting['scope.userLocation']) {
            // 没有权限，先请求权限
            wx.authorize({
              scope: 'scope.userLocation',
              success: () => {
                self.fetchRealTimeLocation(resolve)
              },
              fail: () => {
                // 用户拒绝权限，引导用户开启
                self.showLocationSettingDialog(resolve)
              }
            })
          } else {
            // 有权限，直接获取位置
            self.fetchRealTimeLocation(resolve)
          }
        },
        fail: () => {
          // 获取设置失败，直接尝试获取位置
          self.fetchRealTimeLocation(resolve)
        }
      })
    })
  },

  // 获取实时位置的具体实现
  fetchRealTimeLocation(resolve) {
    wx.getLocation({
      type: 'gcj02',
      success: function(res) {
        // 保存位置信息和更新时间
        app.globalData.latitude = res.latitude
        app.globalData.longitude = res.longitude
        app.globalData.locationUpdateTime = Date.now()

        console.log('实时位置获取成功:', {
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy,
          timestamp: new Date(app.globalData.locationUpdateTime).toLocaleTimeString()
        })

        resolve({
          latitude: res.latitude,
          longitude: res.longitude
        })
      },
      fail: function(error) {
        console.log('实时位置获取失败，使用默认位置:', error)

        // 使用北京天安门作为默认位置
        const defaultLocation = {
          latitude: 39.90469,
          longitude: 116.40717
        }

        app.globalData.latitude = defaultLocation.latitude
        app.globalData.longitude = defaultLocation.longitude
        app.globalData.locationUpdateTime = Date.now()

        wx.showModal({
          title: '位置服务提示',
          content: '无法获取您的实时位置，将使用默认位置显示附近医院。如需准确距离，请在设置中开启位置权限。',
          showCancel: false,
          confirmText: '知道了'
        })

        resolve(defaultLocation)
      }
    })
  },

  // 显示位置设置引导对话框
  showLocationSettingDialog(resolve) {
    wx.showModal({
      title: '需要位置权限',
      content: '为了准确显示附近的24小时宠物医院，需要获取您的位置信息。是否前往设置开启位置权限？',
      confirmText: '去设置',
      cancelText: '使用默认位置',
      success: (modalRes) => {
        if (modalRes.confirm) {
          wx.openSetting({
            success: (settingRes) => {
              if (settingRes.authSetting['scope.userLocation']) {
                // 用户同意了位置权限，重新获取
                this.fetchRealTimeLocation(resolve)
              } else {
                // 用户仍然拒绝，使用默认位置
                this.resolveWithDefaultLocation(resolve)
              }
            },
            fail: () => {
              this.resolveWithDefaultLocation(resolve)
            }
          })
        } else {
          // 用户选择使用默认位置
          this.resolveWithDefaultLocation(resolve)
        }
      }
    })
  },

  // 使用默认位置解析
  resolveWithDefaultLocation(resolve) {
    const defaultLocation = {
      latitude: 39.90469,
      longitude: 116.40717
    }

    app.globalData.latitude = defaultLocation.latitude
    app.globalData.longitude = defaultLocation.longitude
    app.globalData.locationUpdateTime = Date.now()

    wx.showToast({
      title: '已使用默认位置',
      icon: 'none',
      duration: 2000
    })

    resolve(defaultLocation)
  },

  // 计算宠物健康状态（向后兼容）
  calculateHealthStatus(pet) {
    const hasRecentVaccine = pet.vaccineDate && this.isDateRecent(pet.vaccineDate)
    const hasRecentDeworming = pet.dewormDate && this.isDateRecent(pet.dewormDate)

    if (hasRecentVaccine && hasRecentDeworming) {
      return 'good'
    } else {
      return 'warning'
    }
  },

  // 检查日期是否在最近30天内
  isDateRecent(dateString) {
    if (!dateString) return false

    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now - date
    const diffDays = diffTime / (1000 * 60 * 60 * 24)

    return diffDays <= 30
  },

  // 获取健康状态文本
  getHealthStatusText(status) {
    return status === 'good' ? '状态良好' : '需要关注'
  },

  // 获取模拟宠物数据（用于未登录或加载失败时）
  getMockPets() {
    return [
      {
        id: 'mock1',
        name: '小白',
        avatar: '🐱',
        type: 'cat',
        age: 2,
        healthStatus: 'good',
        healthStatusText: '状态良好'
      },
      {
        id: 'mock2',
        name: '大黄',
        avatar: '🐶',
        type: 'dog',
        age: 3,
        healthStatus: 'warning',
        healthStatusText: '需要关注'
      }
    ]
  },

  // 加载每日健康提示
  loadDailyTip() {
    const tips = [
      '定期体检是预防疾病的关键，建议每年至少为宠物进行一次全面体检。',
      '注意观察宠物的食欲和精神状态，异常时及时就医。',
      '保持适量的运动有助于宠物的身心健康。',
      '定期驱虫是预防寄生虫感染的重要措施。',
      '注意宠物的口腔卫生，定期刷牙可以预防牙齿问题。'
    ]

    const randomTip = tips[Math.floor(Math.random() * tips.length)]
    this.setData({
      dailyTip: randomTip
    })
  },

  // 跳转到急救通道
  toEmergency() {
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

  // 跳转到症状自查
  toSymptom() {
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

  // 跳转到就医导航
  toHospital() {
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

  // 跳转到宠物档案
  toPetProfile() {
    console.log('点击健康档案按钮')
    try {
      wx.navigateTo({
        url: '/pages/pet/profile',
        success: function() {
          console.log('跳转宠物档案成功')
        },
        fail: function(err) {
          console.error('跳转宠物档案失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      console.error('健康档案按钮点击异常:', error)
    }
  },

  // 查看宠物详情（点击宠物健康状态卡片）
  viewPetDetail(e) {
    const petId = e.currentTarget.dataset.petId
    const petName = e.currentTarget.dataset.petName

    console.log('查看宠物详情:', petId, petName)

    try {
      // 跳转到宠物档案页面，并传递宠物ID
      wx.navigateTo({
        url: `/pages/pet/profile?petId=${petId}&action=edit`,
        success: function() {
          console.log('跳转宠物档案成功，准备编辑宠物:', petName)
        },
        fail: function(err) {
          console.error('跳转宠物档案失败:', err)
          wx.showToast({
            title: '页面跳转失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      console.error('查看宠物详情异常:', error)
    }
  },

  // 跳转到知识页面
  toKnowledge() {
    console.log('点击科普知识按钮')
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 显示更多功能
  showMoreFeatures() {
    wx.showToast({
      title: '更多功能开发中',
      icon: 'none'
    })
  },

  // 添加宠物
  addPet() {
    console.log('点击添加宠物')
    try {
      wx.navigateTo({
        url: '/pages/pet/profile',
        success: function() {
          console.log('跳转宠物档案成功，准备打开添加弹窗')
          // 延迟一下，确保页面加载完成
          setTimeout(() => {
            // 这里可以通过事件通知宠物档案页面打开添加弹窗
          }, 500)
        },
        fail: function(err) {
          console.error('跳转宠物档案失败:', err)
        }
      })
    } catch (error) {
      console.error('添加宠物功能异常:', error)
    }
  },

  // 刷新健康状态
  refreshHealthStatus() {
    console.log('刷新宠物健康状态')
    this.loadPetList()
    wx.showToast({
      title: '刷新成功',
      icon: 'success'
    })
  },

  // 跳转到用户中心
  toUser() {
    console.log('点击用户头像')
    try {
      wx.switchTab({
        url: '/pages/user/index',
        success: function() {
          console.log('跳转用户中心成功')
        },
        fail: function(err) {
          console.error('跳转用户中心失败:', err)
        }
      })
    } catch (error) {
      console.error('用户头像点击异常:', error)
    }
  },

  // 导航到医院（直接打开地图）
  navigateToHospital(e) {
    const hospital = e.currentTarget.dataset.hospital
    console.log('导航到医院:', hospital)

    if (!hospital) {
      console.error('未找到医院数据')
      wx.showToast({
        title: '医院信息未找到',
        icon: 'none'
      })
      return
    }

    // 检查医院是否有位置信息
    if (!hospital.latitude || !hospital.longitude || hospital.latitude === 0 || hospital.longitude === 0) {
      console.warn('医院位置信息不完整，跳转到医院列表')
      wx.showModal({
        title: '位置信息不完整',
        content: '该医院的详细位置信息还在更新中，是否前往医院列表查看更多信息？',
        confirmText: '前往列表',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/hospital/list'
            })
          }
        }
      })
      return
    }

    // 直接打开地图导航
    try {
      wx.openLocation({
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        name: hospital.name,
        address: hospital.address,
        scale: 15,
        success: function() {
          console.log('地图导航打开成功:', hospital.name)
        },
        fail: function(error) {
          console.error('地图导航打开失败:', error)
          wx.showToast({
            title: '地图打开失败',
            icon: 'none'
          })
        }
      })
    } catch (error) {
      console.error('导航功能异常:', error)
      wx.showToast({
        title: '导航失败',
        icon: 'none'
      })
    }
  },

  // 页面卸载时清理定时器
  onUnload() {
    if (this.data.hospitalLoadTimer) {
      clearTimeout(this.data.hospitalLoadTimer)
    }
  }
})