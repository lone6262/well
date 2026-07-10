/**
 * Feature Flag 辅助方法
 * 统一读取 app.globalData.featureFlags 中的开关值
 *
 * 使用方式:
 *   var flags = require('../../utils/feature-flags.js')
 *   if (flags.isEnabled('enable_share_card')) { ... }
 */

/**
 * 获取某个 Feature Flag 的开关状态
 * @param {string} key - flag key，如 'enable_share_card'
 * @returns {boolean} true=开启, false=关闭
 */
function isEnabled(key) {
  var app = getApp();
  if (!app || !app.globalData || !app.globalData.featureFlags) return false;
  return !!app.globalData.featureFlags[key];
}

/**
 * 获取全部 Feature Flags
 * @returns {Object} 所有 flag 的键值对
 */
function getAll() {
  var app = getApp();
  if (!app || !app.globalData || !app.globalData.featureFlags) return {};
  return app.globalData.featureFlags;
}

module.exports = {
  isEnabled: isEnabled,
  getAll: getAll
};