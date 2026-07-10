// 常见宠物用药安全速查
const tracker = require('../../../utils/tracker.js');
const TOOL_NAME = 'medication';

const MEDS = [
  { name: "阿莫西林", catSafe: "caution", dogSafe: "caution", dose: "5-10mg/kg，每日2次", note: "需兽医处方，常见呼吸道/泌尿感染" },
  { name: "甲硝唑", catSafe: "caution", dogSafe: "caution", dose: "10-15mg/kg，每日2次", note: "治疗肠道寄生虫和厌氧菌感染" },
  { name: "头孢氨苄", catSafe: "caution", dogSafe: "caution", dose: "10-30mg/kg，每日2次", note: "广谱抗生素，需遵医嘱" },
  { name: "伊曲康唑", catSafe: "caution", dogSafe: "caution", dose: "5mg/kg，每日1次", note: "抗真菌药，猫需特别谨慎" },
  { name: "美洛昔康", catSafe: "caution", dogSafe: "caution", dose: "猫0.1mg/kg；狗0.1mg/kg首日", note: "NSAID止痛消炎，猫仅短期使用" },
  { name: "加巴喷丁", catSafe: "caution", dogSafe: "caution", dose: "10-20mg/kg", note: "抗惊厥/神经痛，也用于焦虑" },
  { name: "苯海拉明(扑尔敏)", catSafe: "caution", dogSafe: "caution", dose: "1mg/kg，每日2-3次", note: "抗过敏，可引起嗜睡" },
  { name: "奥美拉唑", catSafe: "caution", dogSafe: "caution", dose: "0.5-1mg/kg，每日1次", note: "胃酸抑制剂" },
  { name: "对乙酰氨基酚(扑热息痛)", catSafe: "danger", dogSafe: "caution", dose: "猫禁用", note: "猫致死！狗也需极低剂量遵医嘱" },
  { name: "布洛芬", catSafe: "danger", dogSafe: "danger", dose: "禁用", note: "可致胃溃疡和肾衰竭，不要给宠物吃" },
  { name: "阿司匹林", catSafe: "danger", dogSafe: "caution", dose: "猫尽量避免", note: "猫代谢极慢易中毒，狗也需谨慎" },
  { name: "塞来昔布", catSafe: "danger", dogSafe: "caution", dose: "猫禁用", note: "人用NSAID，猫有致命风险" }
];

Page({
  data: {
    keyword: "",
    meds: MEDS,
    filtered: MEDS
  },
  onLoad: function() {
    tracker.view(TOOL_NAME);
  },
  onSearch: function(e) {
    const kw = e.detail.value.toLowerCase();
    this.setData({ keyword: kw });
    if (!kw) { this.setData({ filtered: MEDS }); return; }
    tracker.use(TOOL_NAME, { keyword: kw });
    this.setData({
      filtered: MEDS.filter(function(m) { return m.name.toLowerCase().indexOf(kw) >= 0; })
    });
  },
  goToReport: function() {
    tracker.toReport(TOOL_NAME);
    wx.switchTab({ url: '/pages/symptom/guide' });
  }
});
