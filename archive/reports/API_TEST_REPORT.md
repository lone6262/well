# API 接口测试自动化报告

> 日期: 2026-06-03 | 平台: 微信云开发

---

## 🔴 微信云函数 API 限制

微信云函数不是标准 REST API，无法使用 Postman/SuperTest/k6 等工具直接调用：

| 限制 | 说明 |
|------|------|
| 无 HTTP 端点 | 云函数通过 `wx.cloud.callFunction()` 调用 |
| 无 Swagger/OpenAPI | 无标准 API 文档 |
| 认证方式特殊 | 通过 `cloud.getWXContext().OPENID` 获取用户 |
| 环境绑定 | 每个云函数绑定特定云环境 |

---

## 🟢 已完成：集成测试（Mock 数据库）

通过 Mock wx-server-sdk 的方式，模拟了完整的 API 调用链：

### 已测试接口

| 云函数 | 测试文件 | 用例 | 状态 |
|--------|---------|:----:|:----:|
| silentLogin | login-flow.test.js | 24 | ✅ |
| submitSymptom | symptom-flow.test.js + 原测试 | 50 | ✅ |
| savePet / getPetList / deletePet | pet-flow.test.js | 33 | ✅ |
| getHospitals / searchHospitals | cloud_functions_test.js | 11 | ✅ |

### API 响应格式验证

所有云函数响应遵循统一格式（已验证）：

```json
{
  "code": 0,        // 0=成功, -1=错误, 401=未授权, 500=服务器错误
  "msg": "成功",
  "data": {}
}
```

### 错误处理验证

| 场景 | 预期 code | 状态 |
|------|----------|:----:|
| 参数缺失 | -1 | ✅ |
| 参数类型错误 | -1 | ✅ |
| 未登录 | 401 | ✅ |
| 资源不存在 | 404 | ✅ |
| 服务器异常 | 500 | ✅ |
| 数据库写入失败 | 500（降级） | ✅ |

---

## 🟡 可选：HTTP 触发器（需配置）

微信云开发支持为云函数配置 HTTP 触发器，配置后可以：

```bash
curl -X POST https://api.weixin.qq.com/tcb/invokecloudfunction \
  -H "Content-Type: application/json" \
  -d '{"env":"your-env","name":"submitSymptom","data":"..."}'
```

但需要使用 `access_token`（需额外获取），且有频率限制。

---

## 📊 API 性能基准

云函数冷启动 + 数据库查询的性能预估：

| 操作 | 预期耗时 | 备注 |
|------|---------|------|
| silentLogin | < 500ms | DB 查询 1 次 |
| submitSymptom | < 800ms | DB 写入 1 次 |
| getPetList | < 500ms | DB 查询 + 健康计算 |
| getHospitals | < 2000ms | 第三方 API 调用 |
| generateAIReport | < 3000ms | 模板查询 + 缓存 |
