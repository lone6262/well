// 宠物档案页面逻辑 — 数据库版本 + 图片上传
const logger = require('../../utils/logger.js')
const log = logger.child('PetProfile')
const petService = require('./pet-service.js')
const formHandler = require('./form-handler.js')
const recordManager = require('./record-manager.js')
const imageUpload = require('../../utils/imageUpload.js')
let app = getApp()

Page({
  data: {
    petList: [],
    showModal: false,
    isEdit: false,
    currentPetId: '',
    formData: formHandler.createDefaultFormData(),
    formErrors: {},
    focusedField: '',
    showRecordModal: false,
    recordModalTitle: '',
    recordList: [],
    currentRecordPetId: '',
    currentRecordType: '',
    recordLoading: false,
    loading: true,
    uploadingImage: false,
    avatarPreview: ''
  },

  onLoad: function(options) {
    log.info('宠物档案页面加载', options)
    wx.removeStorageSync('localPets')

    if (options) {
      log.info('URL参数:', options)
      if (options.action === 'add') {
        this._skipEmptyState = true
        log.info('检测到添加请求，将直接打开添加表单')
      }

      if (options.action === 'edit' && options.petId) {
        this.autoEditPetId = options.petId
        log.info('检测到自动编辑请求，宠物ID:', options.petId)
      }
    }

    this.loadPetList()
  },

  onShow: function() {
    this.loadPetList()
  },

  loadPetList: function() {
    petService.loadPetList(this, app, {
      requireLogin: this._requireLogin.bind(this),
      showEmptyState: this.showEmptyState.bind(this),
      loadRecordCounts: this.loadRecordCounts.bind(this),
      autoOpenEditModal: this.autoOpenEditModal.bind(this)
    })
  },

  loadLocalMockData: function() {
    petService.loadLocalMockData(this)
  },

  showEmptyState: function() {
    if (this._skipEmptyState) {
      this._skipEmptyState = false
      this._emptyStateShown = true
      this.showAddModal()
      return
    }

    if (this._emptyStateShown || this.data.showModal) return
    this._emptyStateShown = true
    wx.showModal({
      title: '宠物档案',
      content: '还没有添加宠物，是否现在添加？',
      confirmText: '立即添加',
      cancelText: '稍后再说',
      success: function(res) {
        if (res.confirm) {
          this.showAddModal()
        } else {
          this._emptyStateShown = false
        }
      }.bind(this)
    })
  },

  showAddModal: function() {
    if (!this._ensureLoggedIn()) return

    this._emptyStateShown = false
    this.setData({
      showModal: true,
      isEdit: false,
      currentPetId: '',
      formData: formHandler.createDefaultFormData(),
      formErrors: {},
      focusedField: '',
      avatarPreview: ''
    })
  },

  addPet: function() {
    this.showAddModal()
  },

  showEditModal: function(e) {
    this._openEditModal(e.currentTarget.dataset.petId)
  },

  editPet: function(e) {
    this._openEditModal(e.currentTarget.dataset.petId)
  },

  _openEditModal: function(petId) {
    const pet = this._findPetById(petId)

    if (!pet) {
      wx.showToast({ title: '宠物信息不存在', icon: 'none' })
      return
    }

    this.setData({
      showModal: true,
      isEdit: true,
      currentPetId: petId,
      formData: formHandler.buildFormDataFromPet(pet),
      formErrors: {},
      focusedField: '',
      avatarPreview: pet.avatar || ''
    })
  },

  hideModal: function() {
    this._emptyStateShown = false
    this.setData({
      showModal: false,
      isEdit: false,
      currentPetId: '',
      avatarPreview: '',
      formData: formHandler.createDefaultFormData(),
      formErrors: {},
      focusedField: ''
    })
  },

  _ensureLoggedIn: function() {
    const openid = app.getOpenid()
    if (!openid || (typeof openid === 'string' && openid.indexOf('mock_') === 0)) {
      this._requireLogin()
      return false
    }
    return true
  },

  _requireLogin: function() {
    const self = this
    wx.showModal({
      title: '需要登录',
      content: '添加宠物需要先登录，是否立即登录？',
      confirmText: '立即登录',
      cancelText: '稍后再说',
      success: function(res) {
        if (res.confirm) self._doLogin()
      }
    })
  },

  _doLogin: function() {
    const self = this
    wx.showLoading({ title: '登录中...', mask: true })
    wx.removeStorageSync('mockOpenid')
    app.globalData.openid = null
    app.silentLogin()

    app.onLoginComplete(function(openid) {
      wx.hideLoading()

      if (openid && typeof openid === 'string' && openid.indexOf('mock_') !== 0) {
        log.info('登录成功，直接打开添加宠物表单')
        wx.showToast({ title: '登录成功', icon: 'success' })
        self.showAddModal()
        return
      }

      log.info('登录失败')
      wx.showModal({
        title: '登录失败',
        content: '登录未成功，请稍后重试或检查网络连接',
        showCancel: false
      })
    })
  },

  // === 表单输入处理 ===

  selectType: function(e) {
    const newType = e.currentTarget.dataset.type
    formHandler.setFormField(this, 'type', newType)
    this._clearFieldError('type')
  },

  onNameInput: function(e) {
    formHandler.setFormField(this, 'name', e.detail.value)
    if (this.data.formErrors.name) {
      this._clearFieldError('name')
    }
  },

  onTypeChange: function(e) {
    formHandler.setFormField(this, 'type', e.detail.value)
  },

  onBreedInput: function(e) {
    formHandler.setFormField(this, 'breed', e.detail.value)
  },

  onAgeInput: function(e) {
    formHandler.setFormField(this, 'age', e.detail.value)
    if (this.data.formErrors.age) {
      this._clearFieldError('age')
    }
  },

  onWeightInput: function(e) {
    formHandler.setFormField(this, 'weight', e.detail.value)
  },

  onInputFocus: function(e) {
    const field = e.currentTarget.dataset.field
    if (field) {
      this.setData({ focusedField: field })
    }
  },

  onInputBlur: function(e) {
    const field = e.currentTarget.dataset.field
    if (field && this.data.focusedField === field) {
      this.setData({ focusedField: '' })
    }
    // 失焦时实时校验当前字段
    if (field) {
      this._validateField(field, e.detail.value)
    }
  },

  onGenderChange: function(e) {
    formHandler.setFormField(this, 'gender', e.currentTarget.dataset.value)
  },

  onVaccineDateChange: function(e) {
    formHandler.setFormField(this, 'vaccineDate', e.detail.value)
  },

  onDewormDateChange: function(e) {
    formHandler.setFormField(this, 'dewormDate', e.detail.value)
  },

  /** 清除单个输入框 */
  clearField: function(e) {
    const field = e.currentTarget.dataset.field
    if (!field) return

    const updates = {}
    updates['formData.' + field] = ''
    // 如果是名字字段还清除错误
    if (field === 'name' || field === 'age') {
      updates['formErrors.' + field] = ''
    }
    this.setData(updates)
  },

  /** 快捷日期选择 */
  setQuickDate: function(e) {
    const field = e.currentTarget.dataset.field
    const offsetDays = parseInt(e.currentTarget.dataset.offset, 10)
    const date = new Date()
    date.setDate(date.getDate() + offsetDays)

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = year + '-' + month + '-' + day

    formHandler.setFormField(this, field, dateStr)
  },

  // === 字段级校验 ===

  _validateField: function(field, value) {
    const errors = Object.assign({}, this.data.formErrors)
    let hasError = false

    if (field === 'name') {
      if (!value || !value.trim()) {
        errors.name = '请输入宠物昵称'
        hasError = true
      } else if (value.trim().length > 20) {
        errors.name = '昵称不超过20个字'
        hasError = true
      } else {
        delete errors.name
      }
    }

    if (field === 'age') {
      if (!value) {
        errors.age = '请输入年龄'
        hasError = true
      } else if (isNaN(parseFloat(value)) || parseFloat(value) < 0) {
        errors.age = '请输入有效数字'
        hasError = true
      } else if (parseFloat(value) > 360) {
        errors.age = '年龄不太合理'
        hasError = true
      } else {
        delete errors.age
      }
    }

    if (field === 'weight') {
      if (value && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
        errors.weight = '请输入有效数字'
        hasError = true
      } else {
        delete errors.weight
      }
    }

    this.setData({ formErrors: errors })
    return !hasError
  },

  _clearFieldError: function(field) {
    if (this.data.formErrors[field]) {
      const errors = Object.assign({}, this.data.formErrors)
      delete errors[field]
      this.setData({ formErrors: errors })
    }
  },

  // === 保存 ===

  savePet: function() {
    const formData = this.data.formData
    const validation = formHandler.validatePetForm(formData)

    if (!validation.valid) {
      // 映射到字段级错误
      const errors = {}
      if (!formData.name || !formData.name.trim()) {
        errors.name = '请输入宠物昵称'
      }
      if (!formData.age) {
        errors.age = '请输入年龄'
      } else if (isNaN(parseFloat(formData.age))) {
        errors.age = '请输入有效数字'
      }
      this.setData({ formErrors: errors })
      wx.showToast({ title: validation.message, icon: 'none' })
      return
    }

    log.info('保存宠物信息:', formData)
    wx.showLoading({ title: '保存中...', mask: true })

    petService.savePet(
      this,
      app,
      formHandler.buildSubmitData(formData, {
        isEdit: this.data.isEdit,
        petId: this.data.currentPetId,
        token: app.globalData.token || ''
      }),
      formData,
      { afterSave: this._afterPetChanged.bind(this) }
    )
  },

  saveToLocalStorage: function(formData) {
    petService.saveToLocalStorage(this, app, formData, {
      afterSave: this._afterPetChanged.bind(this)
    })
  },

  // === 删除 ===

  deletePet: function(e) {
    const petId = e.currentTarget.dataset.petId
    log.info('删除按钮点击，宠物ID:', petId)

    if (!petId) {
      log.error('petId为空')
      wx.showToast({ title: '宠物ID获取失败', icon: 'none' })
      return
    }

    const pet = this._findPetById(petId)
    if (!pet) {
      log.error('未找到宠物信息，petId:', petId)
      wx.showToast({ title: '宠物信息不存在', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除「' + pet.name + '」的信息吗？',
      confirmText: '删除',
      confirmColor: '#ff0000',
      success: function(res) {
        if (res.confirm) this.confirmDeletePet(petId)
      }.bind(this)
    })
  },

  confirmDeletePet: function(petId) {
    petService.deletePet(this, app, petId, {
      afterDelete: this._afterPetChanged.bind(this)
    })
  },

  deleteFromLocalStorage: function(petId) {
    petService.deleteFromLocalStorage(this, app, petId, {
      afterDelete: this._afterPetChanged.bind(this)
    })
  },

  // === 头像 ===

  chooseAvatar: function() {
    formHandler.chooseAvatar(this, imageUpload)
  },

  removeAvatar: function() {
    formHandler.removeAvatar(this, imageUpload)
  },

  previewAvatar: function() {
    formHandler.previewAvatar(this)
  },

  // === 自动编辑 ===

  autoOpenEditModal: function(petId) {
    log.info('准备自动打开编辑弹窗，宠物ID:', petId)
    const pet = this._findPetById(petId)

    if (!pet) {
      log.error('未找到对应的宠物信息，宠物ID:', petId)
      wx.showToast({ title: '未找到宠物信息', icon: 'none' })
      return
    }

    log.info('找到宠物信息，自动打开编辑弹窗:', pet)
    this.setData({
      showModal: true,
      isEdit: true,
      currentPetId: pet._id || pet.petId,
      formData: formHandler.buildFormDataFromPet(pet),
      formErrors: {},
      focusedField: '',
      avatarPreview: pet.avatar || ''
    })

    wx.showToast({
      title: '正在编辑' + pet.name,
      icon: 'success',
      duration: 1500
    })
  },

  // === 记录 ===

  quickCheck: function(e) {
    const petId = e.currentTarget.dataset.petId
    const petName = e.currentTarget.dataset.petName
    log.info('快速自查，petId:', petId, 'petName:', petName)
    app.globalData._quickCheckPetId = petId
    wx.switchTab({ url: '/pages/symptom/guide' })
  },

  showPetRecords: function(e) {
    const petId = e.currentTarget.dataset.petId
    const petName = e.currentTarget.dataset.petName
    log.info('点击自查记录，petId:', petId, 'petName:', petName)
    this.loadRecordsByPet(petId, petName, 'record')
  },

  showPetReports: function(e) {
    const petId = e.currentTarget.dataset.petId
    const petName = e.currentTarget.dataset.petName
    log.info('点击健康报告，petId:', petId, 'petName:', petName)
    this.loadRecordsByPet(petId, petName, 'report')
  },

  loadRecordCounts: function(petList) {
    recordManager.loadRecordCounts(this, app, petList)
  },

  loadRecordsByPet: function(petId, petName, type) {
    recordManager.loadRecordsByPet(this, app, petId, petName, type)
  },

  hideRecordModal: function() {
    this.setData({ showRecordModal: false })
  },

  viewRecordDetail: function(e) {
    recordManager.navigateToRecordDetail(
      this.data.recordList,
      this.data.currentRecordType,
      e.currentTarget.dataset.recordId
    )
  },

  // === 内部方法 ===

  _findPetById: function(petId) {
    return this.data.petList.find(function(pet) {
      return pet._id === petId || pet.petId === petId
    })
  },

  _afterPetChanged: function() {
    this.hideModal()
    this.loadPetList()
  }
})
