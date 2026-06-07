/**
 * 统一错误响应格式模块
 * 确保所有云函数返回一致的数据结构
 *
 * 使用方式：
 *   const { success, error, unauthorized, serverError } = require('../common/error-handler');
 *   return success({ orderId: 'xxx' }, '订单创建成功');
 *   return error('参数错误');
 *   return unauthorized('请先登录');
 *   return serverError('数据库异常');
 */

const { RESPONSE_CODE } = require('./constants');

/**
 * 成功响应
 * @param {*} data - 响应数据
 * @param {string} msg - 成功消息
 */
function success(data, msg) {
  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: msg || '成功',
    data: data || {}
  };
}

/**
 * 业务错误响应
 * @param {string} msg - 错误消息
 * @param {*} data - 附加数据（可选）
 */
function error(msg, data) {
  return {
    code: RESPONSE_CODE.ERROR,
    msg: msg || '操作失败',
    data: data || {}
  };
}

/**
 * 未授权响应
 * @param {string} msg - 提示消息
 */
function unauthorized(msg) {
  return {
    code: RESPONSE_CODE.UNAUTHORIZED,
    msg: msg || '用户未登录',
    data: {}
  };
}

/**
 * 服务器错误响应
 * @param {string} msg - 错误描述
 * @param {*} errData - 错误详情（可选，不要泄露敏感信息）
 */
function serverError(msg, errData) {
  return {
    code: RESPONSE_CODE.SERVER_ERROR,
    msg: msg || '服务器错误',
    data: errData || {}
  };
}

module.exports = { success, error, unauthorized, serverError };
