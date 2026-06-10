# AutoTest V2 测试策略文档

> 生成日期: 2026-06-10
> 方法论: TDD（红-绿-重构）
> 目标覆盖率: 80%+
> 实际测试数: 1360 tests (14 files)

---

## 1. TDD 方法论

本测试采用经典的红-绿-重构循环：

```
🔴 RED    → 先写失败的测试
🟢 GREEN  → 写最小实现让测试通过
🔵 REFACTOR → 重构代码，保持测试通过
```

### 项目适配

| 层次 | 可测试性 | 测试方式 |
|------|---------|---------|
| **纯逻辑函数** | ✅ 完全可测 | 标准 Node.js 单元测试 |
| **云函数入口** | ⚠️ 需要 Mock | Mock wx-server-sdk |
| **前端页面** | ❌ 需微信环境 | 语法检查 + 手动测试 |
| **E2E** | ❌ 微信封闭环境 | 手动测试清单替代 |

---

## 2. 测试文件组织

```
__tests__/
├── TEST_STRATEGY_V2.md            # 本文档 (V2 更新)
├── TEST_STRATEGY.md               # 原始策略文档
├── TEST_REPORT.md                 # 历史测试报告
├── E2E_REPORT_V2.md               # E2E 评估报告 (新增)
├── API_TEST_REPORT_V2.md          # API 测试报告 (新增)
├── QA_TEST_PLAN_V2.md             # QA 测试计划 (新增)
├── cloud_functions_test.js        # 综合测试 (118 cases)
├── unit/
│   ├── auth.test.js               # 认证模块 (41 cases) ✅
│   ├── error-handler.test.js      # 错误处理 (69 cases) ✅
│   ├── rate-limiter.test.js       # 限流器 (16 cases) ✅
│   ├── report-engine.test.js      # 报告引擎 (60 cases) ✅
│   ├── logger.test.js             # 日志脱敏 (108 cases) ✅ 新增
│   ├── admin-auth.test.js         # 管理员认证 (71 cases) ✅ 新增
│   ├── submit-symptom-enhanced.test.js  # 症状评估增强 (220 cases) ✅ 新增
│   ├── risk-control.test.js       # 风控模块 (57 cases) ✅ 新增
│   └── constants-v15.test.js      # 常量完整性 (395 cases) ✅ 新增
├── integration/
│   ├── login-flow.test.js         # 登录流程 (24 cases) ✅
│   ├── symptom-flow.test.js       # 症状评估流程 (30 cases) ✅
│   ├── pet-flow.test.js           # 宠物管理流程 (33 cases) ✅
│   └── pay-callback-flow.test.js  # 支付回调流程 (118 cases) ✅ 新增
└── output/
    └── latest-results.txt         # 最新测试结果
```

---

## 3. 覆盖率矩阵

### 后端模块覆盖率

| 模块 | 文件 | 测试文件 | 测试数 | 覆盖率 | 状态 |
|------|------|----------|--------|--------|------|
| 认证 | common/auth.js | auth.test.js | 41 | ~95% | ✅ 完整 |
| 管理员认证 | common/admin-auth.js | admin-auth.test.js | 71 | ~95% | ✅ 完整 |
| 常量 | common/constants.js | constants-v15.test.js | 395 | ~100% | ✅ 完整 |
| 错误处理 | common/error-handler.js | error-handler.test.js | 69 | ~100% | ✅ 完整 |
| 日志 | common/logger.js | logger.test.js | 108 | ~95% | ✅ 完整 |
| 限流 | common/rate-limiter.js | rate-limiter.test.js | 16 | ~85% | ✅ 完整 |
| 报告引擎 | common/report-engine.js | report-engine.test.js | 60 | ~85% | ✅ 完整 |
| 症状评估 | submitSymptom/ | submit-symptom-enhanced.test.js | 220 | ~90% | ✅ 完整 |
| 风控 | checkRiskControl/ | risk-control.test.js | 57 | ~85% | ✅ 完整 |
| 支付回调 | payCallback/ | pay-callback-flow.test.js | 118 | ~80% | ✅ 完整 |
| 订单创建 | createOrder/ | (集成测试覆盖) | - | ~50% | ⚠️ 部分 |
| 登录 | login/silentLogin/ | login-flow.test.js | 24 | ~80% | ✅ 良好 |

