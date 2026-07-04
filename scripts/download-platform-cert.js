// 下载微信支付平台证书脚本
// 使用方法: node scripts/download-platform-cert.js

const fs = require('fs');
const path = require('path');
const WechatPay = require('wechatpay-node-v3');

// 从环境变量或配置读取
const config = {
  appid: 'wxee33a0c47421db2c',
  mchid: '1112996217',
  serialNo: '15ec668c4125526e06e3f95cfa1ce450021a6beb',
  privateKey: fs.readFileSync('D:/AI赚钱/小程序/支付证书/1112996217_2026062822_cert/apiclient_key.pem', 'utf-8'),
  apiv3PrivateKey: 'Mewora20260628137286103232676988'
};

async function downloadPlatformCert() {
  console.log('开始下载微信支付平台证书...\n');

  const pay = new WechatPay(config);

  try {
    // 调用获取证书列表接口
    const certs = await pay.getSerialNo();

    console.log('获取到的平台证书:');
    console.log('证书数量:', Object.keys(certs).length);
    console.log('');

    // 保存证书文件
    const certDir = path.join(__dirname, '../certs');
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    for (const [serialNo, cert] of Object.entries(certs)) {
      const filename = `wechatpay_cert_${serialNo}.pem`;
      const filepath = path.join(certDir, filename);

      // cert 可能是对象，需要提取 publicKey
      const publicKey = cert.publicKey || cert;

      fs.writeFileSync(filepath, publicKey);
      console.log(`✅ 证书已保存:`);
      console.log(`   文件: ${filename}`);
      console.log(`   序列号: ${serialNo}`);
      console.log(`   路径: ${filepath}`);
      console.log('');
    }

    console.log('下载完成！');
    console.log('\n请将证书内容配置到云函数环境变量 wxPayPublicKey 中');
    console.log('证书序列号配置到 wxPayPublicKeyId');

  } catch (error) {
    console.error('下载失败:', error.message);
    console.error('\n详细错误:', error);
  }
}

downloadPlatformCert();
