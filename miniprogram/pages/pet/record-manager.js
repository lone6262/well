// 宠物档案记录管理
const logger = require('../../utils/logger.js')
const log = logger.child('PetRecordManager')

function loadRecordCounts(pageCtx, app, petList) {
  if (!app.globalData.cloudDevelopmentAvailable || !petList || petList.length === 0) return

  const openid = app.getOpenid()
  if (!openid) return

  wx.cloud.callFunction({
    name: 'getRecordList',
    data: {
      token: app.globalData.token,
      page: 1,
      pageSize: 100
    },
    success: function(res) {
      if (res.result.code !== 0) return

      const records = res.result.data.records || []
      const counts = records.reduce(function(acc, record) {
        const pid = record.petId || record.pet_id
        if (!pid) return acc

        const recordCountMap = Object.assign({}, acc.recordCountMap, {
          [pid]: (acc.recordCountMap[pid] || 0) + 1
        })
        const reportCountMap = record.hasAiReport
          ? Object.assign({}, acc.reportCountMap, { [pid]: (acc.reportCountMap[pid] || 0) + 1 })
          : acc.reportCountMap

        return { recordCountMap: recordCountMap, reportCountMap: reportCountMap }
      }, { recordCountMap: {}, reportCountMap: {} })

      log.info('记录计数:', counts.recordCountMap, '报告计数:', counts.reportCountMap)

      const updatedList = petList.map(function(pet) {
        const pid = pet._id || pet.petId
        return Object.assign({}, pet, {
          recordCount: counts.recordCountMap[pid] || 0,
          reportCount: counts.reportCountMap[pid] || 0
        })
      })

      pageCtx.setData({ petList: updatedList })
    },
    fail: function(err) {
      log.error('加载记录计数失败:', err)
    }
  })
}

function createRecordList(records, petId, type) {
  let list = records
    .filter(function(record) {
      return record.petId === petId || record.pet_id === petId
    })
    .map(function(record) {
      const level = record.riskLevel || record.risk_level || 'low'
      const iconMap = { low: '✅', mid: '⚠️', high: '❌' }
      const bgMap = { low: '#E8F5E9', mid: '#FFF3E0', high: '#FFEBEE' }
      const levelText = { low: '低风险', mid: '中等风险', high: '高风险' }
      const symptomNames = record.symptoms || record.symptom_names || []
      const createdAt = record.createdAt || record.created_at || ''

      return {
        _id: record._id,
        icon: iconMap[level] || '✅',
        bgColor: bgMap[level] || '#E8F5E9',
        title: symptomNames.slice(0, 3).join('、') || '自查记录',
        desc: (typeof createdAt === 'string' ? createdAt.substring(0, 10) : '') + ' · ' + (levelText[level] || '低风险'),
        riskLevel: level,
        hasAiReport: record.hasAiReport || false,
        aiReportId: record.aiReportId || ''
      }
    })

  if (type === 'report') {
    list = list.filter(function(record) { return record.hasAiReport && record.aiReportId })
  }

  return list
}

function loadRecordsByPet(pageCtx, app, petId, petName, type) {
  if (!petId) {
    wx.showToast({ title: '宠物信息异常', icon: 'none' })
    return
  }

  pageCtx.setData({
    currentRecordPetId: petId,
    currentRecordType: type,
    showRecordModal: true,
    recordModalTitle: (type === 'record' ? '自查记录 - ' : '健康报告 - ') + petName,
    recordList: [],
    recordLoading: true
  })

  if (!app.globalData.cloudDevelopmentAvailable) {
    pageCtx.setData({ recordList: [], recordLoading: false })
    return
  }

  const openid = app.getOpenid()
  if (!openid) {
    pageCtx.setData({ recordList: [], recordLoading: false })
    return
  }

  wx.cloud.callFunction({
    name: 'getRecordList',
    data: {
      token: app.globalData.token,
      page: 1,
      pageSize: 50
    },
    success: function(res) {
      if (!res.result || res.result.code !== 0) {
        const message = res.result ? res.result.msg : '加载失败'
        log.error('获取记录失败:', message)
        pageCtx.setData({ recordList: [], recordLoading: false })
        wx.showToast({ title: message || '加载失败', icon: 'none' })
        return
      }

      const allRecords = (res.result.data && res.result.data.records) || []
      const list = createRecordList(allRecords, petId, type)
      log.info('筛选记录: 共', allRecords.length, '条, 匹配', list.length, '条, petId:', petId)
      pageCtx.setData({ recordList: list, recordLoading: false })
    },
    fail: function(err) {
      log.error('云函数调用失败:', err)
      pageCtx.setData({ recordList: [], recordLoading: false })
      wx.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
  })
}

function navigateToRecordDetail(recordList, currentRecordType, recordId) {
  if (!recordId) return

  const record = recordList.find(function(item) { return item._id === recordId })
  const riskLevel = record ? (record.riskLevel || 'low') : 'low'

  if (currentRecordType === 'report') {
    wx.navigateTo({ url: '/pages/ai-report/index?recordId=' + recordId })
    return
  }

  wx.navigateTo({
    url: '/pages/risk/result?assessmentId=' + recordId + '&riskLevel=' + riskLevel
  })
}

module.exports = {
  loadRecordCounts,
  loadRecordsByPet,
  navigateToRecordDetail,
  createRecordList
}
