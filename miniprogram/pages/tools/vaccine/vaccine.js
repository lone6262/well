// 疫苗时间表工具
const tracker = require('../../../utils/tracker.js');
const TOOL_NAME = 'vaccine';

Page({
  data: {
    petType: "cat",
    schedule: [],
    catSchedule: [
      { age: "6-8周龄", vaccine: "猫三联第1针", desc: "预防猫瘟、猫鼻支、猫杯状病毒" },
      { age: "10-12周龄", vaccine: "猫三联第2针", desc: "加强免疫" },
      { age: "14-16周龄", vaccine: "猫三联第3针 + 狂犬", desc: "完成核心免疫" },
      { age: "每年", vaccine: "猫三联 + 狂犬加强", desc: "每年加强一次" }
    ],
    dogSchedule: [
      { age: "6-8周龄", vaccine: "犬二联第1针", desc: "预防犬瘟热、细小病毒" },
      { age: "10-12周龄", vaccine: "犬四联/八联第2针", desc: "预防犬瘟、细小、肝炎、副流感等" },
      { age: "14-16周龄", vaccine: "犬四联/八联第3针 + 狂犬", desc: "完成核心免疫" },
      { age: "每年", vaccine: "犬联苗 + 狂犬加强", desc: "每年加强一次" }
    ]
  },
  onLoad: function() {
    tracker.view(TOOL_NAME);
    this.setData({ schedule: this.data.catSchedule });
  },
  switchToCat: function() {
    tracker.use(TOOL_NAME, { pet_type: 'cat' });
    this.setData({ petType: "cat", schedule: this.data.catSchedule });
  },
  switchToDog: function() {
    tracker.use(TOOL_NAME, { pet_type: 'dog' });
    this.setData({ petType: "dog", schedule: this.data.dogSchedule });
  },
  goToReport: function() {
    tracker.toReport(TOOL_NAME);
    wx.switchTab({ url: '/pages/symptom/guide' });
  }
});
