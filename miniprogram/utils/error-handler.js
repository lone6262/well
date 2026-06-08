/**
 * 前端统一错误处理模块
 *
 * 使用方式:
 *   const errorHandler = require('../../utils/error-handler.js')
 *
 *   // 云函数调用
 *   errorHandler.handleCloudError(error, '加载宠物列表')
 *
 *   // 网络请求
 *   errorHandler.handleNetworkError(error, '提交症状')
 *
 *   // 安全地调用云函数（自动处理错误）
 *   errorHandler.safeCall('getPetList', { token }, function(result) {
 *     self.setData({ petList: result.data })
 *   })
 */

var logger = require('./logger.js')

// 用户友好的默认错误提示
var DEFAULT_MESSAGES = {
  network: '网络异常，请检查连接',
  cloud: '服务暂时不可用，请稍后重试',
  auth: '登录已过期，请重新打开小程序',
  notFound: '数据不存在',
  unknown: '操作失败，请稍后重试'
}

/**
 * 判断是否为认证错误
 */
function isAuthError(error) {
  if (!error) return false
  var msg = (error.errMsg || error.message || '').toLowerCase()
  return msg.indexOf('unauthorized') !== -1 ||
         msg.indexOf('token') !== -1 ||
         msg.indexOf('登录') !== -1 ||
         error.code === 401
}

/**
 * 处理云函数调用错误
 * @param {Error|object} error - 错误对象
 * @param {string} operation - 操作描述（如"加载宠物列表"）
 * @param {object} [options] - 可选配置
 * @param {boolean} [options.silent=false] - 是否静默（不显示 toast）
 * @param {string} [options.fallbackMessage] - 自定义错误提示
 */
function handleCloudError(error, operation, options) {
  options = options || {}
  var context = operation ? '[' + operation + ']' : ''
  logger.error(context + ' 云函数调用失败:', error)

  if (options.silent) return

  var message = options.fallbackMessage || DEFAULT_MESSAGES.cloud

  if (isAuthError(error)) {
    message = DEFAULT_MESSAGES.auth
  }

  wx.showToast({
    title: message,
    icon: 'none',
    duration: 3000
  })
}

/**
 * 处理网络请求错误
 */
function handleNetworkError(error, operation, options) {
  options = options || {}
  var context = operation ? '[' + operation + ']' : ''
  logger.error(context + ' 网络请求失败:', error)

  if (options.silent) return

  wx.showToast({
    title: DEFAULT_MESSAGES.network,
    icon: 'none',
    duration: 3000
  })
}

/**
 * 安全调用云函数（自动处理 loading + 错误）
 * @param {string} funcName - 云函数名
 * @param {object} data - 请求数据
 * @param {function} onSuccess - 成功回调
 * @param {object} [options] - 可选配置
 * @param {boolean} [options.showLoading=true] - 是否显示 loading
 * @param {string} [options.loadingText='加载中...'] - loading 文字
 * @param {string} [options.errorContext] - 错误上下文描述
 * @param {boolean} [options.silent=false] - 是否静默错误
 */
function safeCall(funcName, data, onSuccess, options) {
  options = options || {}
  var showLoading = options.showLoading !== false
  var loadingText = options.loadingText || '加载中...'
  var context = options.errorContext || funcName

  if (showLoading) {
    wx.showLoading({ title: loadingText, mask: true })
  }

  wx.cloud.callFunction({
    name: funcName,
    data: data,
    success: function(res) {
      if (showLoading) wx.hideLoading()

      if (res.result && res.result.code === 0) {
        onSuccess(res.result)
      } else {
        var errMsg = (res.result && res.result.msg) || DEFAULT_MESSAGES.unknown
        logger.warn('[' + funcName + '] 业务错误:', errMsg)
        if (!options.silent) {
          wx.showToast({ title: errMsg, icon: 'none', duration: 3000 })
        }
      }
    },
    fail: function(err) {
      if (showLoading) wx.hideLoading()
      handleCloudError(err, context, { silent: options.silent })
    }
  })
}

module.exports = {
  handleCloudError: handleCloudError,
  handleNetworkError: handleNetworkError,
  safeCall: safeCall,
  isAuthError: isAuthError,
  DEFAULT_MESSAGES: DEFAULT_MESSAGES
}
