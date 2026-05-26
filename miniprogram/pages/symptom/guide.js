// 症状向导页面 - 最终修复版本
var app = getApp()

// 本地症状分类数据
var SYMPTOM_CATEGORIES = [
  {
    name: "消化系统",
    symptoms: [
      { label: "呕吐", key: "呕吐", selected: false },
      { label: "腹泻", key: "腹泻", selected: false },
      { label: "便秘", key: "便秘", selected: false },
      { label: "食欲不振", key: "食欲不振", selected: false }
    ]
  },
  {
    name: "呼吸系统",
    symptoms: [
      { label: "咳嗽", key: "咳嗽", selected: false },
      { label: "打喷嚏", key: "打喷嚏", selected: false },
      { label: "呼吸困难", key: "呼吸困难", selected: false }
    ]
  },
  {
    name: "泌尿系统",
    symptoms: [
      { label: "尿频", key: "尿频", selected: false },
      { label: "尿血", key: "尿血", selected: false },
      { label: "排尿困难", key: "排尿困难", selected: false }
    ]
  },
  {
    name: "皮肤/被毛",
    symptoms: [
      { label: "瘙痒", key: "瘙痒", selected: false },
      { label: "脱毛", key: "脱毛", selected: false },
      { label: "皮疹/红肿", key: "皮疹/红肿", selected: false }
    ]
  },
  {
    name: "眼部",
    symptoms: [
      { label: "流泪/眼屎多", key: "流泪/眼屎多", selected: false },
      { label: "眼睛红肿", key: "眼睛红肿", selected: false }
    ]
  },
  {
    name: "耳部",
    symptoms: [
      { label: "耳垢多/异味", key: "耳垢多/异味", selected: false },
      { label: "甩头/抓耳", key: "甩头/抓耳", selected: false }
    ]
  },
  {
    name: "神经/行为",
    symptoms: [
      { label: "抽搐", key: "抽搐", selected: false },
      { label: "精神萎靡", key: "精神萎靡", selected: false }
    ]
  },
  {
    name: "口腔",
    symptoms: [
      { label: "流口水", key: "流口水", selected: false },
      {label: "牙龈红肿/出血", key: "牙龈红肿/出血", selected: false }
    ]
  }
]

Page({
  data: {
    currentStep: 1,
    petList: [],
    selectedPet: '',
    symptomCategories: SYMPTOM_CATEGORIES,
    selectedSymptoms: [],  // 用于提交评估
    description: ''
  },

  onLoad: function() {
    console.log('=== 症状向导页面加载完成 ===')
    this.loadMockPetList()
  },

  // 加载模拟宠物数据
  loadMockPetList: function() {
    var mockPets = [
      { petId: 'mock_001', name: '测试宠物1', type: 'cat', age: 12, breed: '英短' },
      { petId: 'mock_002', name: '测试宠物2', type: 'dog', age: 24, breed: '金毛' }
    ]

    this.setData({
      petList: mockPets
    })
  },

  // 选择宠物
  selectPet: function(e) {
    var petId = e.currentTarget.dataset.petId
    this.setData({
      selectedPet: petId
    })
  },

  // 添加新宠物
  addPet: function() {
    wx.navigateTo({
      url: '/pages/pet/profile?action=add'
    })
  },

  // 切换症状选择 - 最终简化版本
  toggleSymptom: function(e) {
    console.log('=== toggleSymptom 被调用 ===')

    var symptomKey = e.currentTarget.dataset.symptomKey
    var categoryIndex = parseInt(e.currentTarget.dataset.categoryIndex)
    var symptomIndex = parseInt(e.currentTarget.dataset.symptomIndex)

    console.log('点击症状:', symptomKey, '分类索引:', categoryIndex, '症状索引:', symptomIndex)

    // 直接定位到目标症状
    var categories = this.data.symptomCategories
    var targetSymptom = categories[categoryIndex].symptoms[symptomIndex]

    console.log('目标症状当前状态:', targetSymptom.selected)

    // 切换状态
    targetSymptom.selected = !targetSymptom.selected

    console.log('目标症状新状态:', targetSymptom.selected)

    // 更新selectedSymptoms数组（用于提交）
    var selectedSymptoms = []
    for (var i = 0; i < categories.length; i++) {
      for (var j = 0; j < categories[i].symptoms.length; j++) {
        if (categories[i].symptoms[j].selected) {
          selectedSymptoms.push(categories[i].symptoms[j].key)
        }
      }
    }

    console.log('所有已选症状:', selectedSymptoms)

    this.setData({
      symptomCategories: categories,
      selectedSymptoms: selectedSymptoms
    })

    console.log('=== toggleSymptom 完成 ===')
  },

  // 描述输入
  onDescriptionInput: function(e) {
    this.setData({
      description: e.detail.value
    })
  },

  // 下一步
  nextStep: function() {
    if (this.data.currentStep === 1) {
      if (!this.data.selectedPet) {
        wx.showToast({
          title: '请选择宠物',
          icon: 'none'
        })
        return
      }
    } else if (this.data.currentStep === 2) {
      if (this.data.selectedSymptoms.length === 0) {
        wx.showToast({
          title: '请至少选择一个症状',
          icon: 'none'
        })
        return
      }
    } else if (this.data.currentStep === 3) {
      this.submitAssessment()
      return
    }

    this.setData({
      currentStep: this.data.currentStep + 1
    })
  },

  // 上一步
  prevStep: function() {
    if (this.data.currentStep > 1) {
      this.setData({
        currentStep: this.data.currentStep - 1
      })
    }
  },

  // 提交评估
  submitAssessment: function() {
    if (this.data.selectedSymptoms.length === 0) {
      wx.showToast({
        title: '请至少选择一个症状',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '评估中...' })

      var self = this
      setTimeout(function() {
        wx.hideLoading()

        var riskLevel = 'low'
        var highRiskSymptoms = ['抽搐', '呼吸困难', '尿血', '排尿困难']
        var midRiskSymptoms = ['呕吐', '腹泻', '咳嗽', '食欲不振', '精神萎靡']

        for (var i = 0; i < self.data.selectedSymptoms.length; i++) {
          var symptom = self.data.selectedSymptoms[i];
          for (var j = 0; j < highRiskSymptoms.length; j++) {
            if (symptom === highRiskSymptoms[j]) {
              riskLevel = 'high'
              break
            }
          }
          if (riskLevel === 'low') {
            for (var k = 0; k < midRiskSymptoms.length; k++) {
              if (symptom === midRiskSymptoms[k]) {
                riskLevel = 'mid'
                break
              }
            }
          }
          if (riskLevel === 'high') {
            break
          }
        }

        var foundPet = null;
        for (var i = 0; i < self.data.petList.length; i++) {
          if (self.data.petList[i].petId === self.data.selectedPet) {
            foundPet = self.data.petList[i];
            break;
          }
        }
        var petName = foundPet ? foundPet.name : '宠物';

        wx.navigateTo({
          url: '/pages/risk/result?riskLevel=' + riskLevel + '&petName=' + petName
        })

      }, 1000)

    } catch (error) {
      wx.hideLoading()
      console.error('提交评估失败:', error)
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      })
    }
  }
})
