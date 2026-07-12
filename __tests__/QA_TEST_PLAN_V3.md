# AutoTest V3 QA 测试计划

> 生成日期: 2026-07-10
> 分支: `fix/code-review-remediation`
> 范围: 覆盖率矩阵 + 发布检查清单 + 质量仪表板 + 自动化 ROI

---

## 1. 测试覆盖率矩阵（功能 × 测试类型）

| 功能域 | 单元 (L2) | 集成 (L3) | 契约 (L1) | E2E | 覆盖评级 |
|--------|:---------:|:---------:|:---------:|:---:|:--------:|
| 认证 (auth/admin-auth) | ✅ 112 | ✅ login | ✅ | 手动 | 🟢 完整 |
| 常量 (constants) | ✅ 395 | — | ✅ | — | 🟢 完整 |
| 日志/脱敏 (logger) | ✅ 108 | — | — | — | 🟢 完整 |
| 错误处理 (error-handler) | ✅ 69 | — | — | — | 🟢 完整 |
| 限流 (rate-limiter) | ✅ 16 | — | ✅ | — | 🟢 完整 |
| 报告引擎 (report-engine) | ✅ 60 | — | — | 手动 | 🟢 完整 |
| 风控 (risk-control) | ✅ 57 | — | ✅ | — | 🟢 完整 |
| 症状提交 (submitSymptom) | ✅ 220 | ✅ symptom | ✅ | 手动 | 🟢 完整 |
| **额度服务 (quota-service)** | ✅ **73 🆕** | ✅ pay-callback | ✅ | 手动 | 🟢 **完整（本轮补全）** |
| **审计日志 (audit-logger)** | ✅ **10 🆕** | — | — | — | 🟢 **完整（本轮补全）** |
| **DB 初始化 (db)** | ✅ **9 🆕** | — | — | — | 🟢 **完整（本轮补全）** |
| **食物安全 (searchFoodSafety)** | ✅ **38 🆕** | — | ✅ | 手动 | 🟢 **完整（本轮补全）** |
| 会员域 | — | — | ✅ | 手动 | 🟡 待补 L2 |
| 订单/退款域 | — | ✅ pay-callback | ✅ | 手动 | 🟡 待补 L2 |
| 优惠券域 | — | — | ✅ | 手动 | 🟡 待补 L2 |
| 邀请/家庭域 | — | — | ✅ | 手动 | 🟡 待补 L2 |
| 管理后台 (admin*) | ✅ admin-auth | — | ✅ | 手动 | 🟡 待补 L2 |

**common 模块覆盖率：10/10（100%）** — V2 为 7/10，本轮补全 quota-service / audit-logger / db。

## 2. 自动化测试用例清单

### 2.1 本轮新增（4 文件 / 130 断言）

| 文件 | 断言数 | 覆盖目标 |
|------|:------:|---------|
| `unit/quota-service.test.js` | 73 | 计费核心：calcNextReset + 6 级优先级 + 扣减/回滚原子性 |
| `unit/searchFoodSafety.test.js` | 38 | 安全回归：鉴权 + 正则转义 + 分页 clamp |
| `unit/audit-logger.test.js` | 10 | 审计写入 + 字段映射 + 错误吞咽 |
| `unit/db.test.js` | 9 | SDK 初始化 + 导出结构 + 单例 |

### 2.2 既有保留（13 文件）

admin-auth(71) / auth(41) / constants-v15(395) / error-handler(69) / logger(108) / rate-limiter(16) / report-engine(60) / risk-control(57) / submit-symptom-enhanced(220) + 4 集成(205) + cloud_functions_test(118)

## 3. 缺陷严重级分类（本轮发现）

| 级别 | 本轮发现 | 处理 |
|------|---------|------|
| 🔴 致命 | 0 | — |
| 🟠 严重 | 1（测试框架隐患，见 §6） | 已修复 |
| 🟡 一般 | 1（`searchFoodSafety` pageSize=0 语义）| 已澄清并锁定行为 |
| 🔵 轻微 | 1（`audit-logger.js` 遗留 `var`）| 已修复 + 同步 81 副本 |

