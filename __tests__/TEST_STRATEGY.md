# AutoTest 测试策略文档

> 生成日期: 2026-06-03
> 方法论: TDD（红-绿-重构）
> 目标覆盖率: 80%+

---

## 1. TDD 方法论

本测试采用经典的红-绿-重构循环：

```
🔴 RED    → 先写失败的测试
🟢 GREEN  → 写最小实现让测试通过
🔵 REFACTOR → 重构代码，保持测试通过
```

### 项目适配

由于本项目是微信小程序云开发架构，测试分为三个层次：

| 层次 | 可测试性 | 测试方式 |
|------|---------|---------|
| **纯逻辑函数** | ✅ 完全可测 | 标准 Node.js 单元测试 |
| **云函数入口** | ⚠️ 需要 Mock | Mock wx-server-sdk |
| **前端页面** | ❌ 需微信环境 | 语法检查 + 手动测试 |
| **E2E** | ❌ 微信封闭环境 | 不适用（见E2E说明） |

---

## 2. 测试层次规划

### 第一层：单元测试（L1）

测试目标：所有纯逻辑函数

| 模块 | 函数 | 覆盖目标 | 优先级 |
|------|------|---------|--------|
| **common/auth.js** | `generateToken`, `verifyToken`, `authenticate`, `createSignature`, `getOpenid` | 90% | P0 |
| **common/constants.js** | 所有常量导出完整性 | 100% | P0 |
| **common/error-handler.js** | `success`, `error`, `unauthorized`, `serverError` | 100% | P0 |
| **common/report-engine.js** | `generateCacheKey`, `getAgeRange`, `fillTemplate`, `generateReport`, `selectTemplate`, `cleanExpiredCache` | 85% | P0 |
| **common/rate-limiter.js** | `checkRateLimit` | 80% | P1 |
| **common/db.js** | 数据库初始化 | 90% | P1 |
| **common/logger.js** | `debug`, `info`, `warn`, `error`, `setLevel`, `getLevel` | 100% | P1 |
| **submitSymptom** | 风险评估引擎 `evaluateRisk` | 95% | P0 |
| **silentLogin** | Token 生成/验证流程 | 90% | P0 |
| **searchHospitals** | `calculateDistance`, `check24Hours`, `formatPhoneNumber` | 95% | P1 |
| **getPetList** | `calculateHealthStatus` | 90% | P1 |
| **sensitiveWords** | `checkSensitiveWords` | 85% | P1 |
| **offlineData** | 所有 getter 函数 | 90% | P2 |
| **mini/logger** | 前端 logger 功能 | 100% | P2 |

### 第二层：集成测试（L2）

测试目标：云函数完整调用链（Mock 数据库）

| 场景 | 涉及云函数 | 优先级 |
|------|-----------|--------|
| 用户登录流程 | silentLogin → login | P0 |
| 症状评估流程 | submitSymptom → generateAIReport | P0 |
| 宠物管理流程 | savePet → getPetList → deletePet | P1 |
| 医院搜索流程 | searchHospitals → getHospitals | P1 |
| 订单流程 | createOrder → payCallback → orderDetail | P2 |
| 会员流程 | createInvite → processInviteReward → memberActivate | P2 |

### 第三层：E2E 测试（L3）

⚠️ **微信小程序限制**：无法使用 Playwright/Cypress 进行标准 E2E 测试。

替代方案：
- 微信开发者工具自动化录制
- 真机调试手动测试清单
- 云函数可通过 HTTP 触发器调用（需配置）

---

## 3. Mock 策略

```
wx-server-sdk
  ├── cloud.init()          → 空函数
  ├── cloud.database()      → 返回 mock 数据库对象
  │   ├── collection()      → 返回 CRUD mock
  │   ├── command           → mock 查询命令
  └── cloud.getWXContext() → 返回 { OPENID: 'test_xxx' }

crypto (Node.js 内置)      → 直接使用，无需 mock
外部 API (腾讯地图)         → mock HTTP 响应
```

---

## 4. 覆盖率缺口分析

### 已有覆盖（118 测试用例）
- submitSymptom 规则引擎: 20 tests ✅
- silentLogin Token: 12 tests ✅
- searchHospitals 距离计算: 11 tests ✅
- getPetList 健康状态: 4 tests ✅
- constants 常量完整性: 33 tests ✅
- sensitiveWords 敏感词: 7 tests ✅
- logger 模块: 6 tests ✅
- offlineData 模块: 16 tests ✅
- 响应码一致性: 9 tests ✅

### 覆盖缺口（需补充）
| 模块 | 缺口 | 新增用例数 |
|------|------|-----------|
| common/auth.js | 无测试 | ~15 |
| common/error-handler.js | 无测试 | ~12 |
| common/report-engine.js | 无测试 | ~20 |
| common/rate-limiter.js | 无测试 | ~8 |
| common/db.js | 无测试 | ~5 |
| 集成测试 | 无 | ~15 |
| **合计** | | **~75** |

---

## 5. 测试优先级排序

**P0 (阻塞发布)**
1. auth.js Token 生成/验证
2. error-handler.js 响应格式
3. report-engine.js 核心逻辑
4. submitSymptom 规则引擎（已有）
5. 登录流程集成测试

**P1 (发布前完成)**
6. rate-limiter.js
7. db.js 数据库初始化
8. 症状评估集成测试
9. 宠物管理集成测试

**P2 (发布后可补充)**
10. 医院搜索集成测试
11. 订单/会员流程测试
12. 前端页面逻辑测试

---

## 6. 测试文件组织

```
__tests__/
├── TEST_STRATEGY.md          # 本文档
├── TEST_REPORT.md            # 历史测试报告
├── cloud_functions_test.js   # 已有测试 (118 cases)
├── unit/
│   ├── auth.test.js          # 认证模块单元测试 ← 新增
│   ├── error-handler.test.js # 错误处理单元测试 ← 新增
│   ├── report-engine.test.js # 报告引擎单元测试 ← 新增
│   └── rate-limiter.test.js  # 限流器单元测试 ← 新增
├── integration/
│   ├── login-flow.test.js    # 登录流程集成测试 ← 新增
│   ├── symptom-flow.test.js  # 症状评估集成测试 ← 新增
│   └── pet-flow.test.js      # 宠物管理集成测试 ← 新增
└── output/
    └── latest-results.txt    # 最新测试结果
```
