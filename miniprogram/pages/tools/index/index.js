// 养宠工具中心
const logger = require('../../../utils/logger.js');
const log = logger.child('ToolsHub');
const tracker = require('../../../utils/tracker.js');
const flagsHelper = require('../../../utils/feature-flags.js');

Page({
  data: {
    flags: {}
  },

  // 拉取 feature flags 到 data 供 wxml 显隐
  _syncFlags: function() {
    this.setData({
      flags: {
        enableFoodSearch: flagsHelper.isEnabled('enable_food_search')
      }
    });
  },

  onLoad: function() {
    tracker.view('hub');
    this._syncFlags();
  },

  onShow: function() {
    // flags 在 app.js 启动时异步加载，onShow 再同步一次确保拿到最新值
    this._syncFlags();
  },

  goToTool: function(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;

    // 深链防御：被关闭的工具直接拦截
    if (url.indexOf('food-safety') > -1 && !flagsHelper.isEnabled('enable_food_search')) {
      log.warn('食物安全工具已被功能开关关闭');
      return;
    }

    log.info('打开工具:', url);
    wx.navigateTo({ url: url });
  },

  goToSymptom: function() {
    log.info('跳转症状自查');
    wx.switchTab({ url: '/pages/symptom/guide' });
  }
});
