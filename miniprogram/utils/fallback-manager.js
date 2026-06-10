const logger = require('./logger.js')
const log = logger.child('FallbackManager')
/**
 * 降级管理器
 * 统一处理云开发不可用时的本地数据降级逻辑
 *
 * 使用方式：
 *   var fallback = require('../../utils/fallback-manager');
 *   var result = await fallback.withFallback(
 *     function() { return cloudFunctionCall(); },
 *     function() { return localDataFallback(); },
 *     '宠物数据'
 *   );
 */

var app = getApp();

/**
 * 云函数/本地数据降级执行器
 * @param {Function} cloudFn - 云函数调用（返回 Promise）
 * @param {Function} localFn - 本地数据降级（返回 Promise 或同步值）
 * @param {string} [context] - 上下文描述（用于日志）
 * @returns {Promise<*>} 云函数或本地数据的结果
 */
function withFallback(cloudFn, localFn, context) {
  var label = context || '数据';

  if (app.globalData.cloudDevelopmentAvailable) {
    return cloudFn().catch(function(error) {
      log.warn('云函数调用失败，使用本地' + label + ':', error);
      return localFn();
    });
  }

  return Promise.resolve(localFn());
}

module.exports = { withFallback: withFallback };
