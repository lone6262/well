// 发送支付结果订阅消息通知
// 由 payCallback / processRefund 等调用
// 消息模板需在小程序后台申请，此处使用通用模板ID占位
const cloud = require('wx-server-sdk');
const { warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 订阅消息模板ID（需在小程序后台配置后替换）
const TEMPLATES = {
  PAY_SUCCESS: '',       // TODO: 填入支付成功模板ID
  MEMBER_ACTIVATED: '',  // TODO: 填入会员开通模板ID
  REFUND_SUCCESS: '',    // TODO: 填入退款成功模板ID
  ORDER_TIMEOUT: ''      // TODO: 填入订单超时模板ID
};

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { openid, templateType, data } = event;

  if (!openid || !templateType) {
    return { code: -1, msg: '参数不完整', data: {} };
  }

  const templateId = TEMPLATES[templateType];
  if (!templateId) {
    console.log('[sendPaymentNotification] 模板未配置:', templateType);
    return { code: -1, msg: '消息模板未配置', data: {} };
  }

  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: templateId,
      page: data.page || 'pages/index/index',
      data: data.templateData || {}
    });

    console.log('[sendPaymentNotification] 发送成功:', result);
    return { code: 0, msg: '发送成功', data: {} };
  } catch (error) {
    console.error('[sendPaymentNotification] 发送失败:', error.message);
    // 订阅消息失败不影响主流程，静默返回
    return { code: -1, msg: '发送失败: ' + error.message, data: {} };
  }
};
