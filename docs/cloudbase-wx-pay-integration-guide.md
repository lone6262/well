# 集成中心微信支付配置指南

本文档说明如何将 well 项目接入腾讯云 CloudBase 集成中心的微信支付服务。

---

## 📋 架构说明

```
┌─────────────────┐     1. callHTTPFunction     ┌─────────────────────┐
│  well 小程序     │ ────────────────────────────>│ 集成中心 HTTP 云函数 │
│  createOrder    │                              │ Mewora-xxx-scfweb  │
│                 │     2. 返回支付参数           │                     │
│                 │ <──────────────────────────── │  /wx-pay/wxpay_order │
└─────────────────┘                              └─────────┬───────────┘
      │                                                   │
      │ 3. requestPayment                                  │
      v                                                   v
┌─────────────────┐                              ┌─────────────────────┐
│  微信支付        │ ────────────────────────────>│ 集成中心回调         │
│  用户支付        │     4. 支付回调              │ /unifiedOrderTrigger │
└─────────────────┘                              └─────────┬───────────┘
                                                           │
                                                           │ 5. 业务处理（可选）
                                                           v
                                                  ┌─────────────────────┐
                                                  │  well payCallback   │
                                                  │  （如需自定义处理）  │
                                                  └─────────────────────┘
```

---

## 🚀 快速开始

### Step 1: 集成中心环境变量配置

在腾讯云 CloudBase 控制台为 `Mewora-50txhxhe-demo-scfweb` 云函数配置以下环境变量：

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `appId` | 小程序 AppID | `wxabcdef123456` |
| `merchantId` | 微信支付商户号 | `1234567890` |
| `merchantSerialNumber` | 商户证书序列号 | `1ABC2DEF3GHI4JKL5MNO6PQR7STU8VWX` |
| `apiV3Key` | API v3 密钥（32字节） | `abcdefghijklmnopqrstuvwxyz123456` |
| `privateKey` | 商户私钥（PEM格式） | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----` |
| `wxPayPublicKey` | 微信支付公钥（可选） | `-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----` |
| `wxPayPublicKeyId` | 公钥 ID（可选） | `PublicKeyId123` |
| `signMode` | 签名模式：`gateway` 或 `sdk` | `gateway` |
| `notifyURLPayURL` | 支付回调 URL（HTTPS） | `https://xxx.tcloudbase.com/wx-pay/unifiedOrderTrigger` |
| `notifyURLRefundsURL` | 退款回调 URL | `https://xxx.tcloudbase.com/wx-pay/refundTrigger` |
| `transferNotifyUrl` | 转账回调 URL | `https://xxx.tcloudbase.com/wx-pay/transferTrigger` |

### Step 2: 获取微信支付配置信息

#### 2.1 获取商户号和 AppID

