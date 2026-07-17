# 测试策略 V4 — 优惠券模块（AutoTest 产出）

> 生成时间：2026-07-16 · 对应分支：`fix/code-review-remediation`
> 聚焦本次变更：优惠券三端打通（点数/会员/报告 + 管理后台录入展示）

## 1. TDD 方法论

采用 **RED → GREEN → REFACTOR**，但因优惠券业务代码**已实现并上线在即**（修复分支），本次为**回溯式 TDD（characterization tests）**：先以既有实现为基准固化行为，再驱动发现的缺陷修复。优先级：

1. 先锁定「折扣口径不变量」（防回归）—— 最高优先级
2. 再覆盖纯函数边界与异常输入
3. 最后云函数集成（mock DB）

## 2. 测试层次

| 层次 | 目标 | 工具 | 可行性 |
|------|------|------|--------|
| 单元（纯函数） | `coupon-helper.js` 的 5 个导出 | 自研框架 + `node` | ✅ 直接 require，无 SDK 依赖 |
| 单元（口径一致性） | 三端折扣公式同输入同输出 | 自研框架 | ✅ 复制三端字面公式比对 |
| 集成（云函数） | `applyCoupon` 校验链 + 折扣计算 | 自研框架 + `Module._load` mock | ✅ mock wx-server-sdk + DB 链 |
| API（云函数真实） | createOrder/applyCoupon 真实调用 | tcb CLI / 云开发 | ⚠️ 需 CloudBase 环境+密钥，本次只产出用例清单 |
| E2E（小程序） | 下单选券→抵扣→支付 | miniprogram-automator | ⚠️ 需微信开发者工具自动化，产出手动用例+脚本骨架 |

> **平台适配说明**：小程序运行于微信客户端而非浏览器，Playwright/Cypress 无法驱动；云函数需真实 CloudBase 环境+密钥。遵循「适配优先」原则，E2E/API 真跑部分降级为「用例 + 骨架 + 手动执行清单」，核心逻辑回归由单元/集成测试保障。

## 3. 覆盖率目标

- `coupon-helper.js` 纯函数：**行覆盖 ≥ 95%**（5 函数全分支）
- 三端公式一致性：**输入矩阵 100%**（fixed / percent 正常 / 脏数据 / 边界）
- `applyCoupon`：**主路径 + 6 个失败分支**（参数缺失/券不存在/非本人/已用/过期/模板失效/类型不符/未达门槛）

项目无 jest-cov，覆盖率以**用例矩阵覆盖**（手动统计分支命中）。

## 4. 优先级排序

| P | 被测对象 | 风险 | 用例文件 |
|---|---------|------|---------|
| P0 | 三端折扣公式一致性 | 分叉→用户被多扣/少扣钱 | `coupon-discount-consistency.test.js` |
| P0 | coupon-helper 纯函数 | 前端展示与实付不一致 | `coupon-helper.test.js` |
| P1 | applyCoupon 云函数校验链 | 越权/无效券被用 | `coupon-apply-mocked.test.js` |
| P2 | createOrder.autoSelectCoupon | 指定券优先/自动选最优 | 纳入一致性测试 + 手动 |
| P2 | admin 录入/展示 round-trip | 录入脏数据 | 纳入一致性测试 |

## 5. Mock 策略

- **wx-server-sdk**：`Module._load` 拦截返回 mock `{ DYNAMIC_CURRENT_ENV, init, database, getWXContext }`（复用 [db.test.js](__tests__/unit/db.test.js) 模式）
- **DB 链**：`database()` 返回对象，`collection()/doc()` 返回 chainable，`get()` 返回 Promise，按集合名/docId 分发预设 fixture
- **前端 `wx.cloud`**：仅 `loadCoupons` 依赖，提供 global `wx` mock（步骤2 测试中覆盖）

## 6. 异步陷阱（CRITICAL）

> 来自项目记忆 [[test-framework-async-hazard]]：自研框架异步用例**必须 await**，否则 summary 假绿、失败被吞。
> 本次所有云函数集成用例用 `async run()` + 顶层 `await run()`，summary 在 `await` 之后打印。
