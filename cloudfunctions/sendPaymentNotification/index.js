// 发送支付结果订阅消息通知
// 由 payCallback / processRefund / closeExpiredOrders 调用
// 消息模板需在小程序后台申请，此处使用通用模板ID占位
const cloud = require('wx-server-sdk');
const { warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 订阅消息模板ID（需在小程序后台配置后替换）
const TEMPLATES = {
  PAY_SUCCESS: '',       // TODO: 填入支付成功模板ID
  MEMBER_ACTIVATED: '',  // TODO: 填入会员开通模板ID
  REFUND_SUCCESS: '',    // TODO: 填入退款成功模板ID
  ORDER_TIMEOUT: '',     // TODO: 填入订单超时模板ID
};

/**
 * 各场景对应的小程序跳转页面
 */
const PAGES = {
  PAY_SUCCESS: 'pages/order/detail',
  MEMBER_ACTIVATED: 'pages/member/status',
  REFUND_SUCCESS: 'pages/order/detail',
  ORDER_TIMEOUT: 'pages/index/index',
};

/**
 * 构造订阅消息模板数据
 */
function buildTemplateData(templateType, params) {
  const now = new Date();
  const timeStr = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');

  switch (templateType) {
    case 'PAY_SUCCESS':
      return {
        thing1: { value: (params.productName || '健康报告').substring(0, 20) },
        amount2: { value: params.amountDisplay || '0.00' },
        time3: { value: timeStr },
      };

    case 'MEMBER_ACTIVATED':
      return {
        thing1: { value: (params.memberType || '月度会员').substring(0, 20) },
        thing2: { value: params.expireDate || timeStr },
        amount3: { value: params.amountDisplay || '0.00' },
      };

    case 'REFUND_SUCCESS':
      return {
        thing1: { value: (params.productName || '健康报告').substring(0, 20) },
        amount2: { value: params.amountDisplay || '0.00' },
        time3: { value: timeStr },
      };

    case 'ORDER_TIMEOUT':
      return {
        thing1: { value: (params.productName || '订单').substring(0, 20) },
        time2: { value: timeStr },
      };

    default:
      return params.templateData || {};
  }
}

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
    const templateData = buildTemplateData(templateType, data || {});
    const page = (data && data.page) || PAGES[templateType] || 'pages/index/index';

    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: templateId,
      page: page,
      data: templateData,
    });

    console.log('[sendPaymentNotification] 发送成功:', templateType, result);
    return { code: 0, msg: '发送成功', data: {} };
  } catch (error) {
    console.error('[sendPaymentNotification] 发送失败:', templateType, error.message);
    // 订阅消息失败不影响主流程，静默返回
    return { code: -1, msg: '发送失败: ' + error.message, data: {} };
  }
};