- **商户号**：登录 [微信支付商户平台](https://pay.weixin.qq.com) → 账户中心 → 商户信息 → 商户号
- **AppID**：登录 [微信公众平台](https://mp.weixin.qq.com) → 开发管理 → 开发设置 → AppID

#### 2.2 获取 API 证书

1. 登录微信支付商户平台 → 账户中心 → API 安全 → API 证书
2. 下载证书（包含 apiclient_cert.pem 和 apiclient_key.pem）
3. **私钥内容**：打开 `apiclient_key.pem` 文件，复制全部内容（包括 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`）
4. **证书序列号**：在商户平台 API 安全页面可直接查看

#### 2.3 设置 API v3 密钥

1. 登录微信支付商户平台 → 账户中心 → API 安全 → API v3 密钥
2. 设置一个 32 字节的密钥（只能包含字母和数字）
3. **妥善保存**，密钥设置后无法查看，只能重置

#### 2.4 获取微信支付公钥（可选）

如需使用公钥验签模式：

1. 登录微信支付商户平台 → 账户中心 → API 安全 → 平台证书
2. 下载平台证书
3. 解析证书获取公钥内容（或使用微信支付提供的工具）

### Step 3: 配置回调 URL

在集成中心环境变量中配置回调 URL，格式为：

```
https://{环境ID}-{UIN}.{地区}.tcb.qcloud.com/Mewora-50txhxhe-demo-scfweb/wx-pay/unifiedOrderTrigger
```

**获取方式**：
1. 登录 [CloudBase 控制台](https://tcb.cloud.tencent.com)
2. 进入你的环境 → 静态托管 → HTTP 访问服务
3. 查看分配的访问域名

**回调 URL 要求**：
- ✅ 必须是 HTTPS 协议
- ✅ 不能是 localhost 或内网地址
- ✅ 不能携带参数（不能有 `?`）
- ✅ 域名需在微信支付商户平台配置白名单

### Step 4: well 项目配置

well 项目代码已修改完成，支持集成中心调用方式。

**确认以下配置**：

1. **miniprogram/app.js** 或调用处：
   ```javascript
   // 确保 createOrder 云函数正确调用
   wx.cloud.callFunction({
     name: 'createOrder',
     data: { type: 'report', recordId: 'xxx' }
   })
   ```

2. **createOrder 云函数**（已修改）：
   - 云函数调用名称：`Mewora-50txhxhe-demo-scfweb`
   - 调用接口：`/wx-pay/wxpay_order`

---

## 📝 API 接口说明

### 下单接口

**调用方式**：
```javascript
wx.cloud.callFunction({
  name: 'Mewora-50txhxhe-demo-scfweb',
  data: {
    _action: '/wx-pay/wxpay_order',
    description: '商品描述',
    out_trade_no: '订单号',
    amount: { total: 100, currency: 'CNY' }
  }
})
```

**响应格式**：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "data": {
      "timeStamp": "1234567890",
      "nonceStr": "abc123",
      "package": "prepay_id=wx1234567890",
      "signType": "RSA",
      "paySign": "signature_string"
    }
  }
}
```

### 其他可用接口

| 路由 | 说明 |
|------|------|
| `/wx-pay/wxpay_order` | JSAPI/小程序下单 |
| `/wx-pay/wxpay_order_h5` | H5 下单 |
| `/wx-pay/wxpay_order_native` | Native 扫码下单 |
| `/wx-pay/wxpay_query_order_by_out_trade_no` | 查询订单（商户单号） |
| `/wx-pay/wxpay_query_order_by_transaction_id` | 查询订单（微信单号） |
| `/wx-pay/wxpay_close_order` | 关闭订单 |
| `/wx-pay/wxpay_refund` | 申请退款 |
| `/wx-pay/wxpay_refund_query` | 查询退款 |

---

## 🔐 安全模式说明

### signMode 配置

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `gateway` | 网关模式：集成中心自动验签解密 | 推荐使用，简化开发 |
| `sdk` | SDK 模式：手动验签解密 | 高级场景，需要自定义处理 |

**推荐使用 `gateway` 模式**，集成中心会自动处理：
- 微信支付签名验证
- 回调解密（AES-GCM）
- 证书管理

### verifyMode 验签方式

| 模式 | 说明 | 要求 |
|------|------|------|
| `certificate` | 证书模式（SDK 自动管理） | 默认推荐 |
| `publickey` | 公钥模式（手动配置） | 需配置 `wxPayPublicKey` 和 `wxPayPublicKeyId` |

---

## 🧪 测试流程

### 1. Mock 测试模式

在测试阶段，可先使用模拟支付验证业务流程：

```javascript
// 在 createOrder 云函数中
const MOCK_PAY = true; // 测试模式

// 订单会直接标记为已支付，无需真实支付
```

### 2. 真实支付测试

1. 确保 MOCK_PAY = false
2. 使用小额金额测试（1 分）
3. 完成支付后检查：
   - 订单状态是否更新
   - 业务逻辑是否正确执行
   - 回调是否正确处理

---

## ⚠️ 常见问题

### Q1: 回调 URL 配置错误

**问题**：回调通知无法送达

**解决**：
1. 确认 URL 格式正确（HTTPS，无参数）
2. 确认域名已备案
3. 在微信支付商户平台配置支付授权目录

### Q2: 签名验证失败

**问题**：支付成功但回调验签失败

**解决**：
1. 检查 `apiV3Key` 是否正确
2. 检查 `merchantSerialNumber` 是否匹配
3. 确认 `signMode` 和 `verifyMode` 配置

### Q3: openid 获取失败

**问题**：后端无法获取用户 openid

**解决**：
- 集成中心会自动从 `x-wx-openid` header 获取 openid
- 确保前端使用 `wx.cloud.callFunction` 调用

### Q4: 金额不一致

**问题**：回调金额与订单金额不匹配

**解决**：
1. 检查下单时金额单位（分）
2. 确认无中间人篡改金额
3. 在 payCallback 中进行金额校验

---

## 📞 技术支持

- CloudBase 文档：https://docs.cloudbase.net
- 微信支付文档：https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml
- 集成中心模板：https://github.com/TencentCloudBase/cloudbase-wx-pay

---

*最后更新：2024-06-29*