### 前端覆盖情况

| 区域 | 可测试性 | 状态 |
|------|---------|------|
| miniprogram/pages/ (30 files) | ❌ 需微信环境 | 手动测试 |
| admin/js/ (14 files) | ⚠️ 浏览器环境 | 待补充 |

---

## 4. 新增测试明细 (V2)

### 新增 6 个测试文件, 新增 969 个测试用例

| 新增文件 | 类型 | 测试数 | 覆盖内容 |
|----------|------|--------|----------|
| logger.test.js | 单元 | 108 | 日志级别控制 + 敏感字段脱敏 |
| admin-auth.test.js | 单元 | 71 | Token 生成/验证 + 请求校验 |
| submit-symptom-enhanced.test.js | 单元 | 220 | 规则引擎 + 白名单 + 敏感词 + 长度限制 |
| risk-control.test.js | 单元 | 57 | 频率限制 + 刷量检测 + 大额审核 |
| pay-callback-flow.test.js | 集成 | 118 | 支付回调全链路 + 会员激活 + 点数到账 |
| constants-v15.test.js | 单元 | 395 | 所有 V1.5 常量完整性验证 |

---

## 5. 测试优先级排序

### P0 (阻塞发布) — 全部完成 ✅
1. ✅ auth.js Token 生成/验证 (41 tests)
2. ✅ admin-auth.js 管理员认证 (71 tests)
3. ✅ error-handler.js 响应格式 (69 tests)
4. ✅ report-engine.js 核心逻辑 (60 tests)
5. ✅ constants.js 常量完整性 (395 tests)
6. ✅ submitSymptom 规则引擎 + 白名单 + 敏感词 (220 tests)
7. ✅ 登录流程集成测试 (24 tests)

### P1 (发布前完成) — 全部完成 ✅
8. ✅ rate-limiter.js 限流逻辑 (16 tests)
9. ✅ logger.js 日志脱敏 (108 tests)
10. ✅ checkRiskControl 风控逻辑 (57 tests)
11. ✅ 症状评估集成测试 (30 tests)
12. ✅ 宠物管理集成测试 (33 tests)
13. ✅ 支付回调集成测试 (118 tests)

### P2 (发布后补充)
14. ⚠️ createOrder 订单创建完整测试
15. ⚠️ 会员系统完整流程测试
16. ⚠️ 优惠券系统测试
17. ⚠️ admin/ 管理后台 JS 测试

---

## 6. Mock 策略

```
wx-server-sdk
  ├── cloud.init()          → 空函数
  ├── cloud.database()      → 返回 mock 数据库对象
  │   ├── collection()      → 返回 CRUD mock
  │   ├── command           → mock 查询命令
  └── cloud.getWXContext()  → 返回 { OPENID: 'test_xxx' }

crypto (Node.js 内置)      → 直接使用，无需 mock
外部 API (DeepSeek)         → mock HTTP 响应
微信支付                    → MOCK_PAY=true 模式测试
```

---

## 7. 运行命令

```bash
# 运行全部测试
for f in __tests__/unit/*.test.js __tests__/integration/*.test.js __tests__/cloud_functions_test.js; do
  node "$f"
done

# 运行单个模块
node __tests__/unit/logger.test.js
node __tests__/unit/admin-auth.test.js
node __tests__/integration/pay-callback-flow.test.js
```

---

## 8. 质量指标

| 指标 | 数值 | 目标 | 状态 |
|------|------|------|------|
| 总测试数 | 1360 | 500+ | ✅ 超额 |
| 测试通过率 | 100% | 100% | ✅ 达标 |
| 测试文件数 | 14 | 10+ | ✅ 达标 |
| P0 模块覆盖率 | ~95% | 90% | ✅ 达标 |
| P1 模块覆盖率 | ~85% | 80% | ✅ 达标 |
| 新增测试 (V2) | 969 | 500+ | ✅ 超额 |
