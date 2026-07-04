// 微信支付云函数 - Event 函数版本
console.log('[Gateway] === Loading module ===');
const WechatPay = require('wechatpay-node-v3');
console.log('[Gateway] wechatpay-node-v3 loaded');

// 延迟初始化微信支付实例
let payInstance = null;

function getPayInstance() {
  if (!payInstance) {
    const appId = process.env.appId;
    const merchantId = process.env.merchantId;
    const merchantSerialNumber = process.env.merchantSerialNumber;
    const apiV3Key = process.env.apiV3Key;

    // env 中 \n 为字面量，统一转回真实换行（私钥 + 微信支付平台公钥）
    const unescape = (s) => (s || '').replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').trim();
    const privateKey = unescape(process.env.privateKey);
    const publicKey = unescape(process.env.wxPayPublicKey);

    console.log('[PayService] ===== 初始化微信支付实例 (V2.6) =====');
    console.log('[PayService] appId:', appId);
    console.log('[PayService] merchantId:', merchantId);
    console.log('[PayService] 私钥长度:', privateKey.length, '公钥长度:', publicKey.length);

    if (!publicKey) {
      throw new Error('未配置 wxPayPublicKey（微信支付平台公钥），无法初始化支付实例');
    }

    // wechatpay-node-v3 要求：
    //   publicKey —— 验证微信响应签名（库构造时强制，缺失会抛「缺少公钥」）
    //   key       —— APIv3 密钥（回调解密用；注意是 key 不是 partner_key）
    //   serial_no —— 商户证书序列号（请求 Authorization 头）
    const payConfig = {
      appid: appId,
      mchid: merchantId,
      privateKey: privateKey,
      serial_no: merchantSerialNumber,
      publicKey: publicKey,
      key: apiV3Key
    };

    console.log('[PayService] 配置参数:', Object.keys(payConfig));

    payInstance = new WechatPay(payConfig);
    console.log('[PayService] WechatPay 实例创建成功');
  }
  return payInstance;
}

// Event 函数入口
exports.main = async (event, context) => {
  // 添加调试日志
  console.log('[Gateway] ============ ENTRY ============');
  console.log('[Gateway] event type:', typeof event);
  console.log('[Gateway] event keys:', Object.keys(event || {}));
  console.log('[Gateway] full event:', JSON.stringify(event || {}));
  console.log('[Gateway] context:', JSON.stringify(context || {}));

  const { action, params, openid } = event || {};
  console.log('[Gateway] parsed action:', action);
  console.log('[Gateway] parsed params:', params ? 'present' : 'missing');
  console.log('[Gateway] parsed openid:', openid);

  // 路由处理
  if (action === '/wx-pay/wxpay_order') {
    console.log('[Gateway] Routing to handleWxPayOrder');
    return await handleWxPayOrder(params, openid);
  } else if (action === '/wx-pay/refund') {
    console.log('[Gateway] Routing to handleWxPayRefund');
    return await handleWxPayRefund(params, openid);
  } else {
    console.log('[Gateway] Unknown action:', action);
    return { code: -1, msg: 'Unknown action', data: null };
  }
};

/**
 * 处理微信支付下单（小程序 JSAPI 支付）
 */
async function handleWxPayOrder(params, openid) {
  try {
    const { description, out_trade_no, amount } = params;

    console.log('[Controller] payer.openid:', openid);

    const pay = getPayInstance();

    // 使用小程序 JSAPI 支付
    const result = await pay.transactions_jsapi({
      appid: process.env.appId,
      mchid: process.env.merchantId,
      description,
      out_trade_no,
      notify_url: process.env.notifyURLPayURL,
      amount: {
        total: amount.total,
        currency: amount.currency || 'CNY'
      },
      payer: {
        openid: openid || 'openid_placeholder'
      }
    });

    console.log('[PayService] unifiedOrder result:', JSON.stringify(result));

    // 实测 wechatpay-node-v3 返回 { status:200, data:{ appId,timeStamp,nonceStr,package,signType,paySign } }
    // 兼容顶层扁平结构与嵌套结构两种形态
    const payData = (result && result.data && result.data.paySign) ? result.data : result;
    if (!payData || !payData.paySign) {
      throw new Error('微信下单失败: ' + JSON.stringify(result));
    }

    return {
      code: 0,
      msg: 'success',
      data: {
        timeStamp: payData.timeStamp,
        nonceStr: payData.nonceStr,
        package: payData.package,
        signType: payData.signType || 'RSA',
        paySign: payData.paySign
      }
    };
  } catch (error) {
    console.error('[PayService] unifiedOrder error:', error);
    return {
      code: -1,
      msg: error.message || '下单失败',
      data: null
    };
  }
}

/**
 * 处理微信支付退款
 */
async function handleWxPayRefund(params, openid) {
  try {
    const { out_trade_no, out_refund_no, amount } = params;

    const pay = getPayInstance();

    const result = await pay.refund({
      appid: process.env.appId,
      mchid: process.env.merchantId,
      out_trade_no,
      out_refund_no,
      notify_url: process.env.notifyURLRefundsURL,
      amount: {
        refund: amount.refund,
        total: amount.total,
        currency: amount.currency || 'CNY'
      }
    });

    console.log('[PayService] refund success:', result);

    return {
      code: 0,
      msg: 'success',
      data: result
    };
  } catch (error) {
    console.error('[PayService] refund error:', error);
    return {
      code: -1,
      msg: error.message || '退款失败',
      data: null
    };
  }
}
