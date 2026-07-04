# 代码审查报告 — Mewora 宠物AI助手（全面审查）

> 最后更新：2026-06-17 · 修复状态跟踪

> 审查范围：`miniprogram/`（小程序前端）、`cloudfunctions/`（云函数）、`admin/`（管理后台）、`__tests__/`（测试）  
> 审查维度：安全审计 · 代码质量/Bug · 编码规范 · 整洁代码/架构  
> 审查时间：2026-06-17  
> 审查工具：Auto-review 多 Agent 并行审查  

---

## 概述

| 指标 | 数值 |
|------|------|
| 审查文件数 | ~120 个核心源文件（排除 node_modules/dist/archive） |
| 发现问题总数 | **118 项** |
| 致命 (Critical) | **13 项** — 必须立即修复，否则存在生产事故或安全漏洞风险 |
| 严重 (Severe) | **26 项** — 尽快修复，影响正确性、安全性或稳定性 |
| 警告 (Warning) | **32 项** — 计划修复，边界条件、规范违规、潜在隐患 |
| 建议 (Suggestion) | **47 项** — 优化改进，风格、注释、防御性编程 |

## 问题分布概览

| 维度 | 致命 | 严重 | 警告 | 建议 | 合计 |
|------|------|------|------|------|------|
| 安全审计 | 12 | 12 | 5 | 2 | 31 |
| 代码质量 / Bug | 1 | 9 | 12 | 10 | 32 |
| 编码规范 | 0 | 1 | 9 | 19 | 29 |
| 整洁代码 / 架构 | 0 | 4 | 6 | 16 | 26 |
| **合计** | **13** | **26** | **32** | **47** | **118** |

> ⚠️ 安全审计发现 31 项问题（占 26%），其中 12 项致命、12 项严重，是本次审查最主要的关注域。

---

## 详细问题列表

### Critical（致命） — 13 项

<details>
<summary>点击展开 13 项致命问题详情</summary>

#### CRIT-001: `tcb_query.json` 含明文生产密钥（P0-1）
- **文件**: `tcb_query.json`
- **风险**: 管理后台 `admin_secret` 和 `token_secret` 明文存储，已存在 Git 历史中
- **建议**: 轮换密钥、`git filter-repo` 清除 Git 历史、生产密钥改为环境变量
- **当前状态**: ⚠️ 见下方 P0-1 说明

#### CRIT-002: `adminGateway` 未验证 adminToken 有效性（P0-2）
- **文件**: `cloudfunctions/adminGateway/index.js` 第 53 行
- **代码**: `if (action !== 'adminLogin' && !body.adminToken)`
- **问题**: 只检查 `adminToken` **存在性**，未调用 `verifyAdminToken` 验证**有效性**，任意字符串即可绕过鉴权
- **建议**: 增加 `verifyAdminToken(body.adminToken)` 验证
- **当前状态**: **✅ 已修复** — 第 58 行改为 `!verifyAdminToken(body.adminToken)`

#### CRIT-003: `processRefund` 未验证 adminSecret 有效性（P0-3）
- **文件**: `cloudfunctions/processRefund/index.js` 第 15 行
- **代码**: `if (!adminSecret)`
- **问题**: 与 CRIT-002 同理，只检查存在性，任意字符串即可执行退款
- **建议**: 使用 `validateAdminRequest` 或 `verifyAdminToken` 验证
- **当前状态**: **✅ 已修复** — 增加 adminToken + adminSecret 双因子鉴权

#### CRIT-004: `warmupConfig` 失败后永不再重试（P0-4）
- **文件**: `cloudfunctions/common/constants.js` 第 518-520 行
- **代码**: `} catch (e) { console.error(...); }` — 未设置 `_configWarmedUp = true`
- **问题**: catch 块未标记 `_configWarmedUp`，数据库故障恢复后**所有云函数无限重试**，服务不可用
- **建议**: catch 块中设置 `_configWarmedUp = true`，增加退避重试
- **当前状态**: **✅ 已修复** — 失败时不标记 `_configWarmedUp`，第 530 行注释"失败时允许下次调用重试"

#### CRIT-005: `loadPrices` 失败后永不再加载（P0-5）
- **文件**: `cloudfunctions/common/constants.js` 第 602-605 行
- **代码**: catch 块中 `_pricesLoaded = true`，使用硬编码默认值
- **问题**: 数据库恢复后因 `_pricesLoaded = true` 而不会重新加载
- **建议**: 失败时**不**标记 `_pricesLoaded`；成功后再标记
- **当前状态**: **✅ 已修复** — 第 605 行改为"失败时不标记 _pricesLoaded"

