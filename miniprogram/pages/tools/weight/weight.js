// 体态评分工具 (Body Condition Score)
const tracker = require('../../../utils/tracker.js');
const TOOL_NAME = 'weight';

Page({
  data: {
    score: 5,
    result: null,
    levels: [
      { score: 1, label: "极瘦", level: "danger", desc: "肋骨、脊椎明显突出，无明显体脂。需要增加营养摄入。", tip: "建议少量多餐喂食高热量食物，排查寄生虫和疾病" },
      { score: 2, label: "偏瘦", level: "warning", desc: "肋骨容易触及，腰部明显。体重略低于理想范围。", tip: "适当增加喂食量，选择营养密度高的食物" },
      { score: 3, label: "偏瘦", level: "warning", desc: "肋骨可触及且有轻微脂肪覆盖，腰部较明显。", tip: "略微增加食量，关注体重变化趋势" },
      { score: 4, label: "理想偏瘦", level: "success", desc: "肋骨可触及，脂肪覆盖适中，腰部曲线清晰。", tip: "继续保持，定期监测体重" },
      { score: 5, label: "理想", level: "success", desc: "肋骨有适量脂肪覆盖，腰部明显，腹部收紧。完美体态！", tip: "保持当前饮食和运动量，非常棒" },
      { score: 6, label: "理想偏胖", level: "success", desc: "肋骨可触及但脂肪稍多，腰部可见但不明显。", tip: "注意控制零食，增加运动量" },
      { score: 7, label: "偏胖", level: "warning", desc: "肋骨不易触及，脂肪较多，腰部几乎不可见。", tip: "减少10-15%喂食量，增加每日运动" },
      { score: 8, label: "肥胖", level: "danger", desc: "肋骨很难触及，腹部明显膨大，无腰部曲线。", tip: "需要减重计划，建议咨询兽医制定方案" },
      { score: 9, label: "严重肥胖", level: "danger", desc: "大量脂肪堆积，腹部明显下垂，活动受限。健康风险极高。", tip: "必须就医制定减重计划，可能已有健康问题" }
    ]
  },
  onLoad: function() {
    tracker.view(TOOL_NAME);
    this.setData({ result: this.data.levels[4] });
  },
  onScoreChange: function(e) {
    const s = parseInt(e.detail.value);
    tracker.use(TOOL_NAME, { score: s });
    this.setData({ score: s, result: this.data.levels[s - 1] });
  },
  goToReport: function() {
    tracker.toReport(TOOL_NAME);
    wx.switchTab({ url: '/pages/symptom/guide' });
  }
});
