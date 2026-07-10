// 发情周期计算器
const tracker = require('../../../utils/tracker.js');
const TOOL_NAME = 'heat_cycle';

Page({
  data: {
    petType: "cat",
    lastDate: "",
    result: null
  },
  onLoad: function() {
    tracker.view(TOOL_NAME);
  },
  switchToCat: function() { this.setData({ petType: "cat", result: null }); },
  switchToDog: function() { this.setData({ petType: "dog", result: null }); },
  onDateChange: function(e) { this.setData({ lastDate: e.detail.value }); },
  calculate: function() {
    if (!this.data.lastDate) { wx.showToast({ title: "请选择日期", icon: "none" }); return; }
    tracker.use(TOOL_NAME, { pet_type: this.data.petType });
    const d = new Date(this.data.lastDate);
    const cycleLen = this.data.petType === "cat" ? 21 : 180;
    const nextStart = new Date(d.getTime() + cycleLen * 24 * 60 * 60 * 1000);
    const fmt = function(dt) {
      return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
    };
    let info;
    if (this.data.petType === "cat") {
      info = { cycle: "每2-3周", duration: "持续7-10天", note: "猫是季节性多次发情（春秋为主），未绝育会反复发情。建议绝育。" };
    } else {
      info = { cycle: "每6个月", duration: "持续2-3周", note: "狗通常一年发情1-2次。注意发情期卫生，如无繁殖计划建议绝育。" };
    }
    this.setData({
      result: { nextDate: fmt(nextStart), cycleLen: cycleLen, info: info }
    });
  },
  goToReport: function() {
    tracker.toReport(TOOL_NAME);
    wx.switchTab({ url: '/pages/symptom/guide' });
  }
});
