// 猫狗年龄换算工具
const logger = require('../../../utils/logger.js');
const log = logger.child('PetAgeTool');
const tracker = require('../../../utils/tracker.js');
const TOOL_NAME = 'pet_age';

Page({
  data: {
    currentType: 'cat',
    currentSize: 'medium',
    ageInput: '',
    result: null
  },

  onLoad: function() {
    tracker.view(TOOL_NAME);
  },

  switchType: function(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ currentType: type, result: null, ageInput: '' });
  },

  selectSize: function(e) {
    const size = e.currentTarget.dataset.size;
    this.setData({ currentSize: size, result: null });
  },

  onAgeInput: function(e) {
    this.setData({ ageInput: e.detail.value });
    if (e.detail.value) {
      this.calculate();
    } else {
      this.setData({ result: null });
    }
  },

  setQuickAge: function(e) {
    const age = e.currentTarget.dataset.age;
    this.setData({ ageInput: String(age) });
    this.calculate();
  },

  calculate: function() {
    const age = parseFloat(this.data.ageInput);
    if (!age || age < 0 || age > 30) return;

    const type = this.data.currentType;
    const size = this.data.currentSize;
    let humanAge;

    if (type === 'cat') {
      humanAge = this.calcCatAge(age);
    } else {
      humanAge = this.calcDogAge(age, size);
    }

    const stage = this.getLifeStage(humanAge);
    const tips = this.getTips(stage, type);

    log.info('年龄换算:', type, age, '-> 人类', humanAge, '岁');

    tracker.use(TOOL_NAME, { pet_type: type, size: size });

    this.setData({
      result: {
        humanAge: humanAge,
        stage: stage.name,
        stageIcon: stage.icon,
        stageClass: 'stage-' + stage.key,
        tips: tips
      }
    });
  },

  // 猫年龄换算：1岁=15岁，2岁=24岁，之后每年+4
  calcCatAge: function(age) {
    if (age <= 0) return 0;
    if (age <= 1) return Math.round(age * 15);
    if (age <= 2) return Math.round(15 + (age - 1) * 9);
    return Math.round(24 + (age - 2) * 4);
  },

  // 狗年龄换算：根据体型不同
  calcDogAge: function(age, size) {
    if (age <= 0) return 0;
    if (age <= 1) return Math.round(age * 15);

    let base, perYear;
    if (size === 'small') {
      base = 24; perYear = 4;
    } else if (size === 'medium') {
      base = 24; perYear = 5;
    } else {
      // large
      if (age <= 2) return Math.round(15 + (age - 1) * 7);
      base = 22; perYear = age <= 4 ? 7 : 8;
    }
    return Math.round(base + (age - 2) * perYear);
  },

  getLifeStage: function(humanAge) {
    if (humanAge <= 0) return { name: '幼年', key: 'young', icon: '🐣' };
    if (humanAge < 18) return { name: '青少年', key: 'young', icon: '🌱' };
    if (humanAge < 40) return { name: '成年', key: 'adult', icon: '💪' };
    if (humanAge < 60) return { name: '成熟期', key: 'mature', icon: '🍂' };
    return { name: '老年', key: 'senior', icon: '👴' };
  },

  getTips: function(stage, type) {
    const tips = [];
    if (stage.key === 'young') {
      tips.push('幼年期是生长发育的关键阶段，需要充足营养');
      tips.push('按时接种疫苗和驱虫，建立健康基础');
      tips.push(type === 'cat' ? '猫咪1岁前相当于人类的青少年期' : '狗狗幼年期成长速度远超人类');
    } else if (stage.key === 'adult') {
      tips.push('成年期身体机能最佳，保持规律运动和均衡饮食');
      tips.push('每年至少体检一次，关注体重管理');
      tips.push('保持驱虫和疫苗的按时更新');
    } else if (stage.key === 'mature') {
      tips.push('成熟期开始关注关节、牙齿等健康问题');
      tips.push('建议每半年体检一次，留意慢性疾病');
      tips.push('适当调整饮食结构，控制热量摄入');
    } else {
      tips.push('老年期需要更多关爱和细致的健康监测');
      tips.push('建议每3-6个月体检，关注肝肾功能');
      tips.push('注意观察食欲、精神状态的变化，有异常及时就医');
    }
    return tips;
  },

  goToReport: function() {
    tracker.toReport(TOOL_NAME);
    log.info('跳转症状自查');
    wx.switchTab({ url: '/pages/symptom/guide' });
  }
});
