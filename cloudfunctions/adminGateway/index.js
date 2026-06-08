/**
 * 管理后台 API 网关
 * 单一 HTTP 触发器，内部转发到各个 admin 云函数
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 允许的路由映射
const ROUTES = {
  adminLogin:       'adminLogin',
  adminGetUsers:    'adminGetUsers',
  adminGetOrders:   'adminGetOrders',
  adminUpdateOrder: 'adminUpdateOrder',
  adminGetArticles: 'adminGetArticles',
  adminSaveArticle: 'adminSaveArticle',
  adminDeleteArticle: 'adminDeleteArticle',
  adminGetStats:    'adminGetStats',
  adminGetConfig:   'adminGetConfig',
  adminUpdateConfig:'adminUpdateConfig'
};

exports.main = async (event, context) => {
  // HTTP 触发器：body 是 JSON 字符串，需要解析
  let body = event;
  if (typeof event.body === 'string') {
    try { body = JSON.parse(event.body); } catch(e) { body = event; }
  }

  // 从请求 path 或 action 字段获取目标函数名
  const path = (event.path || '').replace(/^\//, '');
  const action = body.action || path || 'adminLogin';

  // 验证路由
  const targetFunction = ROUTES[action];
  if (!targetFunction) {
    return {
      code: 404,
      msg: 'Unknown action: ' + action,
      data: {}
    };
  }

  try {
    const result = await cloud.callFunction({
      name: targetFunction,
      data: body
    });
    return result.result;
  } catch (err) {
    console.error('[adminGateway] 调用失败:', targetFunction, err);
    return {
      code: 500,
      msg: '内部错误: ' + (err.message || 'unknown'),
      data: {}
    };
  }
};