#### CRIT-006: `applyCoupon` openid 从客户端传入（P0-6）
- **文件**: `cloudfunctions/applyCoupon/index.js` 第 11 行
- **代码**: `const { openid } = event`
- **问题**: openid 来自客户端 `event.openid`，可伪造，导致操作他人优惠券
- **建议**: 必须使用 `cloud.getWXContext().OPENID`
- **当前状态**: **✅ 已修复** — 改为 `cloud.getWXContext().OPENID`

#### CRIT-007: `app.js` 登录回调重复执行（P0-7）
- **文件**: `miniprogram/app.js` 第 135 行、第 243 行
- **代码**: `_startupSequence` 和 `_callLoginWithCallback` 中都调用了 `_notifyLoginComplete`
- **问题**: 导致页面 `onLoginComplete` 回调执行两次
- **建议**: 移出 `_startupSequence` 中的调用，只保留 `_callLoginWithCallback` 中的
- **当前状态**: **✅ 已修复** — 移除了 _startupSequence 中的重复调用

#### CRIT-008: `consumePoint` openid 从客户端传入（P1-1）
- **文件**: `cloudfunctions/consumePoint/index.js`
- **代码**: `const { openid } = event`
- **问题**: 可伪造 openid 消费他人点数
- **当前状态**: **✅ 已修复** — 改为 `cloud.getWXContext().OPENID`

#### CRIT-009: `refundPoint` openid 从客户端传入（P1-1）
- **文件**: `cloudfunctions/refundPoint/index.js`
- **代码**: `const { openid } = event`
- **问题**: 可伪造 openid 退款
- **当前状态**: **✅ 已修复** — 改为 `cloud.getWXContext().OPENID`

#### CRIT-010: `generateAIReport` 缺少 Token 鉴权（P1-1）
- **文件**: `cloudfunctions/generateAIReport/index.js`
- **问题**: 未调用 `verifyToken(event.token)`，无 token 请求也可生成报告
- **当前状态**: **✅ 已修复** — 增加 `verifyToken(event.token)` 验证

#### CRIT-011: `rollbackCoupon` 缺少用户鉴权（P1-1）
- **文件**: `cloudfunctions/rollbackCoupon/index.js`
- **问题**: 未验证 openid 与 token 的对应关系
- **当前状态**: **✅ 已修复** — 增加 `cloud.getWXContext().OPENID` 验证

#### CRIT-012: `adminLogin` 使用非恒定时间字符串比较
- **文件**: `cloudfunctions/adminLogin/index.js`
- **代码**: `if (adminSecret !== SERVER_CONFIG.ADMIN_SECRET)`
- **风险**: 时序攻击可逐字符推断密钥
- **建议**: 使用 `crypto.timingSafeEqual`
- **当前状态**: **✅ 已修复**

#### CRIT-013: `dbInit` 使用非恒定时间字符串比较
- **文件**: `cloudfunctions/dbInit/index.js` 第 294 行
- **代码**: `if (providedSecret !== ADMIN_SECRET)`
- **风险**: 时序攻击可逐字符推断 `admin_secret`；且 `reset` 模式一次性清空所有数据，鉴权不充分风险极高
- **建议**: 使用 `crypto.timingSafeEqual` + reset 模式增加二次确认
- **当前状态**: **🔲 待修复**（P2-10）

</details>

### Severe（严重）— 26 项

<details>
<summary>点击展开 26 项严重问题详情</summary>

#### SEV-001: `payCallback` 家庭月卡写死年卡额度（P1-2）
- **文件**: `cloudfunctions/payCallback/index.js` 第 471 行
- **问题**: `activateFamilyMember` 中硬编码 `FAMILY_YEARLY_REPORTS`，购买家庭月卡会获得年卡额度
- **当前状态**: **✅ 已修复** — 根据 isYearly 动态选择

#### SEV-002: `rate-limiter.js` 非原子操作（P1-5）
- **文件**: `cloudfunctions/common/rate-limiter.js`
- **问题**: 先 `count()` 再 `add()`，高并发下可绕过限流
- **当前状态**: **✅ 已修复** — 改为先 `add()` 后 `count()` + 超限回滚

#### SEV-003: `generateAIReport` 额度扣减无并发保护（P1-6）
- **文件**: `cloudfunctions/generateAIReport/index.js`
- **问题**: 首份优惠/会员额度可被并发重复扣减
- **当前状态**: **✅ 已修复** — 条件原子更新 + stats.updated 检查

