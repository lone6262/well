// 宠物档案页面逻辑 - 数据库版本 + 图片上传
var app = getApp()
var imageUpload = require('../../utils/imageUpload.js')

Page({
  data: {
    petList: [],
    showModal: false,
    isEdit: false,
    currentPetId: '',
    formData: {
      name: '',
      type: 'cat',
      breed: '',
      age: '',
      weight: '',
      gender: 'male',
      vaccineDate: '',
      dewormDate: '',
      avatar: '' // 新增头像字段
    },
    showRecordModal: false,
    recordModalTitle: '',
    recordList: [],
    currentRecordPetId: '',
    recordLoading: false,
    loading: true,
    uploadingImage: false, // 图片上传状态
    avatarPreview: '' // 头像预览
  },

  onLoad: function(options) {
    console.log('宠物档案页面加载', options)

    // 检查是否有URL参数
    if (options) {
      console.log('URL参数:', options)

      // 如果有action=edit和petId参数，自动打开编辑弹窗
      if (options.action === 'edit' && options.petId) {
        this.autoEditPetId = options.petId
        console.log('检测到自动编辑请求，宠物ID:', options.petId)
      }
    }

    this.loadPetList()
  },

  onShow: function() {
    // 每次显示时重新加载，确保数据最新
    this.loadPetList()
  },

  // 从数据库加载宠物列表
  loadPetList: function() {
    var self = this

    // 使用统一的登录状态检查方法
    var openid = app.getOpenid()

    if (!openid || (typeof openid === 'string' && openid.indexOf('mock_') === 0)) {
      console.log('用户未登录，引导登录')
      self.setData({
        petList: [],
        loading: false
      })
      self._requireLogin()
      return
    }

    console.log('从数据库加载宠物列表...', openid)

    // 检查云开发是否可用
    if (!app.globalData.cloudDevelopmentAvailable) {
      console.log('⚠️ 云开发不可用，使用本地模拟数据')
      self.loadLocalMockData()
      return
    }

    wx.cloud.callFunction({
      name: 'getPetList',
      data: {
        openid: openid
      },
      success: function(res) {
        console.log('宠物列表加载成功:', res.result)

        if (res.result.code === 0) {
          // 数据映射：确保每个宠物都有petId字段
          var petList = (res.result.data.petList || []).map(function(pet) {
            var id = pet._id || pet.petId || 'unknown'
            return {
              _id: id,
              petId: pet.petId || pet._id || id,
              petCode: pet.petCode || (function() {
                var prefix = pet.type === 'cat' ? 'CAT' : 'DOG';
                return prefix + '-NEW';
              })(),
              petIdDisplay: (pet.petId || pet._id || id).substring(0, 8),
              name: pet.name || '未命名',
              type: pet.type || 'cat',
              breed: pet.breed || '',
              age: pet.age || '',
              weight: pet.weight || '',
              gender: pet.gender || 'male',
              vaccineDate: pet.vaccineDate || '',
              dewormDate: pet.dewormDate || '',
              avatar: pet.avatar || '',
              createdAt: pet.createdAt || ''
            }
          })

          console.log('✅ 数据映射完成，petList:', petList)

          self.setData({
            petList: petList,
            loading: false
          })

          // 如果没有宠物，显示添加提示
          if (petList.length === 0) {
            self.showEmptyState()
          }

          // 加载每个宠物的记录计数
          self.loadRecordCounts(petList)

          // 检查是否有自动编辑请求
          if (self.autoEditPetId) {
            console.log('宠物列表加载完成，准备自动打开编辑弹窗')
            setTimeout(function() {
              self.autoOpenEditModal(self.autoEditPetId)
              self.autoEditPetId = null // 清除标记
            }, 300) // 延迟一下确保UI渲染完成
          }
        } else {
          console.error('宠物列表加载失败:', res.result.msg)
          self.setData({
            petList: [],
            loading: false
          })
          wx.showToast({
            title: res.result.msg || '加载失败',
            icon: 'none'
          })
        }
      },
      fail: function(err) {
        console.error('宠物列表加载失败:', err)

        // 云函数调用失败，标记云开发不可用并使用降级方案
        app.globalData.cloudDevelopmentAvailable = false
        console.log('⚠️ 云函数调用失败，切换到本地模式')
        self.loadLocalMockData()
      }
    })
  },

  // === 新增：加载本地模拟数据（降级方案）===
  loadLocalMockData: function() {
    var self = this

    console.log('=== 使用本地模拟数据 ===')

    // 首先尝试从本地存储加载
    var localPets = wx.getStorageSync('localPets') || []

    if (localPets.length > 0) {
      console.log('✅ 从本地存储加载宠物数据:', localPets)

      // 数据映射：确保每个宠物都有petId字段
      var mappedPets = localPets.map(function(pet) {
        var id = pet._id || pet.petId || 'local_' + Date.now()
        return {
          _id: id,
          petId: pet.petId || pet._id || id,
          petCode: pet.petCode || (function() {
                var prefix = pet.type === 'cat' ? 'CAT' : 'DOG';
                return prefix + '-NEW';
              })(),
          petIdDisplay: (pet.petId || pet._id || id).substring(0, 8),
          name: pet.name || '未命名',
          type: pet.type || 'cat',
          breed: pet.breed || '',
          age: pet.age || '',
          weight: pet.weight || '',
          gender: pet.gender || 'male',
          vaccineDate: pet.vaccineDate || '',
          dewormDate: pet.dewormDate || '',
          avatar: pet.avatar || '',
          createdAt: pet.createdAt || ''
        }
      })

      self.setData({
        petList: mappedPets,
        loading: false
      })

      wx.showToast({
        title: '本地模式（已保存数据）',
        icon: 'none',
        duration: 1500
      })
    } else {
      console.log('⚠️ 本地存储为空，使用演示数据')

      var mockPets = [
        {
          _id: 'mock_pet_1',
          petId: 'mock_pet_1',
          name: '小白',
          type: 'cat',
          breed: '英国短毛猫',
          age: 2,
          weight: 4.5,
          gender: 'male',
          vaccineDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          dewormDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          avatar: '',
          createdAt: new Date().toISOString()
        },
        {
          _id: 'mock_pet_2',
          petId: 'mock_pet_2',
          name: '大黄',
          type: 'dog',
          breed: '金毛寻回犬',
          age: 3,
          weight: 28.0,
          gender: 'male',
          vaccineDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          dewormDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          avatar: '',
          createdAt: new Date().toISOString()
        }
      ]

      self.setData({
        petList: mockPets,
        loading: false
      })

      wx.showToast({
        title: '本地模式（演示数据）',
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 显示空状态提示
  showEmptyState: function() {
    wx.showModal({
      title: '宠物档案',
      content: '还没有添加宠物，是否现在添加？',
      confirmText: '立即添加',
      cancelText: '稍后再说',
      success: function(res) {
        if (res.confirm) {
          this.showAddModal()
        }
      }.bind(this)
    })
  },

  // 显示添加宠物弹窗
  showAddModal: function() {
    var self = this
    // 登录检查：mock用户需要先登录
    var openid = app.getOpenid()
    if (!openid || (typeof openid === 'string' && openid.indexOf('mock_') === 0)) {
      self._requireLogin()
      return
    }
    this.setData({
      showModal: true,
      isEdit: false,
      currentPetId: '',
      formData: {
        name: '',
        type: 'cat',
        breed: '',
        age: '',
        weight: '',
        gender: 'male',
        vaccineDate: '',
        dewormDate: '',
        avatar: ''
      },
      avatarPreview: ''
    })
  },

  // 显示编辑宠物弹窗
  showEditModal: function(e) {
    var petId = e.currentTarget.dataset.petId
    var pet = this.data.petList.find(function(p) { return p._id === petId })

    if (!pet) {
      wx.showToast({
        title: '宠物信息不存在',
        icon: 'none'
      })
      return
    }

    this.setData({
      showModal: true,
      isEdit: true,
      currentPetId: petId,
      formData: {
        name: pet.name || '',
        type: pet.type || 'cat',
        breed: pet.breed || '',
        age: pet.age || '',
        weight: pet.weight || '',
        gender: pet.gender || 'male',
        vaccineDate: pet.vaccineDate || '',
        dewormDate: pet.dewormDate || '',
        avatar: pet.avatar || ''
      },
      avatarPreview: pet.avatar || ''
    })
  },

  // 显示添加宠物弹窗
  addPet: function() {
    var self = this
    // 登录检查
    var openid = app.getOpenid()
    if (!openid || (typeof openid === 'string' && openid.indexOf('mock_') === 0)) {
      self._requireLogin()
      return
    }
    this.setData({
      showModal: true,
      isEdit: false,
      currentPetId: '',
      avatarPreview: '',
      formData: {
        name: '',
        type: 'cat',
        breed: '',
        age: '',
        weight: '',
        gender: 'male',
        vaccineDate: '',
        dewormDate: '',
        avatar: ''
      }
    })
  },

  // 显示编辑宠物弹窗
  editPet: function(e) {
    var petId = e.currentTarget.dataset.petId
    var pet = this.data.petList.find(function(p) { return p.petId === petId })

    if (!pet) {
      wx.showToast({
        title: '宠物信息不存在',
        icon: 'none'
      })
      return
    }

    this.setData({
      showModal: true,
      isEdit: true,
      currentPetId: petId,
      formData: {
        name: pet.name || '',
        type: pet.type || 'cat',
        breed: pet.breed || '',
        age: pet.age || '',
        weight: pet.weight || '',
        gender: pet.gender || 'male',
        vaccineDate: pet.vaccineDate || '',
        dewormDate: pet.dewormDate || ''
      }
    })
  },

  // 关闭弹窗
  hideModal: function() {
    this.setData({
      showModal: false,
      isEdit: false,
      currentPetId: '',
      avatarPreview: '',
      formData: {
        name: '',
        type: 'cat',
        breed: '',
        age: '',
        weight: '',
        gender: 'male',
        vaccineDate: '',
        dewormDate: '',
        avatar: ''
      }
    })
  },

  // === 登录引导 ===
  _requireLogin: function() {
    var self = this
    wx.showModal({
      title: '需要登录',
      content: '添加宠物需要先登录，是否立即登录？',
      confirmText: '立即登录',
      cancelText: '稍后再说',
      success: function(res) {
        if (res.confirm) {
          self._doLogin()
        }
      }
    })
  },

  // 执行登录（重新走静默登录流程）
  _doLogin: function() {
    var self = this
    wx.showLoading({ title: '登录中...', mask: true })

    // 清除旧的mock数据
    wx.removeStorageSync('mockOpenid')
    app.globalData.openid = null

    // 触发静默登录
    app.silentLogin()

    // 监听登录完成
    app.onLoginComplete(function(openid) {
      wx.hideLoading()

      if (openid && typeof openid === 'string' && openid.indexOf('mock_') !== 0) {
        console.log('登录成功，刷新宠物列表')
        wx.showToast({ title: '登录成功', icon: 'success' })
        self.loadPetList()
      } else {
        console.log('登录失败')
        wx.showModal({
          title: '登录失败',
          content: '登录未成功，请稍后重试或检查网络连接',
          showCancel: false
        })
      }
    })
  },

  // 选择宠物类型
  selectType: function(e) {
    var type = e.currentTarget.dataset.type
    this.setData({
      'formData.type': type
    })
  },

  // 表单输入处理
  onNameInput: function(e) {
    this.setData({
      'formData.name': e.detail.value
    })
  },

  onTypeChange: function(e) {
    this.setData({
      'formData.type': e.detail.value
    })
  },

  onBreedInput: function(e) {
    this.setData({
      'formData.breed': e.detail.value
    })
  },

  onAgeInput: function(e) {
    this.setData({
      'formData.age': e.detail.value
    })
  },

  onWeightInput: function(e) {
    this.setData({
      'formData.weight': e.detail.value
    })
  },

  // === 新增：输入框焦点事件处理 ===
  onInputFocus: function(e) {
    console.log('输入框获得焦点，当前值:', e.detail.value)

    // 获得焦点时，如果有placeholder且没有输入内容，placeholder应该自动消失
    // 微信小程序会自动处理这个行为，但我们可以确保它正常工作

    var fieldName = e.currentTarget.dataset.field || ''
    console.log('输入字段:', fieldName)
  },

  onInputBlur: function(e) {
    console.log('输入框失去焦点，当前值:', e.detail.value)
    // 当输入框失去焦点且为空时，placeholder会重新显示
  },

  onGenderChange: function(e) {
    const gender = e.currentTarget.dataset.value
    this.setData({
      'formData.gender': gender
    })
  },

  onVaccineDateChange: function(e) {
    this.setData({
      'formData.vaccineDate': e.detail.value
    })
  },

  onDewormDateChange: function(e) {
    this.setData({
      'formData.dewormDate': e.detail.value
    })
  },

  // 保存宠物信息
  savePet: function() {
    var self = this
    var formData = self.data.formData

    // 验证必填项
    if (!formData.name || !formData.type || !formData.age) {
      wx.showToast({
        title: '请填写必填项',
        icon: 'none'
      })
      return
    }

    // 验证年龄为数字
    if (isNaN(parseFloat(formData.age))) {
      wx.showToast({
        title: '年龄必须是数字',
        icon: 'none'
      })
      return
    }

    console.log('保存宠物信息:', formData)

    wx.showLoading({
      title: '保存中...',
      mask: true
    })

    // 检查云开发是否可用
    if (!app.globalData.cloudDevelopmentAvailable) {
      console.log('⚠️ 云开发不可用，使用本地存储')
      self.saveToLocalStorage(formData)
      return
    }

    // 准备提交数据
    var submitData = {
      openid: app.getOpenid(),
      name: formData.name,
      type: formData.type,
      breed: formData.breed || '',
      age: parseFloat(formData.age),
      weight: formData.weight ? parseFloat(formData.weight) : 0,
      gender: formData.gender,
      vaccineDate: formData.vaccineDate || '',
      dewormDate: formData.dewormDate || '',
      avatar: formData.avatar || '' // 新增头像字段
    }

    // 如果是编辑，添加petId
    if (self.data.isEdit) {
      submitData.petId = self.data.currentPetId
    }

    // 调用云函数保存
    wx.cloud.callFunction({
      name: 'savePet',
      data: submitData,
      success: function(res) {
        console.log('宠物保存成功:', res.result)
        wx.hideLoading()

        if (res.result.code === 0) {
          wx.showToast({
            title: self.data.isEdit ? '修改成功' : '添加成功',
            icon: 'success'
          })

          self.hideModal()

          // 重新加载宠物列表
          self.loadPetList()

          // 通知其他页面数据已更新
          app.globalData.petsUpdated = true

        } else {
          wx.showToast({
            title: res.result.msg || '保存失败',
            icon: 'none'
          })
        }
      },
      fail: function(err) {
        console.error('宠物保存失败:', err)
        wx.hideLoading()

        // 云函数调用失败，尝试本地存储
        console.log('⚠️ 云函数调用失败，尝试本地存储')
        app.globalData.cloudDevelopmentAvailable = false
        self.saveToLocalStorage(formData)
      }
    })
  },

  // === 新增：保存到本地存储（降级方案）===
  saveToLocalStorage: function(formData) {
    var self = this

    console.log('=== 保存宠物到本地存储 ===')

    // 生成宠物ID
    var petId = self.data.isEdit ? self.data.currentPetId : 'local_pet_' + Date.now()

    // 生成宠物编号
    var typePrefix = formData.type === 'cat' ? 'CAT' : 'DOG';
    var localPets = wx.getStorageSync('localPets') || [];
    var existingCodes = localPets
      .filter(function(p) { return p.petCode && p.petCode.startsWith(typePrefix); })
      .map(function(p) { return parseInt(p.petCode.split('-')[1]); });
    existingCodes.sort(function(a, b) { return b - a; });
    var nextNum = existingCodes.length > 0 ? existingCodes[0] + 1 : 1;
    var petCodeVal = typePrefix + '-' + String(nextNum).padStart(3, '0');

    var petData = {
      _id: petId,
      petId: petId,
      petCode: petCodeVal,
      name: formData.name,
      type: formData.type,
      breed: formData.breed || '',
      age: parseFloat(formData.age),
      weight: formData.weight ? parseFloat(formData.weight) : 0,
      gender: formData.gender,
      vaccineDate: formData.vaccineDate || '',
      dewormDate: formData.dewormDate || '',
      avatar: formData.avatar || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // 获取现有的本地宠物列表
    var localPets = wx.getStorageSync('localPets') || []

    if (self.data.isEdit) {
      // 更新现有宠物
      var index = localPets.findIndex(function(p) {
        return p._id === petId || p.petId === petId
      })
      if (index !== -1) {
        localPets[index] = petData
      }
    } else {
      // 添加新宠物
      localPets.push(petData)
    }

    // 保存到本地存储
    wx.setStorageSync('localPets', localPets)

    wx.hideLoading()

    wx.showToast({
      title: '保存成功（本地模式）',
      icon: 'success'
    })

    self.hideModal()

    // 重新加载宠物列表
    self.loadPetList()

    // 通知其他页面数据已更新
    app.globalData.petsUpdated = true

    console.log('✅ 宠物数据已保存到本地存储')
  },

  // 删除宠物
  deletePet: function(e) {
    console.log('🗑️🗑️🗑️ 删除按钮被点击！！！')
    console.log('事件对象:', e)
    console.log('currentTarget:', e.currentTarget)
    console.log('dataset:', e.currentTarget.dataset)

    var self = this
    var petId = e.currentTarget.dataset.petId

    console.log('🗑️ 删除按钮点击，宠物ID:', petId)
    console.log('当前宠物列表:', self.data.petList)

    if (!petId) {
      console.error('❌ petId为空！')
      wx.showToast({
        title: '宠物ID获取失败',
        icon: 'none'
      })
      return
    }

    var pet = self.data.petList.find(function(p) {
      console.log('检查宠物:', p._id, '===', petId, '?', p._id === petId)
      return p._id === petId || p.petId === petId
    })

    if (!pet) {
      console.error('❌ 未找到宠物信息，petId:', petId)
      wx.showToast({
        title: '宠物信息不存在',
        icon: 'none'
      })
      return
    }

    console.log('✅ 找到宠物信息，准备显示确认对话框:', pet)

    wx.showModal({
      title: '确认删除',
      content: '确定要删除「' + pet.name + '」的信息吗？',
      confirmText: '删除',
      confirmColor: '#ff0000',
      success: function(res) {
        if (res.confirm) {
          self.confirmDeletePet(petId)
        }
      }
    })
  },

  // 确认删除宠物
  confirmDeletePet: function(petId) {
    var self = this

    console.log('🔄 开始删除宠物流程，petId:', petId)
    console.log('云开发状态:', app.globalData.cloudDevelopmentAvailable)

    wx.showLoading({
      title: '删除中...',
      mask: true
    })

    // 检查云开发是否可用
    if (!app.globalData.cloudDevelopmentAvailable) {
      console.log('⚠️ 云开发不可用，使用本地存储删除')
      self.deleteFromLocalStorage(petId)
      return
    }

    var openid = app.getOpenid()
    console.log('准备调用deletePet云函数，openid:', openid, 'petId:', petId)

    // 调用云函数删除宠物
    wx.cloud.callFunction({
      name: 'deletePet',
      data: {
        openid: openid,
        petId: petId
      },
      success: function(res) {
        console.log('✅ deletePet云函数调用成功:', res.result)
        wx.hideLoading()

        if (res.result.code === 0) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          })

          // 重新加载宠物列表
          self.loadPetList()

          // 通知其他页面数据已更新
          app.globalData.petsUpdated = true
        } else {
          console.error('❌ 删除失败，服务器返回错误:', res.result.msg)
          wx.showToast({
            title: res.result.msg || '删除失败',
            icon: 'none'
          })
        }
      },
      fail: function(err) {
        console.error('❌ deletePet云函数调用失败:', err)
        wx.hideLoading()

        // 云函数调用失败，尝试本地存储删除
        console.log('⚠️ 云函数调用失败，尝试本地存储删除')
        app.globalData.cloudDevelopmentAvailable = false
        self.deleteFromLocalStorage(petId)
      }
    })
  },

  // === 新增：从本地存储删除宠物（降级方案）===
  deleteFromLocalStorage: function(petId) {
    var self = this

    console.log('🔄 从本地存储删除宠物，petId:', petId)

    // 获取现有的本地宠物列表
    var localPets = wx.getStorageSync('localPets') || []
    console.log('当前本地存储宠物列表:', localPets)

    // 找到并删除宠物
    var originalLength = localPets.length
    localPets = localPets.filter(function(p) {
      console.log('检查宠物:', p._id, '===', petId, '?', p._id !== petId && p.petId !== petId)
      return p._id !== petId && p.petId !== petId
    })

    if (localPets.length < originalLength) {
      console.log('✅ 找到并删除宠物，更新本地存储')

      // 保存更新后的列表
      wx.setStorageSync('localPets', localPets)

      wx.hideLoading()

      wx.showToast({
        title: '删除成功（本地模式）',
        icon: 'success'
      })

      // 重新加载宠物列表
      self.loadPetList()

      // 通知其他页面数据已更新
      app.globalData.petsUpdated = true

      console.log('✅ 宠物已从本地存储删除')
    } else {
      console.error('❌ 未找到对应的宠物信息，petId:', petId)
      wx.hideLoading()

      wx.showToast({
        title: '未找到宠物信息',
        icon: 'none'
      })
    }
  },

  // === 图片上传相关方法 ===

  // 选择并上传宠物头像
  chooseAvatar: function() {
    var self = this

    // 显示上传中状态
    self.setData({
      uploadingImage: true
    })

    // 生成临时ID用于上传
    var tempId = self.data.currentPetId || 'temp_' + Date.now()

    console.log('📸 开始选择并上传宠物头像, tempId:', tempId)

    // 使用图片上传服务
    imageUpload.selectAndUpload(tempId)
      .then(function(cloudURL) {
        console.log('✅ 头像上传成功:', cloudURL)

        // 更新表单数据和预览
        self.setData({
          'formData.avatar': cloudURL,
          'avatarPreview': cloudURL,
          'uploadingImage': false
        })

        wx.showToast({
          title: '头像上传成功',
          icon: 'success'
        })
      })
      .catch(function(error) {
        console.error('❌ 头像上传失败:', error)
        self.setData({
          'uploadingImage': false
        })

        // 根据错误类型显示不同提示
        var errorMsg = '上传失败'
        if (error.code === 'INVALID_FORMAT') {
          errorMsg = '不支持的图片格式'
        } else if (error.code === 'FILE_TOO_LARGE') {
          errorMsg = '图片过大，请选择5MB以内的图片'
        } else if (error.code === 'INVALID_DIMENSIONS') {
          errorMsg = error.message
        } else if (error.code === 'CHOOSE_IMAGE_ERROR') {
          errorMsg = '选择图片失败'
        }

        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 2000
        })
      })
  },

  // 删除当前头像
  removeAvatar: function() {
    var self = this

    if (self.data.formData.avatar) {
      wx.showModal({
        title: '删除头像',
        content: '确定要删除当前头像吗？',
        success: function(res) {
          if (res.confirm) {
            // 如果是云存储URL，尝试删除
            if (self.data.formData.avatar.startsWith('cloud://')) {
              imageUpload.deleteFromCloud(self.data.formData.avatar)
                .then(function() {
                  console.log('✅ 云存储头像删除成功')
                })
                .catch(function(err) {
                  console.error('❌ 云存储头像删除失败:', err)
                })
            }

            // 清空表单和预览
            self.setData({
              'formData.avatar': '',
              'avatarPreview': ''
            })

            wx.showToast({
              title: '头像已删除',
              icon: 'success'
            })
          }
        }
      })
    }
  },

  // 预览头像大图
  previewAvatar: function() {
    if (this.data.avatarPreview) {
      wx.previewImage({
        urls: [this.data.avatarPreview],
        current: this.data.avatarPreview
      })
    }
  },

  // 自动打开编辑弹窗（从首页跳转过来时使用）
  autoOpenEditModal: function(petId) {
    var self = this

    console.log('准备自动打开编辑弹窗，宠物ID:', petId)

    // 在当前宠物列表中查找对应的宠物
    var pet = self.data.petList.find(function(p) {
      return p._id === petId || p.petId === petId
    })

    if (pet) {
      console.log('找到宠物信息，自动打开编辑弹窗:', pet)

      // 填充表单数据
      self.setData({
        showModal: true,
        isEdit: true,
        currentPetId: pet._id || pet.petId,
        formData: {
          name: pet.name || '',
          type: pet.type || 'cat',
          breed: pet.breed || '',
          age: pet.age || '',
          weight: pet.weight || '',
          gender: pet.gender || 'male',
          vaccineDate: pet.vaccineDate || '',
          dewormDate: pet.dewormDate || '',
          avatar: pet.avatar || ''
        },
        avatarPreview: pet.avatar || ''
      })

      wx.showToast({
        title: `正在编辑${pet.name}`,
        icon: 'success',
        duration: 1500
      })
    } else {
      console.error('未找到对应的宠物信息，宠物ID:', petId)
      wx.showToast({
        title: '未找到宠物信息',
        icon: 'none'
      })
    }
  },

  // === 自查记录 ===
  showPetRecords: function(e) {
    var petId = e.currentTarget.dataset.petId;
    var petName = e.currentTarget.dataset.petName;
    console.log('📋 点击自查记录，petId:', petId, 'petName:', petName);
    this.loadRecordsByPet(petId, petName, 'record');
  },

  // === 健康报告 ===
  showPetReports: function(e) {
    var petId = e.currentTarget.dataset.petId;
    var petName = e.currentTarget.dataset.petName;
    console.log('📊 点击健康报告，petId:', petId, 'petName:', petName);
    this.loadRecordsByPet(petId, petName, 'report');
  },

  // === 加载每个宠物的记录计数 ===
  loadRecordCounts: function(petList) {
    var self = this;
    if (!app.globalData.cloudDevelopmentAvailable || !petList || petList.length === 0) return;

    var openid = app.getOpenid();
    if (!openid) return;

    wx.cloud.callFunction({
      name: 'getRecordList',
      data: {
        openid: openid,
        page: 1,
        pageSize: 100
      },
      success: function(res) {
        if (res.result.code === 0) {
          var records = res.result.data.records || [];
          // 按宠物ID统计记录数
          var countMap = {};
          records.forEach(function(r) {
            var pid = r.petId || r.pet_id;
            if (pid) {
              countMap[pid] = (countMap[pid] || 0) + 1;
            }
          });

          console.log('📋 记录计数映射:', countMap);

          // 更新每个宠物的记录计数
          var updatedList = petList.map(function(pet) {
            var pid = pet._id || pet.petId;
            var count = countMap[pid] || 0;
            return {
              _id: pet._id,
              petId: pet.petId,
              petCode: pet.petCode,
              petIdDisplay: pet.petIdDisplay,
              name: pet.name,
              type: pet.type,
              breed: pet.breed,
              age: pet.age,
              weight: pet.weight,
              gender: pet.gender,
              vaccineDate: pet.vaccineDate,
              dewormDate: pet.dewormDate,
              avatar: pet.avatar,
              createdAt: pet.createdAt,
              recordCount: count,
              reportCount: count
            };
          });

          self.setData({ petList: updatedList });
        }
      },
      fail: function(err) {
        console.error('❌ 加载记录计数失败:', err);
      }
    });
  },

  // === 加载宠物相关的记录 ===
  loadRecordsByPet: function(petId, petName, type) {
    var self = this;

    if (!petId) {
      wx.showToast({ title: '宠物信息异常', icon: 'none' });
      return;
    }

    self.setData({
      currentRecordPetId: petId,
      showRecordModal: true,
      recordModalTitle: (type === 'record' ? '自查记录 - ' : '健康报告 - ') + petName,
      recordList: [],
      recordLoading: true
    });

    if (!app.globalData.cloudDevelopmentAvailable) {
      self.setData({ recordList: [], recordLoading: false });
      return;
    }

    var openid = app.getOpenid();
    if (!openid) {
      self.setData({ recordList: [], recordLoading: false });
      return;
    }

    wx.cloud.callFunction({
      name: 'getRecordList',
      data: {
        openid: openid,
        page: 1,
        pageSize: 50
      },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var allRecords = (res.result.data && res.result.data.records) || [];

          // 兼容 petId 和 pet_id 两种字段名
          var petRecords = allRecords.filter(function(r) {
            return r.petId === petId || r.pet_id === petId;
          });

          console.log('📋 筛选记录: 共', allRecords.length, '条, 匹配', petRecords.length, '条, petId:', petId);

          var list = petRecords.map(function(r) {
            var level = r.riskLevel || r.risk_level || 'low';
            var iconMap = { low: '✅', mid: '⚠️', high: '❌' };
            var bgMap = { low: '#E8F5E9', mid: '#FFF3E0', high: '#FFEBEE' };
            var levelText = { low: '低风险', mid: '中等风险', high: '高风险' };
            var symptomNames = r.symptoms || r.symptom_names || [];
            var createdAt = r.createdAt || r.created_at || '';
            return {
              _id: r._id,
              icon: iconMap[level] || '✅',
              bgColor: bgMap[level] || '#E8F5E9',
              title: symptomNames.slice(0, 3).join('、') || '自查记录',
              desc: (typeof createdAt === 'string' ? createdAt.substring(0, 10) : '') + ' · ' + (levelText[level] || '低风险'),
              riskLevel: level
            };
          });

          self.setData({ recordList: list, recordLoading: false });
        } else {
          console.error('❌ 获取记录失败:', res.result.msg);
          self.setData({ recordList: [], recordLoading: false });
          wx.showToast({ title: res.result.msg || '加载失败', icon: 'none' });
        }
      },
      fail: function(err) {
        console.error('❌ 云函数调用失败:', err);
        self.setData({ recordList: [], recordLoading: false });
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
      }
    });
  },

  // === 关闭弹窗 ===
  hideRecordModal: function() {
    this.setData({ showRecordModal: false });
  },

  // === 查看记录详情 ===
  viewRecordDetail: function(e) {
    var recordId = e.currentTarget.dataset.recordId;
    if (!recordId) return;
    var record = this.data.recordList.find(function(r) { return r._id === recordId; });
    var riskLevel = record ? (record.riskLevel || 'low') : 'low';
    wx.navigateTo({
      url: '/pages/risk/result?assessmentId=' + recordId + '&riskLevel=' + riskLevel
    });
  },

})