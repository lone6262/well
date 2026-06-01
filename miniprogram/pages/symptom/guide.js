// 症状向导页面 - 全新设计逻辑
var app = getApp()

// 症状ID对照表（按文档要求使用英文ID）
var SYMPTOM_ID_MAP = {
  // 消化系统
  '呕吐': 'vomit',
  '腹泻': 'diarrhea',
  '便秘': 'constipation',
  '食欲不振': 'loss_appetite',
  // 呼吸系统
  '咳嗽': 'cough',
  '打喷嚏': 'sneeze',
  '呼吸困难': 'dyspnea',
  // 泌尿系统
  '尿频': 'frequent_urination',
  '尿血': 'hematuria',
  '排尿困难': 'difficulty_urination',
  // 皮肤问题
  '瘙痒': 'itch',
  '脱毛': 'hair_loss',
  '皮疹': 'redness',
  // 眼部症状
  '流泪': 'tearing',
  '眼睛红肿': 'eye_redness',
  // 耳部问题
  '耳垢多': 'ear_odor',
  '甩头抓耳': 'head_shake',
  // 神经行为
  '抽搐': 'seizure',
  '精神萎靡': 'lethargy',
  // 口腔问题
  '流口水': 'drool',
  '牙龈红肿': 'gum_redness'
}

// 带emoji图标的症状分类数据（使用英文ID）
var SYMPTOM_CATEGORIES = [
  {
    name: "消化系统",
    emoji: "🍽️",
    symptoms: [
      { name: "呕吐", id: "vomit", emoji: "🤮", selected: false },
      { name: "腹泻", id: "diarrhea", emoji: "💩", selected: false },
      { name: "便秘", id: "constipation", emoji: "🚫", selected: false },
      { name: "食欲不振", id: "loss_appetite", emoji: "🍽️", selected: false }
    ]
  },
  {
    name: "呼吸系统",
    emoji: "🫁",
    symptoms: [
      { name: "咳嗽", id: "cough", emoji: "😷", selected: false },
      { name: "打喷嚏", id: "sneeze", emoji: "🤧", selected: false },
      { name: "呼吸困难", id: "dyspnea", emoji: "😮", selected: false }
    ]
  },
  {
    name: "泌尿系统",
    emoji: "💧",
    symptoms: [
      { name: "尿频", id: "frequent_urination", emoji: "🚽", selected: false },
      { name: "尿血", id: "hematuria", emoji: "🩸", selected: false },
      { name: "排尿困难", id: "difficulty_urination", emoji: "😣", selected: false }
    ]
  },
  {
    name: "皮肤问题",
    emoji: "🧴",
    symptoms: [
      { name: "瘙痒", id: "itch", emoji: "🐕", selected: false },
      { name: "脱毛", id: "hair_loss", emoji: "🪮", selected: false },
      { name: "皮疹", id: "redness", emoji: "🔴", selected: false }
    ]
  },
  {
    name: "眼部症状",
    emoji: "👁️",
    symptoms: [
      { name: "流泪", id: "tearing", emoji: "😢", selected: false },
      { name: "眼睛红肿", id: "eye_redness", emoji: "👁️", selected: false }
    ]
  },
  {
    name: "耳部问题",
    emoji: "👂",
    symptoms: [
      { name: "耳垢多", id: "ear_odor", emoji: "👂", selected: false },
      { name: "甩头抓耳", id: "head_shake", emoji: "👂", selected: false }
    ]
  },
  {
    name: "神经行为",
    emoji: "🧠",
    symptoms: [
      { name: "抽搐", id: "seizure", emoji: "⚡", selected: false },
      { name: "精神萎靡", id: "lethargy", emoji: "😴", selected: false }
    ]
  },
  {
    name: "口腔问题",
    emoji: "🦷",
    symptoms: [
      { name: "流口水", id: "drool", emoji: "💧", selected: false },
      { name: "牙龈红肿", id: "gum_redness", emoji: "🦷", selected: false }
    ]
  }
]