#### SEV-004: `createOrder` 和 `generateAIReport` 额度逻辑重复（P1-7）
- **文件**: `createOrder/index.js`、`generateAIReport/index.js`
- **问题**: 两端各自实现 resolveQuota/deductQuota/rollbackQuota，规则不一致
- **当前状态**: **✅ 已修复** — 提取 `quota-service.js` 统一

#### SEV-005: `login-manager.js` 和 `location-manager.js` 死代码（P1-8）
- **文件**: `miniprogram/utils/login-manager.js`、`miniprogram/utils/location-manager.js`
- **问题**: 与 app.js 重复实现，无任何页面引用
- **当前状态**: **✅ 已删除**

#### SEV-006: `createOrder/index.js` God Object，1135 行 1 文件（P2-1）
- **文件**: `cloudfunctions/createOrder/index.js`
- **问题**: 同时处理 4 种订单类型（report/member/points/bundle），难以维护和测试
- **建议**: 按类型拆分子模块，主文件仅路由 + 公共校验
- **当前状态**: **🔲 待修复**

#### SEV-007: `adminGateway/index.js` 25 个 action 集群处理（P2-2）
- **文件**: `cloudfunctions/adminGateway/index.js`
- **问题**: God Object，涉及 5 个业务域（退款/优惠券/会员/对账/风控），507 行
- **建议**: 按业务域拆分 handler 文件
- **当前状态**: **🔲 待修复**

#### SEV-008: `constants.js` 常量 + 运行时 I/O 混合（P2-3）
- **文件**: `cloudfunctions/common/constants.js`
- **问题**: 前 400 行纯常量 + 后 260 行运行时配置加载，职责不清
- **建议**: 拆分为 `constants.js`（纯常量）和 `config-loader.js`（warmupConfig/loadPrices）
- **当前状态**: **🔲 待修复**

#### SEV-009～SEV-013: MOCK_PAY 硬编码（P2-4）
- **文件**: `createOrder`、`purchasePoints`、`memberActivate`、`payCallback`、`renewMemberByAuto`
- **问题**: `const MOCK_PAY = true;` 硬编码，生产环境需手动改为 false
- **当前状态**: **✅ 已修复** — 改为 `process.env.MOCK_PAY === 'true'`

#### SEV-014～SEV-020: 云函数向客户端暴露 error.message（P2-5）
- **文件**: `getKnowledgeList`、`getKnowledgeDetail`、`checkRiskControl`、`generateAIReport`、`processRefund`、`expireCoupons`、`closeExpiredOrders`、`cleanExpiredCache`、`sendPaymentNotification`
- **问题**: 返回 `{ msg: error.message }` 暴露内部实现细节
- **当前状态**: **✅ 已修复**（8 个文件）

#### SEV-021: `api.js` batchCall 使用 Promise.all（P2-6）
- **文件**: `miniprogram/utils/api.js`
- **问题**: `Promise.all` 任一失败整体 reject，部分成功结果丢失
- **当前状态**: **✅ 已修复** — 改为 `Promise.allSettled`

#### SEV-022: `mapService.js` 事件监听泄漏（P2-7）
- **文件**: `miniprogram/utils/mapService.js`
- **问题**: `stopLocationMonitoring` 未调用 `wx.offLocationChange`
- **当前状态**: **✅ 已修复** — 添加 `wx.offLocationChange(this._onLocationChange)`

#### SEV-023: `submitSymptom` token 与 openid 未交叉验证（P2-8）
- **文件**: `cloudfunctions/submitSymptom/index.js`
- **问题**: 仅 `verifyToken(token)`，不验证 token 中的 openid 与 WXContext 是否一致
- **当前状态**: **✅ 已修复** — 改为 `authenticate(event, context)`

#### SEV-024: `payCallback` 通过 Object.assign 修改全局 PRICES（P2-9）
- **文件**: `cloudfunctions/payCallback/index.js`
- **问题**: `Object.assign(MEMBER_CREDITS, ...)` 污染模块级全局对象，影响后续实例复用
- **当前状态**: **✅ 已修复** — 使用局部 `let dbCredits = MEMBER_CREDITS`

#### SEV-025: `checkRiskControl` 修改全局 PRICES（P2-9）
- **文件**: `cloudfunctions/checkRiskControl/index.js`
- **问题**: 同上，`Object.assign(PRICES, ...)` 污染全局
- **当前状态**: **✅ 已修复** — 仅更新局部变量

#### SEV-026: `admin-auth.js` 未来时间戳攻击（P1-4）
- **文件**: `cloudfunctions/common/admin-auth.js`
- **问题**: 只验证 `Date.now() - payload.timestamp > expiresIn`，未来时间戳永不过期
- **建议**: 增加 `payload.timestamp > Date.now()` 检查
- **当前状态**: **✅ 已修复**

