# AutoTest V3 API 接口测试报告

> 生成日期: 2026-07-10
> 分支: `fix/code-review-remediation`
> 范围: 84 个云函数（即后端 API）接口测试覆盖矩阵

---

## 1. API 测试架构

本项目后端为**微信云函数**，无独立 REST 服务，云函数即 API。接口测试分三层：

| 层次 | 工具 | 覆盖内容 | 用例数 |
|------|------|---------|--------|
| **L1 响应码契约** | `cloud_functions_test.js` | 全量云函数响应结构/状态码一致性 | 118 |
| **L2 业务逻辑** | `__tests__/unit/*.test.js` | 核心函数分支逻辑（Mock DB） | 1372 |
| **L3 链路集成** | `__tests__/integration/*.test.js` | 跨函数业务流（登录/支付/宠物/症状） | 205 |
| **L4 真机联调** | 微信开发者工具 | 真实云环境端到端 | 手动 |

> L1-L3 已自动化；L4 需真实云环境 + AppID，列为发布前手动项。

## 2. 云函数 API 覆盖矩阵

### 2.1 已深度覆盖（L2 业务逻辑 ✅）

| 云函数 | 覆盖测试 | 覆盖点 | 本轮新增 |
|--------|---------|--------|---------|
| `searchFoodSafety` | searchFoodSafety.test.js | 鉴权/限流/正则转义/分页/结果格式 | ⭐ 是 |
| `submitSymptom` | submit-symptom-enhanced.test.js | 风险评级规则引擎/敏感词/白名单 | — |
| `checkRiskControl` | risk-control.test.js | 刷量/邀请爆发/人工审核阈值 | — |
| `createOrder` / `generateAIReport` | quota-service.test.js | 额度解析/扣减/回滚（计费核心） | ⭐ 是 |

### 2.2 已链路覆盖（L3 集成 ✅）

| 业务流 | 涉及云函数 | 测试 |
|--------|-----------|------|
| 登录 | silentLogin | login-flow.test.js |
| 支付回调 | payCallback / createOrder | pay-callback-flow.test.js |
| 宠物 | savePet / deletePet / getPetList | pet-flow.test.js |
| 症状 | submitSymptom / generateAIReport | symptom-flow.test.js |

### 2.3 契约覆盖（L1 响应码 ✅，L2 待补）

以下云函数经 `cloud_functions_test.js` 验证响应结构一致性，但**业务分支逻辑尚未单测**（依赖真实 DB，建议后续按域补测）：

| 域 | 云函数 |
|----|--------|
| 会员 | getMemberStatus, cancelMembership, renewMemberByAuto, toggleAutoRenew, checkExpiredMembers, clearMemberData |
| 订单/退款 | cancelOrder, closeExpiredOrders, requestRefund, processRefund, refundPoint, orderDetail, orderList, checkDailyBill |
| 点数 | getPointsBalance, getPointTransactions, consumePoint |
| 优惠券 | applyCoupon, getCoupons, getUserCoupons, receiveCoupon, autoIssueCoupon, rollbackCoupon, expireCoupons |
| 食物/知识 | getFoodCategories, getKnowledgeList, getKnowledgeDetail, searchKnowledge |
| 医院 | getHospitals, searchHospitals |
| 邀请/家庭 | createInvite, inviteFamilyMember, acceptFamilyInvite, removeFamilyMember, getFamilyMembers, getInviteRanking, getInviteStats, processInviteReward |
| 随访 | followupSubmit, getFollowupDetail, getFollowupList |
| 用户/反馈 | saveUserProfile, getUserStats, decryptPhone, saveFeedback, trackEvent |
| 通知/工具 | sendPaymentNotification, sendExpireReminder, generateSharePoster, cleanExpiredCache |
| 管理后台 | adminLogin, adminGateway + 12 个 admin* CRUD |

## 3. 接口安全测试（本轮重点）

对应提交 `0cbd677`（食物安全查询安全加固）：

| 安全项 | 测试用例 | 结果 |
|--------|---------|------|
| 匿名访问拦截 | searchFoodSafety 无 token → 401 | ✅ searchFoodSafety.test.js #1 |
| 正则注入 / ReDoS | 13 种元字符输入 → 全转义、不卡顿 | ✅ #3 |
| 速率限制 | 限流触发 → 拒绝 | ✅ #2 |
| 输入边界 | page/pageSize 非法值 clamp | ✅ #5-7 |
| 错误信息不泄露 | DB 异常 → 通用 SERVER_ERROR | ✅ #10 |
| 鉴权 Token | HMAC 签名校验 | ✅ auth.test.js |
| 管理员鉴权 | JWT (HMAC-SHA256) | ✅ admin-auth.test.js |

## 4. 性能/压力测试（手动建议）

云函数 SCF 有 **3s 超时**限制（见 [[wx-pay-integration-gotchas]]），建议发布前手动压测：

| 接口 | 关注点 | 建议指标 |
|------|--------|---------|
| generateAIReport | DeepSeek 调用耗时 | P95 < 2800ms（留 200ms 余量）|
| searchFoodSafety | 正则查询 | 1000 条数据 < 500ms |
| submitSymptom | 规则引擎 | < 200ms |
| payCallback | 回调链路 | < 2500ms（网关转发 + SCF）|

## 5. 覆盖率统计

| 指标 | 值 |
|------|-----|
| 云函数总数 | 84 |
| L1 响应码覆盖 | 84（100%）|
| L2 深度逻辑覆盖 | 4 核心 + 4 链路涉及（计费核心 100%）|
| 自动化接口断言总数 | 118 (L1) + 1372 (L2) + 205 (L3) = **1695** |
| 本轮新增 | searchFoodSafety 38 + quota-service 73 = **111** |

## 6. 结论与建议

- ✅ **计费核心 + 近期安全修复**已闭环覆盖（本轮重点）
- ⚠️ **会员/订单/优惠券域**仅 L1 契约覆盖，建议下轮按域补 L2 单测（参考 quota-service.test.js 的 Mock 模式）
- 📋 **真机联调**为发布前必跑项（见 E2E 报告 P0 清单）
