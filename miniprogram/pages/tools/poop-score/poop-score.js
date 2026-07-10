// 便便评分工具
const logger = require('../../../utils/logger.js');
const log = logger.child('PoopScoreTool');
const tracker = require('../../../utils/tracker.js');
const TOOL_NAME = 'poop_score';

// 7种便便类型数据（基于Bristol便便分级表宠物版）
const POOP_TYPES = [
  {
    id: 1, name: 'Type 1', desc: '硬球状，像弹珠', score: 1, level: 'danger',
    shapeClass: 'shape-1',
    summary: '严重便秘，便便干硬如球',
    detail: '便便极度干硬，排出困难。通常伴随排便时间延长、食欲下降、频繁尝试排便但排不出。',
    actions: ['增加饮水量，湿粮替代干粮', '增加运动促进肠道蠕动', '可适量补充膳食纤维（如蒸南瓜）', '持续超过2天或伴有呕吐，立即就医']
  },
  {
    id: 2, name: 'Type 2', desc: '块状连接，表面粗糙', score: 2, level: 'warning',
    shapeClass: 'shape-2',
    summary: '轻度便秘，便便偏硬',
    detail: '便便较硬成块，排出有一定困难。通常是饮水不足或纤维摄入过少的表现。',
    actions: ['增加饮水量', '适当增加膳食纤维', '观察1-2天，如无改善需关注', '持续3天以上建议咨询兽医']
  },
  {
    id: 3, name: 'Type 3', desc: '香肠状，表面有裂纹', score: 7, level: 'success',
    shapeClass: 'shape-3',
    summary: '理想型，消化道健康',
    detail: '便便成形良好，表面有细小裂纹，软硬适中，容易拾起不沾地。这是最健康的便便状态。',
    actions: ['继续保持当前饮食和运动习惯', '定期驱虫和体检', '无需任何调整']
  },
  {
    id: 4, name: 'Type 4', desc: '光滑柔软，像香肠', score: 7, level: 'success',
    shapeClass: 'shape-4',
    summary: '理想型，消化道健康',
    detail: '便便光滑柔软呈条状，成形良好，容易拾起。这也是健康的便便状态。',
    actions: ['继续保持', '定期驱虫和体检', '无需任何调整']
  },
  {
    id: 5, name: 'Type 5', desc: '软块状，边缘模糊', score: 4, level: 'warning',
    shapeClass: 'shape-5',
    summary: '偏软，需关注饮食',
    detail: '便便偏软成块，边缘不清晰，拾起时容易碎。可能是饮食变化、轻度肠胃不适或食物过敏的表现。',
    actions: ['回顾近期是否有饮食变化', '观察是否伴有其他症状', '清淡饮食1-2天', '持续超过2天建议就医检查']
  },
  {
    id: 6, name: 'Type 6', desc: '糊状，边缘参差不齐', score: 2, level: 'danger',
    shapeClass: 'shape-6',
    summary: '腹泻，需要密切观察',
    detail: '便便呈糊状或泥状，水分多不成形。可能是吃了不洁食物、肠胃感染或应激反应。',
    actions: ['观察精神和食欲是否正常', '暂停喂食4-6小时（不禁水）', '恢复后少量多餐喂易消化食物', '如伴有呕吐、精神萎靡立即就医', '持续超过24小时必须就医']
  },
  {
    id: 7, name: 'Type 7', desc: '完全水样，无固体', score: 1, level: 'danger',
    shapeClass: 'shape-7',
    summary: '严重腹泻，立即就医',
    detail: '完全水样便，无固体成分。有严重脱水风险，可能是病毒感染（如猫瘟/犬细小）、严重肠胃炎或中毒。',
    actions: ['立即就医，不要等待', '防止脱水，保证饮水供应', '保留便便样本供兽医检查', '切勿自行用药', '如伴有呕吐、便血、发热为急症']
  }
];

Page({
  data: {
    poopTypes: POOP_TYPES,
    selectedType: null,
    result: null
  },

  onLoad: function() {
    tracker.view(TOOL_NAME);
  },

  selectType: function(e) {
    const id = e.currentTarget.dataset.id;
    const selected = POOP_TYPES.find(function(item) { return item.id === id; });
    if (!selected) return;

    const iconMap = {
      danger: selected.score === 1 ? '🚨' : '⚠️',
      warning: '🔍',
      success: '✅'
    };
    const levelTextMap = {
      danger: selected.score === 1 ? '危险' : '高风险',
      warning: '需关注',
      success: '健康'
    };

    log.info('便便评分选择: Type', id, '评分', selected.score);

    tracker.use(TOOL_NAME, { type_id: id, score: selected.score });

    this.setData({
      selectedType: id,
      result: {
        score: selected.score,
        level: selected.level,
        icon: iconMap[selected.level] || '🔍',
        levelText: levelTextMap[selected.level] || '需关注',
        summary: selected.summary,
        detail: selected.detail,
        actions: selected.actions
      }
    });
  },

  goToReport: function() {
    tracker.toReport(TOOL_NAME);
    log.info('跳转症状自查');
    wx.switchTab({ url: '/pages/symptom/guide' });
  }
});