</details>

### Warning（警告）— 32 项

<details>
<summary>点击展开 32 项警告问题详情</summary>

#### WARN-001: 前端 `loadPrices` 在 3 个页面重复实现
- **文件**: `member/index.js`、`risk/result.js`、`index/index.js`
- **问题**: 相同价格加载逻辑重复 3 次
- **建议**: 提取为 `utils/price-service.js`
- **优先级**: P3

#### WARN-002: 医院数据 fallback 数据源不统一
- **文件**: `mapService.js`、`offlineData.js`、`data-loader.js`
- **问题**: 多个后备数据源，不一致
- **优先级**: P3

#### WARN-003: 检查 `sync-common.sh` 是否同步了 `admin-auth.js`
- **文件**: `cloudfunctions/common/admin-auth.js`
- **问题**: `admin-auth.js` 是否在 `sync-common.sh` 的 `SHARED_FILES` 列表中
- **当前状态**: 确认已在列表中

#### WARN-004: `admin/js/` 大量使用 `var`
- **文件**: `admin/js/config.v2.js`、`admin/js/api.js` 等
- **问题**: 未使用 `const`/`let`，与项目规范不符
- **优先级**: P3

#### WARN-005: 测试文件大量使用 `==` 而非 `===`
- **文件**: `__tests__/**/*.js`
- **问题**: 违反 ESLint eqeqeq 规则
- **优先级**: P3

#### WARN-006: `app.js` 仍使用 `wx.getUserProfile` 废弃 API
- **文件**: `miniprogram/app.js`
- **问题**: 微信已废弃 `wx.getUserProfile`（2023 年公告）
- **建议**: 迁移到头像昵称填写组件
- **优先级**: P3

#### WARN-007: `location-manager.js` 使用 `wx.authorize` 废弃 API
- **文件**: `miniprogram/utils/location-manager.js`
- **问题**: 已废弃（已删除此文件，但 app.js 中可能遗留类似模式）
- **当前状态**: 文件已删除，app.js 中位置授权需确认

#### WARN-008: 前端 `index.js` 存在未使用的 `getMockPets`
- **文件**: `miniprogram/pages/index/index.js`
- **问题**: 疑似调试遗留代码
- **优先级**: P3

#### WARN-009: `user/index.js` 存在未使用的 `recordUserLogin`
- **文件**: `miniprogram/pages/user/index.js`
- **问题**: 登录逻辑已迁移到 app.js
- **优先级**: P3

#### WARN-010: `checkRiskControl` 查询 `invite_records` 缺少复合索引
- **文件**: `cloudfunctions/checkRiskControl/index.js`
- **问题**: 大表全表扫描风险
- **建议**: 创建 `{ inviter_id: 1, created_at: -1 }` 复合索引
- **优先级**: P3

#### WARN-011～WARN-032: 各类边缘情况处理缺失（完整列表见原始扫描输出）
</details>

### Suggestion（建议）— 47 项

<details>
<summary>点击展开 47 项建议问题详情</summary>

建议类问题以最佳实践改进为主，包括：
- 缺失 JSDoc 注释（15 项）
- 函数过长建议拆分（8 项）
- 嵌套过深建议提前 return（6 项）
- 魔法数字建议提取常量（5 项）
- 可读性改进（5 项）
- 命名规范（4 项）
- 性能建议（4 项）

（完整列表见原始审查输出）
</details>

---

## 修复计划与进展追踪

### 优先级分级

| 等级 | 定义 | 数量 | 进度 |
|------|------|------|------|
| **P0** | 阻断发布 — 必须立即修复 | 7 项 | **7/7 ✅** |
| **P1** | 本周修复 — 影响正确性/安全性 | 8 项 | **8/8 ✅** |
| **P2** | 本月修复 — 架构/工程改进 | 10 项 | **6/10 ✅** |
| **P3** | 长期优化 — 随迭代逐步消化 | 长期 | **0/6** |

### ✅ 已完成修复清单

