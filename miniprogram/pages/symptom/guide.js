// 症状向导页面 - 全新设计逻辑
var app = getApp()

// 带emoji图标的症状分类数据
var SYMPTOM_CATEGORIES = [
  {
    name: "消化系统",
    emoji: "🍽️",
    symptoms: [
      { name: "呕吐", key: "呕吐", emoji: "🤮", selected: false },
      { name: "腹泻", key: "腹泻", emoji: "💩", selected: false },
      { name: "便秘", key: "便秘", emoji: "🚫", selected: false },
      { name: "食欲不振", key: "食欲不振", emoji: "🍽️", selected: false }
    ]
  },
  {
    name: "呼吸系统",
    emoji: "🫁",
    symptoms: [
      { name: "咳嗽", key: "咳嗽", emoji: "😷", selected: false },
      { name: "打喷嚏", key: "打喷嚏", emoji: "🤧", selected: false },
      { name: "呼吸困难", key: "呼吸困难", emoji: "😮", selected: false }
    ]
  },
  {
    name: "泌尿系统",
    emoji: "💧",
    symptoms: [
      { name: "尿频", key: "尿频", emoji: "🚽", selected: false },
      { name: "尿血", key: "尿血", emoji: "🩸", selected: false },
      { name: "排尿困难", key: "排尿困难", emoji: "😣", selected: false }
    ]
  },
  {
    name: "皮肤问题",
    emoji: "🧴",
    symptoms: [
      { name: "瘙痒", key: "瘙痒", emoji: "🐕", selected: false },
      { name: "脱毛", key: "脱毛", emoji: "🪮", selected: false },
      { name: "皮疹", key: "皮疹", emoji: "🔴", selected: false }
    ]
  },
  {
    name: "眼部症状",
    emoji: "👁️",
    symptoms: [
      { name: "流泪", key: "流泪", emoji: "😢", selected: false },
      { name: "红肿", key: "眼睛红肿", emoji: "👁️", selected: false }
    ]
  },
  {
    name: "耳部问题",
    emoji: "👂",
    symptoms: [
      { name: "耳垢多", key: "耳垢多", emoji: "👂", selected: false },
      { name: "甩头抓耳", key: "甩头/抓耳", emoji: "👂", selected: false }
    ]
  },
  {
    name: "神经行为",
    emoji: "🧠",
    symptoms: [
      { name: "抽搐", key: "抽搐", emoji: "⚡", selected: false },
      { name: "精神萎靡", key: "精神萎靡", emoji: "😴", selected: false }
    ]
  },
  {
    name: "口腔问题",
    emoji: "🦷",
    symptoms: [
      { name: "流口水", key: "流口水", emoji: "💧", selected: false },
      { name: "牙龈问题", key: "牙龈红肿", emoji: "🦷", selected: false }
    ]
  }
]

Page({
  data: {
    currentStep: 1,
    petList: [],
    selectedPet: '',
    symptomCategories: SYMPTOM_CATEGORIES,
    selectedSymptoms: [],
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
    var symptomKey = e.currentTarget.dataset.key

    console.log('=== 症状选择操作 ===')
    console.log('分类索引:', categoryIndex)
    console.log('症状key:', symptomKey)

    // 找到对应的症状并切换状态
    var categories = this.data.symptomCategories
    var targetSymptom = categories[categoryIndex].symptoms.find(function(s) {
      return s.key === symptomKey
    })

    if (targetSymptom) {
      // 完全自由的多选：切换状态，不限制任何选择
      var newSelectedState = !targetSymptom.selected
      targetSymptom.selected = newSelectedState

      console.log('症状:', targetSymptom.name)
      console.log('选中状态:', newSelectedState)

      // 更新已选症状列表（遍历所有分类和症状）
      var selectedSymptoms = []
      for (var i = 0; i < categories.length; i++) {
        for (var j = 0; j < categories[i].symptoms.length; j++) {
          if (categories[i].symptoms[j].selected) {
            selectedSymptoms.push(categories[i].symptoms[j].name)
          }
        }
      }

      console.log('所有已选症状:', selectedSymptoms)

      // 更新分类选中数量
      var updatedCategories = this.calculateSelectedCount(categories)

      this.setData({
        symptomCategories: updatedCategories,
        selectedSymptoms: selectedSymptoms
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

    // 找到对应的症状并取消选择
    var categories = this.data.symptomCategories
    var selectedSymptoms = this.data.selectedSymptoms

    for (var i = 0; i < categories.length; i++) {
      for (var j = 0; j < categories[i].symptoms.length; j++) {
        if (categories[i].symptoms[j].name === symptomName) {
          categories[i].symptoms[j].selected = false
        }
      }
    }

    // 从已选列表中移除
    selectedSymptoms = selectedSymptoms.filter(function(name) {
      return name !== symptomName
    })

    // 更新分类选中数量
    var updatedCategories = this.calculateSelectedCount(categories)

    this.setData({
      symptomCategories: updatedCategories,
      selectedSymptoms: selectedSymptoms
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
      selectedSymptoms: []
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
    this.setData({
      description: e.detail.value
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
      openid: openid, // 添加openid字段
      petId: self.data.selectedPet,
      symptoms: self.data.selectedSymptoms,
      description: self.data.description,
      duration: self.data.duration,
      severity: self.data.severity
    }

    console.log('提交数据:', submitData)

    wx.showLoading({ title: '分析中...' })

    wx.cloud.callFunction({
      name: 'submitSymptom',
      data: submitData,
      success: function(res) {
        wx.hideLoading()
        console.log('症状评估提交结果:', res.result)

        if (res.result.code === 0) {
          wx.showModal({
            title: '评估完成',
            content: '症状已提交，AI正在为您分析，请稍候...',
            showCancel: false,
            success: function() {
              self.goBack()
            }
          })
        } else {
          wx.showToast({
            title: res.result.msg || '提交失败',
            icon: 'none'
          })
        }
      },
      fail: function(err) {
        wx.hideLoading()
        console.error('症状评估提交失败:', err)
        wx.showToast({
          title: '网络错误，请重试',
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
