/**
 * 统一API调用层
 * 封装 wx.cloud.callFunction，提供一致的错误处理和响应格式
 *
 * 使用方式:
 *   const api = require('../../utils/api.js')
 *   const result = await api.call('savePet', { name: '小咪', type: 'cat' })
 *   if (result.success) {
 *     // 使用 result.data
 *   }
 */

let app = getApp();

/**
 * API响应标准化
 * @typedef {Object} ApiResult
 * @property {boolean} success - 调用是否成功
 * @property {*} data - 响应数据
 * @property {string} msg - 消息
 * @property {number} code - 响应码
 */

/**
 * 调用云函数
 * @param {string} name - 云函数名称
 * @param {Object} data - 请求参数（openid 由云函数服务端自动获取，无需传递）
 * @param {Object} options - 可选配置
 * @param {boolean} options.requireLogin - 是否需要登录（默认true）
 * @param {boolean} options.showError - 是否自动显示错误提示（默认false）
 * @returns {Promise<ApiResult>}
 */
function call(name, data, options) {
  options = options || {};
  let requireLogin = options.requireLogin !== false;
  let showError = options.showError || false;

  return new Promise(function(resolve) {
    // 如果需要登录但没有openid，等待登录完成
    if (requireLogin && !app.globalData.openid) {
      app.onLoginComplete(function() {
        _doCall(name, data, showError, resolve);
      });
    } else {
      _doCall(name, data, showError, resolve);
    }
  });
}

/**
 * 执行实际的云函数调用
 */
function _doCall(name, data, showError, resolve) {
  let requestData = data;

  // 检查云开发是否可用
  if (!app.globalData.cloudDevelopmentAvailable) {
    console.warn('[API] 云开发不可用，使用降级模式: ' + name);
    resolve({
      success: false,
      code: -1,
      msg: '云开发不可用',
      data: null
    });
    return;
  }

  wx.cloud.callFunction({
    name: name,
    data: requestData,
    success: function(res) {
      let result = res.result || {};

      if (result.code === 0) {
        resolve({
          success: true,
          code: result.code,
          msg: result.msg || '成功',
          data: result.data || {}
        });
      } else {
        if (showError) {
          wx.showToast({
            title: result.msg || '操作失败',
            icon: 'none',
            duration: 2000
          });
        }
        resolve({
          success: false,
          code: result.code || -1,
          msg: result.msg || '操作失败',
          data: result.data || null
        });
      }
    },
    fail: function(err) {
      console.error('[API] 云函数调用失败:', name, err);

      // 标记云开发不可用（仅精确匹配网络/服务不可用错误码）
      if (err.errCode === -1 || err.errCode === -404011) {
        app.globalData.cloudDevelopmentAvailable = false;
      }

      if (showError) {
        wx.showToast({
          title: '网络异常，请重试',
          icon: 'none',
          duration: 2000
        });
      }

      resolve({
        success: false,
        code: -1,
        msg: err.errMsg || '网络异常',
        data: null
      });
    }
  });
}

/**
 * 批量调用云函数（并行执行）
 * @param {Array<{name: string, data: Object}>} requests
 * @returns {Promise<Array<ApiResult>>}
 */
function batchCall(requests) {
  let promises = requests.map(function(req) {
    return call(req.name, req.data, req.options);
  });
  return Promise.all(promises);
}

module.exports = {
  call: call,
  batchCall: batchCall
};