Page({
  data: {
    currentStep: 1,
    petList: [],
    selectedPet: '',
    symptomCategories: SYMPTOM_CATEGORIES,
    selectedSymptoms: [], // 英文ID数组，用于提交
    selectedSymptomNames: [], // 中文名称数组，用于显示
    description: '',
    activeCategory: 0,
    duration: '',
    severity: '',
    canNext: false
  },

  // 计算分类选中数量
  calculateSelectedCount: function(categories) {
    return categories.map(function(category) {
      var selectedCount = category.symptoms.filter(function(s) {
        return s.selected
      }).length
      return Object.assign({}, category, {
        selectedCount: selectedCount
      })
    })
  },

  onLoad: function() {
    console.log('=== 症状自查页面加载 ===')
    this.initPage()
  },

  onShow: function() {
    // TabBar页面每次显示时检查宠物数据是否更新
    var self = this
    if (app.globalData.petsUpdated) {
      console.log('检测到宠物数据更新，重新加载')
      self.loadPetData()
      app.globalData.petsUpdated = false
    }
  },

  // === 页面初始化 ===
  initPage: function() {
    var self = this

    // 使用统一的登录状态检查方法
    if (!app.getOpenid()) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    // 初始化症状分类数据，添加选中数量
    var categoriesWithCount = this.calculateSelectedCount(SYMPTOM_CATEGORIES)

    this.setData({
      symptomCategories: categoriesWithCount
    })

    this.loadPetData()
  },

  // === 加载宠物数据 ===
  loadPetData: function() {
    var self = this

    var openid = app.getOpenid()

    // 登录检查
    if (!openid || (typeof openid === 'string' && openid.indexOf('mock_') === 0)) {
      console.log('用户未登录，提示登录')
      self.setData({ petList: [] })
      wx.showModal({
        title: '需要登录',
        content: '使用症状自查需要先登录，是否立即登录？',
        confirmText: '立即登录',
        cancelText: '稍后再说',
        success: function(res) {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/user/index' })
          }
        }
      })
      return
    }

    wx.cloud.callFunction({
      name: 'getPetList',
      data: {
        openid: openid
      },
      success: function(res) {
        if (res.result.code === 0 && res.result.data.petList && res.result.data.petList.length > 0) {
          // 格式化宠物数据
          var formattedPets = res.result.data.petList.map(function(pet) {
            return {
              id: pet.petId,
              name: pet.name,
              emoji: pet.type === 'cat' ? '🐱' : '🐶',
              age: pet.age + '个月',
              gender: pet.gender === 'male' ? '弟弟' : '妹妹'
            }
          })

          self.setData({
            petList: formattedPets
          })

          // 自动选择第一个宠物
          if (formattedPets.length > 0) {
            self.selectPetById(formattedPets[0].id)
          }
        } else {
          // 没有宠物时提示添加
          wx.showModal({
            title: '添加宠物',
            content: '还没有宠物档案，现在添加吗？',
            success: function(modalRes) {
              if (modalRes.confirm) {
                self.addNewPet()
              }
            }
          })
        }
      },
      fail: function() {
        wx.showToast({
          title: '数据加载失败',
          icon: 'none'
        })
      }
    })
  },

  // === 选择宠物 ===
  selectPet: function(e) {
    var petId = e.currentTarget.dataset.id
    this.selectPetById(petId)
  },

  selectPetById: function(petId) {
    this.setData({
      selectedPet: petId
    })
    this.updateCanNext()
  },

  // === 添加新宠物 ===
  addNewPet: function() {
    wx.navigateTo({
      url: '/pages/pet/profile?action=add'
    })
  },

  // === 切换症状分类 ===
  switchCategory: function(e) {
    var categoryIndex = parseInt(e.currentTarget.dataset.index)
    this.setData({
      activeCategory: categoryIndex
    })
  },

  // === 展开/收起分类 ===
  toggleCategory: function(e) {
    var categoryIndex = parseInt(e.currentTarget.dataset.index)
    var categories = this.data.symptomCategories

    categories[categoryIndex].expanded = !categories[categoryIndex].expanded

    this.setData({
      symptomCategories: categories
    })
  },

  // === 切换症状选择 ===
  toggleSymptom: function(e) {
    var categoryIndex = parseInt(e.currentTarget.dataset.categoryIndex)
    var symptomId = e.currentTarget.dataset.id

    console.log('=== 症状选择操作 ===')
    console.log('分类索引:', categoryIndex)
    console.log('症状ID:', symptomId)

    // 找到对应的症状并切换状态
    var categories = this.data.symptomCategories
    var targetSymptom = categories[categoryIndex].symptoms.find(function(s) {
      return s.id === symptomId
    })

    if (targetSymptom) {
      // 完全自由的多选：切换状态，不限制任何选择
      var newSelectedState = !targetSymptom.selected
      targetSymptom.selected = newSelectedState

      console.log('症状:', targetSymptom.name)
      console.log('选中状态:', newSelectedState)

      // 更新已选症状ID列表和名称列表
      var selectedSymptoms = [] // 英文ID用于提交
      var selectedSymptomNames = [] // 中文名称用于显示
      for (var i = 0; i < categories.length; i++) {
        for (var j = 0; j < categories[i].symptoms.length; j++) {
          if (categories[i].symptoms[j].selected) {
            selectedSymptoms.push(categories[i].symptoms[j].id)
            selectedSymptomNames.push(categories[i].symptoms[j].name)
          }
        }
      }

      console.log('所有已选症状ID:', selectedSymptoms)
      console.log('所有已选症状名称:', selectedSymptomNames)

      // 更新分类选中数量
      var updatedCategories = this.calculateSelectedCount(categories)

      this.setData({
        symptomCategories: updatedCategories,
        selectedSymptoms: selectedSymptoms,
        selectedSymptomNames: selectedSymptomNames
      })

      this.updateCanNext()

      // 触觉反馈
      wx.vibrateShort({
        success: function() {
          console.log('震动反馈成功')
        }
      })
    }
  },

  // === 移除已选症状 ===
  removeSymptom: function(e) {
    var symptomName = e.currentTarget.dataset.symptom
    var removeIndex = e.currentTarget.dataset.index

    // 找到对应的症状并取消选择
    var categories = this.data.symptomCategories
    var selectedSymptoms = this.data.selectedSymptoms
    var selectedSymptomNames = this.data.selectedSymptomNames

    for (var i = 0; i < categories.length; i++) {
      for (var j = 0; j < categories[i].symptoms.length; j++) {
        if (categories[i].symptoms[j].name === symptomName) {
          categories[i].symptoms[j].selected = false
        }
      }
    }

    // 从已选列表中移除（同时移除ID和名称）
    selectedSymptoms.splice(removeIndex, 1)
    selectedSymptomNames.splice(removeIndex, 1)

    // 更新分类选中数量
    var updatedCategories = this.calculateSelectedCount(categories)

    this.setData({
      symptomCategories: updatedCategories,
      selectedSymptoms: selectedSymptoms,
      selectedSymptomNames: selectedSymptomNames
    })

    this.updateCanNext()
  },

  // === 清空所有症状 ===
  clearAllSymptoms: function() {
    var self = this
    var categories = self.data.symptomCategories

    console.log('=== 清空所有症状选择 ===')

    // 清空所有选中状态
    for (var i = 0; i < categories.length; i++) {
      for (var j = 0; j < categories[i].symptoms.length; j++) {
        categories[i].symptoms[j].selected = false
      }
    }

    // 更新分类选中数量
    var updatedCategories = this.calculateSelectedCount(categories)

    self.setData({
      symptomCategories: updatedCategories,
      selectedSymptoms: [],
      selectedSymptomNames: []
    })

    self.updateCanNext()

    wx.showModal({
      title: '清空成功',
      content: '已清空所有症状选择，您可以重新选择',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // === 描述输入 ===
  onDescriptionInput: function(e) {
    var description = e.detail.value

    // 字数限制：≤ 100字
    if (description.length > 100) {
      wx.showToast({
        title: '描述不能超过100字',
        icon: 'none'
      })
      return
    }

    // 敏感词检查（使用统一配置模块）
    var sensitiveWords = require('../../config/sensitiveWords.js')
    var checkResult = sensitiveWords.checkSensitiveWords(description)
    if (checkResult.hasSensitive) {
      wx.showToast({
        title: checkResult.message,
        icon: 'none',
        duration: 2500
      })
      return
    }

    this.setData({
      description: description
    })
    this.updateCanNext()
  },

  // === 快速问答 ===
  selectDuration: function(e) {
    var value = e.currentTarget.dataset.value
    this.setData({
      duration: this.data.duration === value ? '' : value
    })
  },

  selectSeverity: function(e) {
    var value = e.currentTarget.dataset.value
    this.setData({
      severity: this.data.severity === value ? '' : value
    })
  },

  // === 更新下一步按钮状态 ===
  updateCanNext: function() {
    var canNext = false

    switch(this.data.currentStep) {
      case 1:
        canNext = !!this.data.selectedPet
        break
      case 2:
        canNext = this.data.selectedSymptoms.length > 0
        break
      case 3:
        canNext = this.data.description.trim().length > 0
        break
    }

    this.setData({
      canNext: canNext
    })
  },

  // === 导航控制 ===
  prevStep: function() {
    if (this.data.currentStep > 1) {
      this.setData({
        currentStep: this.data.currentStep - 1
      })
      this.updateCanNext()
    }
  },

  nextStep: function() {
    var self = this

    if (!this.data.canNext) {
      wx.showToast({
        title: '请完成当前步骤',
        icon: 'none'
      })
      return
    }

    if (self.data.currentStep < 3) {
      self.setData({
        currentStep: self.data.currentStep + 1
      })
      self.updateCanNext()
    } else {
      self.submitAssessment()
    }
  },

  // === 提交评估 ===
  submitAssessment: function() {
    var self = this

    console.log('=== 开始提交评估 ===')
    console.log('当前步骤:', self.data.currentStep)
    console.log('已选宠物:', self.data.selectedPet)
    console.log('已选症状数量:', self.data.selectedSymptoms.length)
    console.log('已选症状详情:', self.data.selectedSymptoms)
    console.log('症状分类数据:', self.data.symptomCategories)

    // 基础验证
    if (!self.data.selectedPet) {
      wx.showToast({
        title: '请先选择宠物',
        icon: 'none'
      })
      return
    }

    // 如果selectedSymptoms为空，尝试从symptomCategories中重新提取
    if (self.data.selectedSymptoms.length === 0) {
      console.log('检测到selectedSymptoms为空，尝试从symptomCategories中提取')

      var extractedSymptoms = []
      var extractedSymptomNames = []
      var categories = self.data.symptomCategories

      for (var i = 0; i < categories.length; i++) {
        for (var j = 0; j < categories[i].symptoms.length; j++) {
          if (categories[i].symptoms[j].selected) {
            extractedSymptoms.push(categories[i].symptoms[j].id)
            extractedSymptomNames.push(categories[i].symptoms[j].name)
          }
        }
      }

      console.log('重新提取的症状ID:', extractedSymptoms)
      console.log('重新提取的症状名称:', extractedSymptomNames)

      if (extractedSymptoms.length > 0) {
        // 如果从symptomCategories中提取到了症状，更新selectedSymptoms和selectedSymptomNames
        self.setData({
          selectedSymptoms: extractedSymptoms,
          selectedSymptomNames: extractedSymptomNames
        })
        console.log('已更新selectedSymptoms和selectedSymptomNames，继续提交')
      } else {
        // 如果确实没有选择症状，提示用户
        wx.showToast({
          title: '请至少选择一个症状',
          icon: 'none'
        })
        return
      }
    }

    // 使用统一的登录状态检查
    var openid = app.getOpenid()
    if (!openid) {
      wx.showModal({
        title: '请先登录',
        content: '需要登录后才能提交症状评估',
        confirmText: '去登录',
        cancelText: '取消',
        success: function(res) {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/user/index'
            })
          }
        }
      })
      return
    }

    console.log('开始提交症状评估，openid:', openid)

    var submitData = {
      openid: openid, // 用户标识
      petId: self.data.selectedPet,
      symptomIds: self.data.selectedSymptoms, // 英文ID数组，用于规则引擎
      symptomNames: self.data.selectedSymptomNames, // 中文名称数组，用于显示
      description: self.data.description
    }

    console.log('提交数据:', submitData)

    wx.showLoading({ title: '正在评估风险，请稍候...' })

    // 超时设置：5秒
    var timeout = setTimeout(function() {
      wx.hideLoading()
      wx.showToast({
        title: '网络繁忙，请重试',
        icon: 'none'
      })
    }, 5000)

    wx.cloud.callFunction({
      name: 'submitSymptom',
      data: submitData,
      success: function(res) {
        clearTimeout(timeout)
        wx.hideLoading()
        console.log('症状评估提交结果:', res.result)

        if (res.result.code === 0) {
          // 按照文档要求处理返回结果
          var data = res.result.data
          console.log('云函数返回数据:', data)

          // 根据action字段决定跳转行为
          if (data.action === 'emergency') {
            // 高风险：直接跳转急救通道
            try {
              wx.setStorageSync('fromRiskResult', true)
              wx.setStorageSync('riskLevel', 'high')
              wx.setStorageSync('petId', self.data.selectedPet)
            } catch (e) {
              console.error('存储参数失败:', e)
            }

            wx.showModal({
              title: '高风险警告',
              content: data.advice,
              showCancel: false,
              confirmText: '前往急救',
              success: function() {
                wx.switchTab({
                  url: '/pages/emergency/index'
                })
              }
            })
          } else {
            // 中/低风险：跳转到结果页面
            wx.navigateTo({
              url: '/pages/risk/result?assessmentId=' + data.recordId +
                    '&riskLevel=' + data.riskLevel +
                    '&petId=' + self.data.selectedPet
            })
          }
        } else {
          wx.showToast({
            title: res.result.msg || '提交失败',
            icon: 'none'
          })
        }
      },
      fail: function(err) {
        clearTimeout(timeout)
        wx.hideLoading()
        console.error('症状评估提交失败:', err)
        wx.showToast({
          title: '网络繁忙，请重试',
          icon: 'none'
        })
      }
    })
  },

  // === 返回 ===
  goBack: function() {
    wx.navigateBack({
      fail: function() {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    })
  }
})
