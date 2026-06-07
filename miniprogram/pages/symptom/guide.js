// 症状向导页面 - 全新设计逻辑
let app = getApp()

// 症状ID对照表（按文档要求使用英文ID）
let SYMPTOM_ID_MAP = {
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
let SYMPTOM_CATEGORIES = [
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
      let selectedCount = category.symptoms.filter(function(s) {
        return s.selected
      }).length
      return Object.assign({}, category, {
        selectedCount: selectedCount
      })
    })
  },

  onLoad: function(options) {
    console.log('=== 症状自查页面加载 ===', options)
    // 支持从宠物档案页传入 petId 预选宠物
    if (options && options.petId) {
      this._preselectPetId = options.petId
    }
    this.initPage()
  },

  onShow: function() {
    let self = this
    console.log('症状自查页面 onShow，重置页面状态')

    // 重置页面状态，清除上一次的填写内容
    self.resetPageState()

    // 从宠物档案快速自查入口传入的预选宠物ID
    if (app.globalData._quickCheckPetId) {
      self._preselectPetId = app.globalData._quickCheckPetId
      app.globalData._quickCheckPetId = null
    }
    self.loadPetData()
    app.globalData.petsUpdated = false
  },

  // 重置页面状态
  resetPageState: function() {
    let self = this

    // 重置步骤到第一步
    self.setData({
      currentStep: 1,
      selectedPet: '',
      selectedSymptoms: [],
      selectedSymptomNames: [],
      description: '',
      duration: '',
      severity: '',
      canNext: false,
      activeCategory: 0
    })

    // 重置症状分类的选中状态
    let categories = self.data.symptomCategories
    for (let i = 0; i < categories.length; i++) {
      for (let j = 0; j < categories[i].symptoms.length; j++) {
        categories[i].symptoms[j].selected = false
      }
    }

    // 更新分类选中数量
    let updatedCategories = this.calculateSelectedCount(categories)
    self.setData({
      symptomCategories: updatedCategories
    })

    console.log('页面状态已重置')
  },

  // === 页面初始化 ===
  initPage: function() {
    let self = this

    // 使用统一的登录状态检查方法
    if (!app.getOpenid()) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    // 初始化症状分类数据，添加选中数量
    let categoriesWithCount = this.calculateSelectedCount(SYMPTOM_CATEGORIES)

    this.setData({
      symptomCategories: categoriesWithCount
    })

    this.loadPetData()
  },

  // === 加载宠物数据 ===
  loadPetData: function() {
    let self = this

    let openid = app.getOpenid()

    // 登录检查
    if (!openid || (typeof openid === 'string' && openid.indexOf('mock_') === 0)) {
      console.log('用户未登录，静默处理')
      self.setData({ petList: [] })
      return
    }

    wx.cloud.callFunction({
      name: 'getPetList',
      data: {
        token: app.globalData.token
      },
      success: function(res) {
        if (res.result.code === 0 && res.result.data.petList && res.result.data.petList.length > 0) {
          // 格式化宠物数据
          let formattedPets = res.result.data.petList.map(function(pet) {
            return {
              id: pet.petId,
              name: pet.name,
              emoji: pet.type === 'cat' ? '🐱' : '🐶',
              avatar: pet.avatar || '',
              age: pet.age + '个月',
              gender: pet.gender === 'male' ? '弟弟' : '妹妹'
            }
          })

          self.setData({
            petList: formattedPets
          })

          // 优先预选传入的宠物，否则选第一个
          if (formattedPets.length > 0) {
            var preselectId = self._preselectPetId
            if (preselectId) {
              self._preselectPetId = null
              var targetPet = formattedPets.find(function(p) { return p.id === preselectId })
              self.selectPetById(targetPet ? targetPet.id : formattedPets[0].id)
              // 快速自查：跳过宠物选择步骤，直接进入症状选择
              self.setData({ currentStep: 2 })
            } else {
              self.selectPetById(formattedPets[0].id)
            }
          }
        } else {
          // 没有宠物时静默处理，用户可通过「添加新宠物」入口主动添加
          console.log('暂无宠物档案')
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
    let petId = e.currentTarget.dataset.id
    this.selectPetById(petId)
  },

  selectPetById: function(petId) {
    // 切换宠物时清除旧症状缓存
    this.clearAllSymptoms()
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
    let categoryIndex = parseInt(e.currentTarget.dataset.index)
    this.setData({
      activeCategory: categoryIndex
    })
  },

  // === 展开/收起分类 ===
  toggleCategory: function(e) {
    let categoryIndex = parseInt(e.currentTarget.dataset.index)
    let categories = this.data.symptomCategories

    categories[categoryIndex].expanded = !categories[categoryIndex].expanded

    this.setData({
      symptomCategories: categories
    })
  },

  // === 切换症状选择 ===
  toggleSymptom: function(e) {
    let categoryIndex = parseInt(e.currentTarget.dataset.categoryIndex)
    let symptomId = e.currentTarget.dataset.id

    console.log('=== 症状选择操作 ===')
    console.log('分类索引:', categoryIndex)
    console.log('症状ID:', symptomId)

    // 找到对应的症状并切换状态
    let categories = this.data.symptomCategories
    let targetSymptom = categories[categoryIndex].symptoms.find(function(s) {
      return s.id === symptomId
    })

    if (targetSymptom) {
      // 完全自由的多选：切换状态，不限制任何选择
      let newSelectedState = !targetSymptom.selected
      targetSymptom.selected = newSelectedState

      console.log('症状:', targetSymptom.name)
      console.log('选中状态:', newSelectedState)

      // 更新已选症状ID列表和名称列表
      let selectedSymptoms = [] // 英文ID用于提交
      let selectedSymptomNames = [] // 中文名称用于显示
      for (let i = 0; i < categories.length; i++) {
        for (let j = 0; j < categories[i].symptoms.length; j++) {
          if (categories[i].symptoms[j].selected) {
            selectedSymptoms.push(categories[i].symptoms[j].id)
            selectedSymptomNames.push(categories[i].symptoms[j].name)
          }
        }
      }

      console.log('所有已选症状ID:', selectedSymptoms)
      console.log('所有已选症状名称:', selectedSymptomNames)

      // 更新分类选中数量
      let updatedCategories = this.calculateSelectedCount(categories)

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
    let symptomName = e.currentTarget.dataset.symptom
    let removeIndex = e.currentTarget.dataset.index

    // 找到对应的症状并取消选择
    let categories = this.data.symptomCategories
    let selectedSymptoms = this.data.selectedSymptoms
    let selectedSymptomNames = this.data.selectedSymptomNames

    for (let i = 0; i < categories.length; i++) {
      for (let j = 0; j < categories[i].symptoms.length; j++) {
        if (categories[i].symptoms[j].name === symptomName) {
          categories[i].symptoms[j].selected = false
        }
      }
    }

    // 从已选列表中移除（同时移除ID和名称）
    selectedSymptoms.splice(removeIndex, 1)
    selectedSymptomNames.splice(removeIndex, 1)

    // 更新分类选中数量
    let updatedCategories = this.calculateSelectedCount(categories)

    this.setData({
      symptomCategories: updatedCategories,
      selectedSymptoms: selectedSymptoms,
      selectedSymptomNames: selectedSymptomNames
    })

    this.updateCanNext()
  },

  // === 清空所有症状 ===
  clearAllSymptoms: function() {
    let self = this
    let categories = self.data.symptomCategories

    console.log('=== 清空所有症状选择 ===')

    // 清空所有选中状态
    for (let i = 0; i < categories.length; i++) {
      for (let j = 0; j < categories[i].symptoms.length; j++) {
        categories[i].symptoms[j].selected = false
      }
    }

    // 更新分类选中数量
    let updatedCategories = this.calculateSelectedCount(categories)

    self.setData({
      symptomCategories: updatedCategories,
      selectedSymptoms: [],
      selectedSymptomNames: []
    })

    self.updateCanNext()
  },

  // === 描述输入 ===
  onDescriptionInput: function(e) {
    let description = e.detail.value

    // 字数限制：≤ 100字
    if (description.length > 100) {
      wx.showToast({
        title: '描述不能超过100字',
        icon: 'none'
      })
      return
    }

    // 敏感词检查（使用统一配置模块）
    let sensitiveWords = require('../../config/sensitiveWords.js')
    let checkResult = sensitiveWords.checkSensitiveWords(description)
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
    let value = e.currentTarget.dataset.value
    this.setData({
      duration: this.data.duration === value ? '' : value
    })
  },

  selectSeverity: function(e) {
    let value = e.currentTarget.dataset.value
    this.setData({
      severity: this.data.severity === value ? '' : value
    })
  },

  // === 更新下一步按钮状态 ===
  updateCanNext: function() {
    let canNext = false

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
    let self = this

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
    let self = this

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

      let extractedSymptoms = []
      let extractedSymptomNames = []
      let categories = self.data.symptomCategories

      for (let i = 0; i < categories.length; i++) {
        for (let j = 0; j < categories[i].symptoms.length; j++) {
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
    let openid = app.getOpenid()
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

    console.log('开始提交症状评估')

    let submitData = {
      petId: self.data.selectedPet,
      symptomIds: self.data.selectedSymptoms, // 英文ID数组，用于规则引擎
      symptomNames: self.data.selectedSymptomNames, // 中文名称数组，用于显示
      description: self.data.description,
      token: app.globalData.token || ''
    }

    console.log('提交数据:', submitData)

    wx.showLoading({ title: '正在评估风险，请稍候...' })

    // 超时设置：5秒
    let timeout = setTimeout(function() {
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
          let data = res.result.data
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
