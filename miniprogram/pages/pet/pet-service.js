// 宠物档案数据服务
const logger = require('../../utils/logger.js')
const log = logger.child('PetService')
const petMapper = require('../../utils/pet-mapper.js')

function isMockOpenid(openid) {
  return !openid || (typeof openid === 'string' && openid.indexOf('mock_') === 0)
}

function createDemoPets() {
  return [
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
}

function loadLocalMockData(pageCtx) {
  log.info('使用本地模拟数据')
  const localPets = wx.getStorageSync('localPets') || []

  if (localPets.length > 0) {
    log.info('从本地存储加载宠物数据:', localPets)
    pageCtx.setData({
      petList: petMapper.mapPetListFromCloud(localPets),
      loading: false
    })

    wx.showToast({ title: '本地模式（已保存数据）', icon: 'none', duration: 1500 })
    return
  }

  log.warn('本地存储为空，使用演示数据')
  pageCtx.setData({ petList: createDemoPets(), loading: false })
  wx.showToast({ title: '本地模式（演示数据）', icon: 'none', duration: 2000 })
}

function loadPetList(pageCtx, app, options) {
  const openid = app.getOpenid()

  if (isMockOpenid(openid)) {
    log.info('用户未登录，引导登录')
    pageCtx.setData({ petList: [], loading: false })
    options.requireLogin()
    return
  }

  log.info('从数据库加载宠物列表...', openid)

  if (!app.globalData.cloudDevelopmentAvailable) {
    log.warn('云开发不可用，使用本地模拟数据')
    loadLocalMockData(pageCtx)
    return
  }

  if (!app.globalData.token) {
    log.info('Token未就绪，等待静默登录完成...')
    app.onLoginComplete(function() {
      loadPetList(pageCtx, app, options)
    })
    return
  }

  wx.cloud.callFunction({
    name: 'getPetList',
    data: { token: app.globalData.token },
    success: function(res) {
      log.info('宠物列表加载成功:', res.result)

      if (res.result.code !== 0) {
        log.error('宠物列表加载失败:', res.result.msg)
        pageCtx.setData({ petList: [], loading: false })
        wx.showToast({ title: res.result.msg || '加载失败', icon: 'none' })
        return
      }

      const petList = petMapper.mapPetListFromCloud(res.result.data.petList || [])
      log.info('数据映射完成，petList:', petList)

      pageCtx.setData({ petList: petList, loading: false })

      if (petList.length === 0) {
        options.showEmptyState()
      }

      options.loadRecordCounts(petList)

      if (pageCtx.autoEditPetId) {
        log.info('宠物列表加载完成，准备自动打开编辑弹窗')
        setTimeout(function() {
          options.autoOpenEditModal(pageCtx.autoEditPetId)
          pageCtx.autoEditPetId = null
        }, 300)
      }
    },
    fail: function(err) {
      log.error('宠物列表加载失败:', err)
      app.globalData.cloudDevelopmentAvailable = false
      log.warn('云函数调用失败，切换到本地模式')
      loadLocalMockData(pageCtx)
    }
  })
}

function savePet(pageCtx, app, submitData, fallbackFormData, callbacks) {
  if (!app.globalData.cloudDevelopmentAvailable) {
    log.warn('云开发不可用，使用本地存储')
    saveToLocalStorage(pageCtx, app, fallbackFormData, callbacks)
    return
  }

  wx.cloud.callFunction({
    name: 'savePet',
    data: submitData,
    success: function(res) {
      log.info('宠物保存成功:', res.result)
      wx.hideLoading()

      if (res.result.code !== 0) {
        wx.showToast({ title: res.result.msg || '保存失败', icon: 'none' })
        return
      }

      wx.showToast({
        title: pageCtx.data.isEdit ? '修改成功' : '添加成功',
        icon: 'success'
      })
      callbacks.afterSave()
      app.globalData.petsUpdated = true
    },
    fail: function(err) {
      log.error('宠物保存失败:', err)
      wx.hideLoading()
      log.warn('云函数调用失败，尝试本地存储')
      app.globalData.cloudDevelopmentAvailable = false
      saveToLocalStorage(pageCtx, app, fallbackFormData, callbacks)
    }
  })
}

function createLocalPetData(formData, petId, petCodeVal) {
  return {
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
}

function buildNextPetCode(localPets, type) {
  const typePrefix = type === 'cat' ? 'CAT' : 'DOG'
  const existingCodes = localPets
    .filter(function(p) { return p.petCode && p.petCode.startsWith(typePrefix) })
    .map(function(p) { return parseInt(p.petCode.split('-')[1]) })
  existingCodes.sort(function(a, b) { return b - a })
  const nextNum = existingCodes.length > 0 ? existingCodes[0] + 1 : 1
  return typePrefix + '-' + String(nextNum).padStart(3, '0')
}

function saveToLocalStorage(pageCtx, app, formData, callbacks) {
  log.info('保存宠物到本地存储')

  const petId = pageCtx.data.isEdit ? pageCtx.data.currentPetId : 'local_pet_' + Date.now()
  const localPets = wx.getStorageSync('localPets') || []
  const petData = createLocalPetData(formData, petId, buildNextPetCode(localPets, formData.type))
  const nextPets = pageCtx.data.isEdit
    ? localPets.map(function(p) {
      return (p._id === petId || p.petId === petId) ? petData : p
    })
    : localPets.concat([petData])

  wx.setStorageSync('localPets', nextPets)
  wx.hideLoading()
  wx.showToast({ title: '保存成功（本地模式）', icon: 'success' })
  callbacks.afterSave()
  app.globalData.petsUpdated = true
  log.info('宠物数据已保存到本地存储')
}

function deletePet(pageCtx, app, petId, callbacks) {
  log.info('开始删除宠物流程，petId:', petId)
  log.info('云开发状态:', app.globalData.cloudDevelopmentAvailable)

  wx.showLoading({ title: '删除中...', mask: true })

  if (!app.globalData.cloudDevelopmentAvailable) {
    log.warn('云开发不可用，使用本地存储删除')
    deleteFromLocalStorage(pageCtx, app, petId, callbacks)
    return
  }

  log.info('准备调用deletePet云函数，petId:', petId)
  wx.cloud.callFunction({
    name: 'deletePet',
    data: { petId: petId, token: app.globalData.token },
    success: function(res) {
      log.info('deletePet云函数调用成功:', res.result)
      wx.hideLoading()

      if (res.result.code !== 0) {
        log.error('删除失败，服务器返回错误:', res.result.msg)
        wx.showToast({ title: res.result.msg || '删除失败', icon: 'none' })
        return
      }

      wx.showToast({ title: '删除成功', icon: 'success' })
      callbacks.afterDelete()
      app.globalData.petsUpdated = true
    },
    fail: function(err) {
      log.error('deletePet云函数调用失败:', err)
      wx.hideLoading()
      log.warn('云函数调用失败，尝试本地存储删除')
      app.globalData.cloudDevelopmentAvailable = false
      deleteFromLocalStorage(pageCtx, app, petId, callbacks)
    }
  })
}

function deleteFromLocalStorage(pageCtx, app, petId, callbacks) {
  log.info('从本地存储删除宠物，petId:', petId)
  const localPets = wx.getStorageSync('localPets') || []
  log.info('当前本地存储宠物列表:', localPets)

  const nextPets = localPets.filter(function(p) {
    log.info('检查宠物:', p._id, '===', petId, '?', p._id !== petId && p.petId !== petId)
    return p._id !== petId && p.petId !== petId
  })

  if (nextPets.length >= localPets.length) {
    log.error('未找到对应的宠物信息，petId:', petId)
    wx.hideLoading()
    wx.showToast({ title: '未找到宠物信息', icon: 'none' })
    return
  }

  log.info('找到并删除宠物，更新本地存储')
  wx.setStorageSync('localPets', nextPets)
  wx.hideLoading()
  wx.showToast({ title: '删除成功（本地模式）', icon: 'success' })
  callbacks.afterDelete()
  app.globalData.petsUpdated = true
  log.info('宠物已从本地存储删除')
}

module.exports = {
  loadPetList,
  loadLocalMockData,
  savePet,
  saveToLocalStorage,
  deletePet,
  deleteFromLocalStorage
}
