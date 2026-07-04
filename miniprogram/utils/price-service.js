/**
 * 价格加载公共服务
 * 统一从 getPrices 云函数加载价格配置，带客户端缓存
 * 8 个页面曾各自重复实现此逻辑 —— 提取为公共模块
 *
 * 使用方式:
 *   const priceService = require('../../utils/price-service')
 *   // Promise 模式
 *   priceService.fetchPrices().then(prices => { ... })
 *   // Callback 模式（兼容旧页面）
 *   priceService.fetchPricesWithCallback(function(prices) { ... })
 *   // 获取缓存
 *   const cached = priceService.getCached()
 */
const logger = require('./logger');
const log = logger.child('PriceService');

let _prices = null;
let _loading = false;
let _callbacks = [];

/**
 * 从云函数加载价格配置
 * 多次调用只执行一次网络请求，后续返回缓存
 * @returns {Promise<object>} 价格数据对象
 */
function fetchPrices() {
  // 已有缓存，直接返回
  if (_prices) return Promise.resolve(_prices);

  // 正在加载中，加入等待队列
  if (_loading) {
    return new Promise(function(resolve) {
      _callbacks.push(resolve);
    });
  }

  _loading = true;
  return new Promise(function(resolve) {
    wx.cloud.callFunction({
      name: 'getPrices',
      data: {},
      success: function(res) {
        if (res.result && res.result.code === 0 && res.result.data) {
          _prices = res.result.data;
        }
      },
      fail: function(err) {
        log.warn('getPrices 加载失败:', err);
      },
      complete: function() {
        _loading = false;
        // 即使失败也 resolve（让页面使用默认值）
        var result = _prices || {};
        _callbacks.forEach(function(cb) { cb(result); });
        _callbacks = [];
        resolve(result);
      }
    });
  });
}

/**
 * Callback 风格的加载（兼容旧页面）
 * @param {function} callback - 加载完成回调，接收 prices 参数
 */
function fetchPricesWithCallback(callback) {
  fetchPrices().then(function(prices) {
    if (callback) callback(prices);
  });
}

/**
 * 强制重新加载（忽略缓存）
 * @returns {Promise<object>}
 */
function reloadPrices() {
  _prices = null;
  return fetchPrices();
}

/**
 * 获取已缓存的价格数据
 * @returns {object|null}
 */
function getCached() {
  return _prices;
}

/**
 * 重置缓存（主要用于测试）
 */
function resetCache() {
  _prices = null;
  _loading = false;
  _callbacks = [];
}

module.exports = {
  fetchPrices: fetchPrices,
  fetchPricesWithCallback: fetchPricesWithCallback,
  reloadPrices: reloadPrices,
  getCached: getCached,
  resetCache: resetCache
};
