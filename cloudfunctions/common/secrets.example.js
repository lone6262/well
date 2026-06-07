/**
 * 服务端密钥配置模板
 *
 * 使用方法：
 *   1. 复制本文件为 secrets.js
 *   2. 替换下面的值为真实密钥
 *   3. secrets.js 已加入 .gitignore，不会被提交到 Git
 *   4. 部署时确保 secrets.js 随云函数一起上传
 */
module.exports = {
  // JWT 签名密钥 — 替换为自己的随机字符串（建议 32 位以上）
  TOKEN_SECRET: 'your-random-secret-key-here',

  // 腾讯地图 API Key — 替换为 https://lbs.qq.com 申请的 Key
  TENCENT_MAP_KEY: 'YOUR_TENCENT_MAP_KEY_HERE',

  // DeepSeek AI API Key — 替换为 https://platform.deepseek.com 申请的 Key
  DEEPSEEK_API_KEY: 'YOUR_DEEPSEEK_API_KEY_HERE',

  // DeepSeek API 地址（通常不需要修改）
  DEEPSEEK_BASE_URL: 'https://api.deepseek.com',

  // DeepSeek 模型名称（通常不需要修改）
  DEEPSEEK_MODEL: 'deepseek-chat'
};
