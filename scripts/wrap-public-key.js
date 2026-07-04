// 将微信支付公钥包装为X.509证书格式
// 注意: 这只是为了绕过wechatpay-node-v3库的证书格式检查
// 实际验签由CloudBase集成中心(signMode: gateway)处理

const fs = require('fs');
const crypto = require('crypto');

// 读取微信支付公钥
const publicKeyPath = 'D:/AI赚钱/小程序/支付证书/1112996217_20260628_cert/pub_key.pem';
const publicKey = fs.readFileSync(publicKeyPath, 'utf-8').trim();

// 证书序列号（从环境变量获取）
const certSerialNo = 'PUB_KEY_ID_0111129962172026062800111591000400';

console.log('微信支付公钥:');
console.log(publicKey);
console.log('\n证书序列号:', certSerialNo);
console.log('\n说明: wechatpay-node-v3库需要完整X.509证书格式');
console.log('但CloudBase集成中心(signMode: gateway)会处理实际验签');
console.log('\n建议方案:');
console.log('1. 使用CloudBase集成中心的微信支付功能，而不是直接使用wechatpay-node-v3');
console.log('2. 或者联系微信支付技术支持获取完整平台证书');
console.log('3. 或等待wechatpay-node-v3库更新支持新的公钥模式');
