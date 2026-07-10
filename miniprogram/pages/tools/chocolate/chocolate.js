// 巧克力毒性计算器
// 可可碱毒性剂量: 猫狗 LD50 ~100-200mg/kg，中毒阈值 ~20mg/kg
const tracker = require('../../../utils/tracker.js');
const TOOL_NAME = 'chocolate';

const CHOC_TYPES = [
  { name: "牛奶巧克力", theobromine: 2.3 },
  { name: "黑巧克力", theobromine: 5.7 },
  { name: "烘焙巧克力", theobromine: 14.0 },
  { name: "可可粉", theobromine: 26.0 }
];

Page({
  data: {
    weight: "",
    chocIndex: 0,
    chocTypes: CHOC_TYPES,
    amount: "",
    result: null
  },
  onLoad: function() {
    tracker.view(TOOL_NAME);
  },
  onWeightInput: function(e) { this.setData({ weight: e.detail.value }); },
  onAmountInput: function(e) { this.setData({ amount: e.detail.value }); },
  onChocChange: function(e) { this.setData({ chocIndex: parseInt(e.detail.value) }); },
  calculate: function() {
    const wt = parseFloat(this.data.weight);
    const amt = parseFloat(this.data.amount);
    if (!wt || !amt || wt <= 0 || amt <= 0) {
      wx.showToast({ title: "请输入有效数值", icon: "none" });
      return;
    }
    tracker.use(TOOL_NAME, { weight: wt, amount: amt });
    const choc = CHOC_TYPES[this.data.chocIndex];
    const theobromineMg = choc.theobromine * amt * 1000 / 100;
    const dosePerKg = theobromineMg / wt;
    let level, desc, action;
    if (dosePerKg < 20) {
      level = "safe"; desc = "预计安全"; action = " unlikely 有中毒风险，但密切观察";
    } else if (dosePerKg < 40) {
      level = "warning"; desc = "轻度中毒风险"; action = "可能出现呕吐、腹泻。观察6-12小时，如症状加重就医。";
    } else if (dosePerKg < 60) {
      level = "danger"; desc = "中度中毒风险"; action = "可能呕吐、心率加快、颤抖。建议立即联系兽医。";
    } else {
      level = "danger"; desc = "严重中毒！紧急就医"; action = "可能导致癫痫、心律失常、危及生命。立即送医！";
    }
    this.setData({
      result: {
        level: level, desc: desc, action: action,
        dose: dosePerKg.toFixed(1),
        chocName: choc.name,
        totalMg: theobromineMg.toFixed(1)
      }
    });
  },
  goToReport: function() {
    tracker.toReport(TOOL_NAME);
    wx.switchTab({ url: '/pages/symptom/guide' });
  }
});