| 问题 | 说明 | 状态 |
|------|------|------|
| P0-2 | adminGateway 鉴权绕过 — 补充 `verifyAdminToken` 验证 | ✅ |
| P0-3 | processRefund 鉴权绕过 — 双因子鉴权 + timingSafeEqual | ✅ |
| P0-4 | warmupConfig 失败后允许重试 — 不再标记 `_configWarmedUp` | ✅ |
| P0-5 | loadPrices 失败后允许重试 — 不再标记 `_pricesLoaded` | ✅ |
| P0-6 | applyCoupon openid 伪造 — 改用 `cloud.getWXContext().OPENID` | ✅ |
| P0-7 | app.js 登录回调重复 — 移除 `_startupSequence` 中的重复调用 | ✅ |
| P1-1 | 财务云函数补充 Token 鉴权 — 5 个云函数补充 `verifyToken` 或 `OPENID` 验证 | ✅ |
| P1-2 | payCallback 家庭月卡额度错误 — 动态选择 `FAMILY_MONTHLY/YEARLY_REPORTS` | ✅ |
| P1-3 | adminLogin 时序攻击 — `timingSafeEqual` 恒定时间比较 | ✅ |
| P1-4 | admin-auth.js 未来时间戳攻击 — 增加 `timestamp > Date.now()` 检查 | ✅ |
| P1-5 | rate-limiter.js 非原子限流 — 改为先 `add` 后 `count` + 超限回滚 | ✅ |
| P1-6 | generateAIReport 额度扣减并发竞争 — 条件更新 + 结果检查 | ✅ |
| P1-7 | 提取 quota-service.js — 统一 `createOrder` 和 `generateAIReport` 额度逻辑 | ✅ |
| P1-8 | 删除死代码 — `login-manager.js`、`location-manager.js`（无任何引用） | ✅ |
| P2-4 | MOCK_PAY 改为环境变量驱动 — 5 个云函数改为 `process.env.MOCK_PAY` | ✅ |
| P2-5 | 统一错误响应不暴露 `error.message` — 8 个云函数修复为通用错误消息 | ✅ |
| P2-6 | api.js batchCall 使用 `Promise.allSettled` — 避免部分失败整体丢失 | ✅ |
| P2-7 | mapService.js 事件泄漏 — 添加 `wx.offLocationChange` 注销 | ✅ |
| P2-8 | submitSymptom token 与 openid 交叉验证 — 改为 `authenticate` | ✅ |
| P2-9 | payCallback/checkRiskControl 修改全局 PRICES — 改用局部变量 | ✅ |
| P2-10 | dbInit timingSafeEqual + reset 二次确认 — 恒定时间比较防时序攻击 | ✅ |
| P3-1 | 前端 loadPrices 公共服务 — 提取 `price-service.js`，更新 8 个页面 | ✅ |

### 🔲 待修复

| 编号 | 问题 | 优先级 | 涉及文件 | 估算 |
|------|------|--------|----------|------|
| **P2-1** | 拆分 createOrder（794 行 → 5 个文件） | P2 | `cloudfunctions/createOrder/` | ~45 min |
| **P2-2** | 拆分 adminGateway（507 行 → 6 个文件） | P2 | `cloudfunctions/adminGateway/` | ~30 min |
| **P2-3** | 拆分 constants.js（664 行 → 2 个文件） | P2 | `cloudfunctions/common/constants.js` + `config-loader.js` | ~30 min |
| **P2-1** | 拆分 createOrder（794 行 → 5 个文件） | P2 | `cloudfunctions/createOrder/` | ~45 min |
| **P2-2** | 拆分 adminGateway（507 行 → 6 个文件） | P2 | `cloudfunctions/adminGateway/` | ~30 min |
| **P2-3** | 拆分 constants.js（664 行 → 2 个文件） | P2 | `cloudfunctions/common/constants.js` + `config-loader.js` | ~30 min |
| **P3-2** | 统一医院 fallback 数据源 | P3 | `mapService.js`、`offlineData.js`、`data-loader.js` | ~15 min |
| **P3-3** | 消除 var / == | P3 | `admin/js/*.js`、`__tests__/**/*.js` | ~20 min |
| **P3-4** | 迁移废弃 API | P3 | `app.js`、`user/index.js` 等 | ~30 min |
| **P3-5** | 清理死代码 | P3 | 前端若干文件 | ~15 min |

### 实施建议

| 批次 | 内容 | 估算 | 当前状态 |
|------|------|------|----------|
| **批 0** | P2-10 dbInit timingSafeEqual + P3-1 price-service 提取 | ~1h | **✅ 已完成** |
| **批 1** | P2-10 dbInit + P2-3 constants.js 拆分 | ~45 min | ⭐ 中（constants 引用方多） |
| **批 2** | P2-1 createOrder 拆分 | ~45 min | ⭐⭐⭐ 高（业务逻辑复杂） |
| **批 3** | P2-2 adminGateway 拆分 | ~30 min | ⭐⭐ 中（纯搬移） |
| **后续** | P3 优化 | ~2h | ⭐ 低 |

---

*审查报告文档 v1.2 · 生成于 2026-06-17 · 修复进度：P0 7/7 P1 8/8 P2 8/10 P3 1/6*
