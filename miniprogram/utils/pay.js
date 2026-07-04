// 统一封装 wx.requestPayment，所有真实购买入口复用
// 设计令牌见 utils/design-tokens.wxss；无样式，仅工具函数。

/**
 * 调起微信支付
 * @param {object} payParams - createOrder 返回的支付参数 { timeStamp, nonceStr, package, signType, paySign }
 * @returns {Promise<void>} resolve=支付成功；reject=支付失败/取消（带 errMsg）
 */
function invokePayment(payParams) {
  return new Promise((resolve, reject) => {
    if (!payParams || !payParams.paySign) {
      reject(new Error('支付参数缺失'))
      return
    }
    wx.requestPayment({
      timeStamp: String(payParams.timeStamp),
      nonceStr: payParams.nonceStr,
      package: payParams.package || (payParams.prepay_id ? 'prepay_id=' + payParams.prepay_id : ''),
      signType: payParams.signType || 'RSA',
      paySign: payParams.paySign,
      success: function () {
        resolve()
      },
      fail: function (err) {
        reject(err)
      }
    })
  })
}

module.exports = {
  invokePayment: invokePayment
}
