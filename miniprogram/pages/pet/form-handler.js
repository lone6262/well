// 宠物档案表单处理
const logger = require('../../utils/logger.js')
const log = logger.child('PetFormHandler')

function createDefaultFormData() {
  return {
    name: '',
    type: 'cat',
    breed: '',
    age: '',
    weight: '',
    gender: 'male',
    vaccineDate: '',
    dewormDate: '',
    avatar: '',
    personalityTags: []
  }
}

function buildFormDataFromPet(pet) {
  return {
    name: pet.name || '',
    type: pet.type || 'cat',
    breed: pet.breed || '',
    age: pet.age || '',
    weight: pet.weight || '',
    gender: pet.gender || 'male',
    vaccineDate: pet.vaccineDate || '',
    dewormDate: pet.dewormDate || '',
    avatar: pet.avatar || '',
    personalityTags: pet.personalityTags || pet.personality_tags || []
  }
}

function validatePetForm(formData) {
  var errors = []

  if (!formData.name || !formData.name.trim()) {
    errors.push('name')
  }

  if (!formData.type) {
    errors.push('type')
  }

  if (!formData.age) {
    errors.push('age')
  } else if (isNaN(parseFloat(formData.age)) || parseFloat(formData.age) < 0) {
    errors.push('age')
  } else if (parseFloat(formData.age) > 360) {
    errors.push('age')
  }

  if (formData.weight && (isNaN(parseFloat(formData.weight)) || parseFloat(formData.weight) < 0)) {
    errors.push('weight')
  }

  if (errors.length === 0) {
    return { valid: true, message: '', errors: [] }
  }

  var firstError = '请填写必填项'
  if (errors.indexOf('name') !== -1) firstError = '请输入宠物昵称'
  else if (errors.indexOf('age') !== -1) firstError = '请输入有效年龄'
  else if (errors.indexOf('weight') !== -1) firstError = '请输入有效体重'

  return { valid: false, message: firstError, errors: errors }
}

function buildSubmitData(formData, options) {
  const submitData = {
    name: formData.name,
    type: formData.type,
    breed: formData.breed || '',
    age: parseFloat(formData.age),
    weight: formData.weight ? parseFloat(formData.weight) : 0,
    gender: formData.gender,
    vaccineDate: formData.vaccineDate || '',
    dewormDate: formData.dewormDate || '',
    avatar: formData.avatar || '',
    personality_tags: Array.isArray(formData.personalityTags) ? formData.personalityTags.slice(0, 2) : [],
    token: options.token || ''
  }

  if (options.isEdit) {
    return Object.assign({}, submitData, { petId: options.petId })
  }

  return submitData
}

function setFormField(pageCtx, fieldName, value) {
  pageCtx.setData({
    ['formData.' + fieldName]: value
  })
}

function getAvatarUploadErrorMessage(error) {
  if (error.code === 'INVALID_FORMAT') return '不支持的图片格式'
  if (error.code === 'FILE_TOO_LARGE') return '图片过大，请选择5MB以内的图片'
  if (error.code === 'INVALID_DIMENSIONS') return error.message
  if (error.code === 'CHOOSE_IMAGE_ERROR') return '选择图片失败'
  return '上传失败'
}

function chooseAvatar(pageCtx, imageUpload) {
  pageCtx.setData({ uploadingImage: true })

  const tempId = pageCtx.data.currentPetId || 'temp_' + Date.now()
  log.info('开始选择并上传宠物头像, tempId:', tempId)

  imageUpload.selectAndUpload(tempId)
    .then(function(cloudURL) {
      log.info('头像上传成功:', cloudURL)
      pageCtx.setData({
        'formData.avatar': cloudURL,
        avatarPreview: cloudURL,
        uploadingImage: false
      })

      wx.showToast({ title: '头像上传成功', icon: 'success' })
    })
    .catch(function(error) {
      log.error('头像上传失败:', error)
      pageCtx.setData({ uploadingImage: false })
      wx.showToast({
        title: getAvatarUploadErrorMessage(error),
        icon: 'none',
        duration: 2000
      })
    })
}

function removeAvatar(pageCtx, imageUpload) {
  if (!pageCtx.data.formData.avatar) return

  wx.showModal({
    title: '删除头像',
    content: '确定要删除当前头像吗？',
    success: function(res) {
      if (!res.confirm) return

      if (pageCtx.data.formData.avatar.startsWith('cloud://')) {
        imageUpload.deleteFromCloud(pageCtx.data.formData.avatar)
          .then(function() {
            log.info('云存储头像删除成功')
          })
          .catch(function(err) {
            log.error('云存储头像删除失败:', err)
          })
      }

      pageCtx.setData({
        'formData.avatar': '',
        avatarPreview: ''
      })

      wx.showToast({ title: '头像已删除', icon: 'success' })
    }
  })
}

function previewAvatar(pageCtx) {
  if (!pageCtx.data.avatarPreview) return

  wx.previewImage({
    urls: [pageCtx.data.avatarPreview],
    current: pageCtx.data.avatarPreview
  })
}

module.exports = {
  createDefaultFormData,
  buildFormDataFromPet,
  validatePetForm,
  buildSubmitData,
  setFormField,
  chooseAvatar,
  removeAvatar,
  previewAvatar
}
