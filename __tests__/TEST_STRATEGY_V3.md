# AutoTest V3 测试策略文档

> 生成日期: 2026-07-10
> 分支: `fix/code-review-remediation`
> 方法论: TDD（红-绿-重构）
> 目标覆盖率: 80%+
> 本轮重点: P1 后端修复回归 + common 模块覆盖率补全

---

## 0. 本轮触发背景

最近 5 个提交聚焦「代码评审整改」，引入了若干新公共模块与安全修复，需补测以防回归：

| 提交 | 内容 | 测试影响 |
|------|------|---------|
| `0cbd677` | 食物安全查询加鉴权限流 + 正则转义 + 分页修正 | `searchFoodSafety` 回归测试 |
| `9ba7dce` | P1 后端修复：支付日志脱敏 / **额度重置** / 埋点字段 | `quota-service`（新模块）补测 |
| `83a6f82` | validate 页接入 design token + console 改 logger | logger 已覆盖，前端不可单测 |
| `8b5ee27` | ESLint 迁移至 flat config | 静态检查（步骤3 lint） |
| `d759656` | 清理死代码 + 修复 sync-common 同步计数 | 部署前脚本校验 |

## 1. TDD 方法论

经典红-绿-重构循环，本项目采用**自研轻量测试框架**（非 Jest）：

```
🔴 RED    → 先写失败的测试（基于函数契约与边界条件）
🟢 GREEN  → 被测代码已满足契约（本轮主要为既有代码补测，直接 GREEN）
🔵 REFACTOR → 重构保持测试通过
```

**运行方式**：`node __tests__/unit/<file>.test.js`，每个文件独立进程，退出码 1 表示失败。

## 2. 项目可测试性矩阵

| 层次 | 可测试性 | 测试方式 | 工具 |
|------|---------|---------|------|
| **common 纯逻辑函数** | ✅ 完全可测 | Node.js 单元测试 | 自研 assert 框架 |
| **common 异步 + DB** | ✅ 可测（Mock） | Mock wx-server-sdk + db | createMockDb 工厂 |
| **云函数入口** | ⚠️ Mock | Mock wx-server-sdk + auth/rate-limit | cloud_functions_test.js |
| **前端页面 (WXML/WXSS/JS)** | ❌ 需微信运行时 | 语法检查 + ESLint + 手动 | 无自动化运行时 |
| **E2E（小程序）** | ❌ 微信封闭环境 | 手动测试清单替代 | 微信开发者工具 |

## 3. 覆盖率缺口分析（本轮核心）

### 3.1 common 模块覆盖现状

| 模块 | 行数 | 现状 | 本轮动作 |
|------|------|------|---------|
| admin-auth.js | 118 | ✅ 已测 | — |
| auth.js | 139 | ✅ 已测 | — |
| constants.js | 673 | ✅ 已测 | — |
| error-handler.js | 66 | ✅ 已测 | — |
| logger.js | 105 | ✅ 已测 | — |
| rate-limiter.js | 70 | ✅ 已测 | — |
| report-engine.js | 515 | ✅ 已测 | — |
| **quota-service.js** | **391** | ❌ **未测** | ⭐ **本轮重点补测** |
| **audit-logger.js** | **36** | ❌ **未测** | 本轮补测 |
| **db.js** | **18** | ❌ **未测** | 本轮烟雾测试 |
| dbInit.js | 186 | ⚠️ 结构性 | 部署期校验 |
| secrets.js | 35 | 🚫 跳过 | 密钥不入测试 |

### 3.2 quota-service.js 风险分析（最高优先级）

391 行新模块，统一 `createOrder` 与 `generateAIReport` 的额度逻辑，**直接关系计费正确性**。需重点覆盖：

- **`calcNextReset(startDate, currentReset)`**：纯日期逻辑，跨月/月末（28-31日）/跨年边界
- **`resolveQuota` 优先级链**：首份优惠 > 邀请奖励 > 体验会员 > 正式会员 > 点数包 > 付费
  - 关键防绕过：首份优惠需交叉验证 ORDERS（防删号重注册）
  - 会员额度到期自动重置（`report_credits_reset_at`）
  - 旧会员迁移：库里 total 低于配置时用新值
- **`deductQuota`**：条件更新原子性（`_.neq` / `_.gt` / `_.lt` / `_.inc`），新用户自动建记录，并发冲突重试
- **`rollbackQuota`**：反向操作幂等性

### 3.3 searchFoodSafety 回归点（提交 0cbd677）

- Token 鉴权（防匿名爬取）
- `escapeRegExp` 正则元字符转义（防 ReDoS / 注入）
- 分页参数边界（`page`/`pageSize` clamp：pageSize 上限 100）
- 关键词 OR 合并（name + aliases）保证 total 与分页准确

## 4. 测试层次规划

```
单元测试 (unit/)          集成测试 (integration/)     云函数联调
├─ 新增: quota-service    ├─ login-flow               ├─ cloud_functions_test
├─ 新增: audit-logger     ├─ pay-callback-flow        │  (118 用例，响应码一致性)
├─ 新增: db (smoke)       ├─ pet-flow                 │
├─ 新增: searchFoodSafety └─ symptom-flow             │
└─ 既有 8 个                                              E2E (手动清单)
                                                          └─ 微信环境，无自动化
```

## 5. Mock 策略

沿用既有 `createMockDb(config)` 工厂模式（见 risk-control.test.js），为 quota-service 扩展支持：

- `.collection(name).where(q).limit(n).get()` → `{ data: [...] }`
- `.collection(name).where(q).get()` / `.count()`
- `.collection(name).where(q).update({data})` → `{ stats: { updated } }`
- `.collection(name).doc(id).update({data})`
- `.collection(name).add({data})` → `{ _id }`
- `db.command`：`neq` / `gt` / `lt` / `inc`
- `db.RegExp({regexp, options})`

## 6. 优先级排序

| 优先级 | 目标 | 理由 |
|--------|------|------|
| P0 | quota-service.test.js | 计费核心，391 行，0 覆盖 |
| P0 | searchFoodSafety 回归 | 近期安全修复，防注入/分页 |
| P1 | audit-logger.test.js | 安全审计，快速补全 |
| P2 | db.test.js | 烟雾测试，补全 common 覆盖 |
| P3 | E2E/API 文档更新 | 微信限制，以清单/矩阵替代 |

## 7. 覆盖率目标

| 维度 | 基线 (V2) | 本轮目标 (V3) |
|------|----------|--------------|
| common 模块测试覆盖 | 7/10 | **10/10** |
| 单元测试文件数 | 8 | **12** |
| 云函数联调用例 | 118 | 118（保持） |
| 计费逻辑（quota）覆盖 | 0% | **≥80%** |
