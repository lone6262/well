// 食物安全查询工具
const logger = require('../../../utils/logger.js');
const log = logger.child('FoodSafetyTool');
const api = require('../../../utils/api.js');
const tracker = require('../../../utils/tracker.js');
const TOOL_NAME = 'food_safety';

const HOT_FOODS = ['巧克力', '葡萄', '西瓜', '洋葱', '猫粮', '鸡胸肉'];
const ALL_CATEGORIES = ['水果', '蔬菜', '肉类', '零食', '饮料', '添加剂', '植物', '坚果', '其他'];

Page({
  data: {
    keyword: '',
    activeCategory: '',
    categories: ALL_CATEGORIES,
    hotFoods: HOT_FOODS,
    results: [],
    loading: false,
    searchTimer: null
  },

  onLoad: function() {
    tracker.view(TOOL_NAME);
  },

  onSearchInput: function(e) {
    const value = e.detail.value;
    this.setData({ keyword: value });

    // 防抖：输入停止 500ms 后搜索
    if (this.data.searchTimer) {
      clearTimeout(this.data.searchTimer);
    }
    const self = this;
    const timer = setTimeout(function() {
      if (value.trim()) {
        self.doSearch(value.trim());
      } else {
        self.setData({ results: [] });
      }
    }, 500);
    self.setData({ searchTimer: timer });
  },

  onSearchConfirm: function(e) {
    const value = e.detail.value || this.data.keyword;
    if (value.trim()) {
      this.doSearch(value.trim());
    }
  },

  clearSearch: function() {
    this.setData({ keyword: '', results: [] });
  },

  searchHot: function(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({ keyword: name });
    this.doSearch(name);
  },

  selectCategory: function(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ activeCategory: cat });
    if (cat) {
      this.doSearchByCategory(cat);
    } else if (this.data.keyword) {
      this.doSearch(this.data.keyword.trim());
    }
  },

  // 调用云函数搜索
  doSearch: function(keyword) {
    const self = this;
    self.setData({ loading: true });

    log.info('搜索食物:', keyword);
    tracker.use(TOOL_NAME, { keyword: keyword });

    api.call('searchFoodSafety', { keyword: keyword }).then(function(res) {
      if (res && res.code === 0 && res.data && res.data.foods) {
        self.setData({ results: res.data.foods, loading: false });
      } else {
        self.setData({ results: [], loading: false });
      }
    }).catch(function(err) {
      log.error('搜索食物失败:', err);
      self.setData({ results: [], loading: false });
    });
  },

  doSearchByCategory: function(category) {
    const self = this;
    self.setData({ loading: true });

    api.call('searchFoodSafety', { category: category, pageSize: 50 }).then(function(res) {
      if (res && res.code === 0 && res.data && res.data.foods) {
        self.setData({ results: res.data.foods, loading: false });
      } else {
        self.setData({ results: [], loading: false });
      }
    }).catch(function(err) {
      log.error('分类查询失败:', err);
      self.setData({ results: [], loading: false });
    });
  },

  goToReport: function() {
    tracker.toReport(TOOL_NAME);
    log.info('跳转症状自查');
    wx.switchTab({ url: '/pages/symptom/guide' });
  }
});
