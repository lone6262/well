// 宠物随机起名器
const tracker = require('../../../utils/tracker.js');
const TOOL_NAME = 'name_gen';

const PREFIX = ["小", "阿", "咪", "团", "奶", "豆", "球", "蛋", "宝", "丁"];
const CAT_NAMES = ["橘宝", "奶茶", "布丁", "年糕", "汤圆", "豆豆", "毛球", "花花", "咪咪", "糖糖", "芝麻", "芋圆", "麻薯", "可乐", "奶油", "花生", "瓜子", "果冻", "月饼", "粽子", "雪糕", "泡芙", "曲奇", "布朗尼", "拿铁", "卡布", "摩卡", "汉堡", "薯条", "蛋黄", "酥酥", "棉花糖", "小米", "铃铛", "七喜"];
const DOG_NAMES = ["旺财", "来福", "豆豆", "球球", "大黄", "小黑", "元宝", "嘟嘟", "贝贝", "毛毛", "果果", "糖糖", "可乐", "汉堡", "薯条", "花生", "瓜子", "奶酪", "布丁", "奶茶", "芝麻", "小米", "铃铛", "七喜", "闪电", "子弹", "坦克", "将军", "公主", "王子", "土豪", "老板", "悟空", "八戒", "皮蛋"];
const FEMALE_NAMES = ["花花", "糖糖", "奶茶", "布丁", "年糕", "汤圆", "芋圆", "麻薯", "奶油", "棉花糖", "曲奇", "拿铁", "公主", "铃铛", "酥酥"];
const MALE_NAMES = ["旺财", "来福", "元宝", "大黄", "坦克", "将军", "王子", "老板", "悟空", "闪电", "土豪", "汉堡", "八戒", "皮蛋", "子弹"];

Page({
  data: {
    name: "点击下方按钮",
    history: []
  },
  onLoad: function() {
    tracker.view(TOOL_NAME);
  },
  generate: function() {
    tracker.use(TOOL_NAME, { mode: 'random' });
    const pool = CAT_NAMES.concat(DOG_NAMES);
    const name = pool[Math.floor(Math.random() * pool.length)];
    const h = this.data.history.slice();
    h.unshift(name);
    if (h.length > 8) h.pop();
    this.setData({ name: name, history: h });
  },
  generateFemale: function() {
    tracker.use(TOOL_NAME, { mode: 'female' });
    const name = FEMALE_NAMES[Math.floor(Math.random() * FEMALE_NAMES.length)];
    this.setData({ name: name });
  },
  generateMale: function() {
    tracker.use(TOOL_NAME, { mode: 'male' });
    const name = MALE_NAMES[Math.floor(Math.random() * MALE_NAMES.length)];
    this.setData({ name: name });
  },
  goToReport: function() {
    tracker.toReport(TOOL_NAME);
    wx.switchTab({ url: '/pages/symptom/guide' });
  }
});
