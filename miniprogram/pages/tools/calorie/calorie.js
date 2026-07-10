// 每日热量需求计算 (RER + 系数法)
const tracker = require('../../../utils/tracker.js');
const TOOL_NAME = 'calorie';

Page({
  data: {
    weight: "",
    petType: "cat",
    activity: "adult",
    result: null
  },
  onLoad: function() {
    tracker.view(TOOL_NAME);
  },
  switchToCat: function() { this.setData({ petType: "cat", result: null }); },
  switchToDog: function() { this.setData({ petType: "dog", result: null }); },
  onWeightInput: function(e) { this.setData({ weight: e.detail.value }); },
  onActivityChange: function(e) { this.setData({ activity: e.detail.value, result: null }); },
  calculate: function() {
    const wt = parseFloat(this.data.weight);
    if (!wt || wt <= 0) { wx.showToast({ title: "请输入体重", icon: "none" }); return; }
    tracker.use(TOOL_NAME, { pet_type: this.data.petType, activity: this.data.activity });
    const rer = 70 * Math.pow(wt, 0.75);
    let factors;
    if (this.data.petType === "cat") {
      factors = { kitten: 2.5, adult: 1.2, neutered: 1.0, senior: 0.8, overweight: 0.8 };
    } else {
      factors = { puppy: 3.0, adult: 1.6, neutered: 1.4, senior: 1.1, overweight: 1.0 };
    }
    const der = rer * (factors[this.data.activity] || 1.2);
    this.setData({
      result: {
        rer: rer.toFixed(0),
        der: der.toFixed(0),
        dryFood: (der / 3.5).toFixed(0),
        wetFood: (der / 1.0).toFixed(0)
      }
    });
  },
  goToReport: function() {
    tracker.toReport(TOOL_NAME);
    wx.switchTab({ url: '/pages/symptom/guide' });
  }
});