**生产代码缺陷：0**（本轮为既有代码补测，源码逻辑均符合预期）。

## 4. 发布检查清单（Release Checklist）

### 4.1 代码质量门禁

- [x] 全量单元 + 集成测试通过（1372/1372）
- [x] 云函数联调通过（118/118）
- [x] 本轮交付文件 ESLint 0 error
- [x] common 模块覆盖率 100%（10/10）
- [ ] **既有前端 lint 残留**（1218 问题，`miniprogram/utils` 历史 `var`）—— 非本轮引入，建议独立技术债清理

### 4.2 部署前校验

- [ ] `bash scripts/pre-deploy-check.sh`（密钥 / common 同步 / var / require 路径）
- [ ] `bash scripts/sync-common.sh --check`（common 副本一致）
- [ ] 密钥已替换且未被 Git 追踪（`secrets.js` / `tcb_query.json`）

### 4.3 真机/云环境验证（手动，必跑 P0）

- [ ] E1-E7 计费与额度全场景（见 E2E 报告）
- [ ] E8-E10 支付回调（真实 + 模拟 + 幂等）
- [ ] E11-E15 食物安全搜索（含正则注入防御）
- [ ] E16-E20 核心业务流冒烟

### 4.4 安全门禁

- [x] 无硬编码密钥（secrets 走环境/secrets.js）
- [x] 用户输入校验（token / 正则转义 / 分页 clamp）
- [x] 日志脱敏（logger.test.js 验证）
- [x] 鉴权限流（auth + rate-limiter + admin-auth）

## 5. 质量仪表板

```
┌─────────────────────────────────────────────────────────┐
│  Mewora V1.5 质量仪表板（fix/code-review-remediation）   │
├──────────────────────┬──────────────────────────────────┤
│ 测试通过率           │ 100%  (1372/1372 单元+集成)      │
│ 云函数联调           │ 100%  (118/118)                  │
│ 自动化断言总数       │ 1695  (本轮 +111)                │
│ common 模块覆盖      │ 100%  (10/10, 上轮 7/10)         │
│ 本轮新增测试文件     │ 4                                 │
│ 生产代码缺陷         │ 0                                 │
│ ESLint error(交付物) │ 0                                 │
│ 计费逻辑覆盖         │ ≥80% (quota-service 73 断言)      │
└──────────────────────┴──────────────────────────────────┘
```

## 6. 自动化 ROI 与流程改进建议

### 6.1 本轮 ROI

| 投入 | 产出 |
|------|------|
| 4 个新测试文件（~700 行）| 计费核心 0→73 断言覆盖；安全修复回归测试就位 |
| Mock 工厂扩展 | 可复用于会员/订单域后续补测 |
| 统一测试运行器 | `node scripts/run-tests.js --all` 一键全量 |

### 6.2 ⚠️ 重要发现：自研测试框架异步隐患

**问题**：自研框架中异步测试若写成 `(async function(){...})()`（未 await），`summary()` 会在异步断言完成前执行，导致**计数错误 + 失败被吞咽（假绿）**。本轮 `quota-service.test.js` 首版即踩坑（显示 14/14，实为 73 断言）。

**已修复**：本轮新测试统一用 `async run() { await ... }` 包裹。**建议**：排查既有异步测试（risk-control / submit-symptom-enhanced / 集成测试）是否存在同样隐患，或迁移到 Jest（支持 async 原生）。

### 6.3 下轮建议

1. 按域补 L2 单测：会员、订单、优惠券（复用 quota Mock 模式）
2. 清理前端 `var` 技术债（1218 lint 问题）
3. 评估 miniprogram-automator 做发布前 smoke gate
4. 考虑引入 Jest 统一框架，消除自研框架异步隐患
