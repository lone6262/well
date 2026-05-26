// 宠物档案页面逻辑 - ES5完全兼容版本
var app = getApp()

// 本地常量定义
var PET_TYPES = {
  CAT: 'cat',
  DOG: 'dog',
  OTHER: 'other'
};

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
      vaccineDate: '',
      dewormDate: ''
    }
  },

  onLoad: function() {
    console.log('宠物档案页面加载')
    this.loadPetList()
  },

  onShow: function() {
    this.loadPetList()
  },

  // 加载宠物列表（ES5兼容版本）
  loadPetList: function() {
    // 先尝试从本地存储获取
    var savedPets = wx.getStorageSync('mock_pets') || []

    if (savedPets.length > 0) {
      this.setData({ petList: savedPets })
    } else {
      // 使用默认模拟数据
      var mockPets = [
        { petId: 'mock_001', name: '测试宠物1', type: 'cat', breed: '英短', age: '12', weight: '4.5' },
        { petId: 'mock_002', name: '测试宠物2', type: 'dog', breed: '金毛', age: '24', weight: '8.2' }
      ]

      this.setData({ petList: mockPets })
    }
  },

  // 添加宠物
  addPet: function() {
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
        vaccineDate: '',
        dewormDate: ''
      }
    })
  },

  // 编辑宠物
  editPet: function(e) {
    var petId = e.currentTarget.dataset.petId
    var pet = null
    var i

    // ES5兼容的find操作
    for (i = 0; i < this.data.petList.length; i++) {
      if (this.data.petList[i].petId === petId) {
        pet = this.data.petList[i]
        break
      }
    }

    if (pet) {
      this.setData({
        showModal: true,
        isEdit: true,
        currentPetId: petId,
        formData: {
          name: pet.name,
          type: pet.type,
          breed: pet.breed,
          age: pet.age,
          weight: pet.weight,
          vaccineDate: pet.vaccineDate || '',
          dewormDate: pet.dewormDate || ''
        }
      })
    }
  },

  // 删除宠物
  deletePet: function(e) {
    var petId = e.currentTarget.dataset.petId
    var self = this

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这只宠物的信息吗？',
      success: function(res) {
        if (res.confirm) {
          // 删除逻辑（本地数据）- ES5兼容版本
          var newPetList = []
          var i
          for (i = 0; i < self.data.petList.length; i++) {
            if (self.data.petList[i].petId !== petId) {
              newPetList.push(self.data.petList[i])
            }
          }

          self.setData({ petList: newPetList })

          // 更新本地存储
          wx.setStorageSync('mock_pets', newPetList)

          wx.showToast({
            title: '删除成功',
            icon: 'success'
          })
        }
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
  onNameInput: function(e) { this.setData({ 'formData.name': e.detail.value }) },
  onBreedInput: function(e) { this.setData({ 'formData.breed': e.detail.value }) },
  onAgeInput: function(e) { this.setData({ 'formData.age': e.detail.value }) },
  onWeightInput: function(e) { this.setData({ 'formData.weight': e.detail.value }) },
  onVaccineDateChange: function(e) { this.setData({ 'formData.vaccineDate': e.detail.value }) },
  onDewormDateChange: function(e) { this.setData({ 'formData.dewormDate': e.detail.value }) },

  // 关闭弹窗
  closeModal: function() {
    this.setData({ showModal: false })
  },

  // 保存宠物（ES5兼容版本）
  savePet: function() {
    var name = this.data.formData.name
    var type = this.data.formData.type
    var age = this.data.formData.age

    // 验证必填项
    if (!name || !type || !age) {
      wx.showToast({
        title: '请填写必填项',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '保存中...' })

      var self = this

      // 创建新宠物对象 - ES5兼容版本
      var newPet = {
        petId: 'mock_' + Date.now(),
        name: this.data.formData.name,
        type: this.data.formData.type,
        breed: this.data.formData.breed,
        age: this.data.formData.age,
        weight: this.data.formData.weight,
        vaccineDate: this.data.formData.vaccineDate,
        dewormDate: this.data.formData.dewormDate,
        createdAt: new Date().toISOString()
      }

      // ES5兼容的数组复制
      var petList = this.data.petList.slice()

      if (this.data.isEdit) {
        // 编辑模式 - ES5兼容的findIndex
        var index = -1
        var i
        for (i = 0; i < petList.length; i++) {
          if (petList[i].petId === this.data.currentPetId) {
            index = i
            break
          }
        }

        if (index > -1) {
          petList[index] = newPet
        }
      } else {
        // 添加模式
        petList.push(newPet)
      }

      // 更新本地存储
      wx.setStorageSync('mock_pets', petList)

      this.setData({ petList: petList })

      wx.hideLoading()

      wx.showToast({
        title: this.data.isEdit ? '更新成功' : '添加成功',
        icon: 'success'
      })

      this.closeModal()

    } catch (error) {
      wx.hideLoading()
      console.error('保存宠物失败:', error)
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      })
    }
  }
})