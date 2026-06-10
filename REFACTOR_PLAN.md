# Well 项目前端整改计划

## Context

Well 是一个宠物症状自查微信小程序 + 管理后台。经 Auto-Ui 全面审查，前端综合评分 **56/100（不合格）**。主要问题：CSS 设计令牌系统断裂（var() 引用全部失效）、422 处 console.log 未清理、无障碍完全缺失、管理后台无模块化/无构建工具/XSS 风险。本项目有 1,360 个已有测试（覆盖后端），整改不能破坏现有测试。

**整改原则：** 小程序在现有架构上优化（投入产出比高），管理后台需要结构性升级但保持 vanilla JS（内部工具不过度工程化）。

---

## Phase 1：紧急修复（第 1-2 周）— P0

### 1.1 修复 CSS 自定义属性断裂 🔴 — 2 天

**问题：** `app.wxss` 引用 `var(--bg-secondary)` 等 20+ 个 CSS 变量，但 `design-tokens.wxss` 只定义了硬编码类（如 `.bg-primary-500`），从未声明任何 CSS 自定义属性。所有 `var()` 静默失效，设计系统半残。

**改动：**
- [miniprogram/utils/design-tokens.wxss](miniprogram/utils/design-tokens.wxss) — 在文件顶部添加 `page { }` 块，定义所有被引用的 CSS 自定义属性（颜色、间距、字体、圆角、z-index、动画时长），值从现有硬编码类中提取
- 同文件末尾添加 `@media (prefers-color-scheme: dark) { page { ... } }` 暗黑模式变量

**验收：** 所有页面 `var()` 引用正确渲染；暗黑模式跟随系统自动切换

---

### 1.2 清理 Top 5 文件的 console.log 🔴 — 2 天

**问题：** 312 处 `console.log` 分布在 17 个文件。已有完善的 `utils/logger.js`（分级日志、子 logger、脱敏），但仅 3 个文件使用它。ESLint `no-console: warn` 形同虚设。

**改动（按数量排序）：**
| 文件 | console 数量 | 改动 |
|------|-------------|------|
| [miniprogram/app.js](miniprogram/app.js) | 57 | 已导入 logger，替换所有 console 调用 |
| [miniprogram/pages/pet/profile.js](miniprogram/pages/pet/profile.js) | 55 | 新增 logger 导入 + child logger |
| [miniprogram/pages/user/index.js](miniprogram/pages/user/index.js) | 28 | 同上 |
| [miniprogram/pages/symptom/guide.js](miniprogram/pages/symptom/guide.js) | 28 | 同上 |
| [miniprogram/utils/storage-helper.js](miniprogram/utils/storage-helper.js) | 9 | 同上 |

**模式：** 每个文件 `const log = require('path/to/logger').child('ModuleName')` → `log.info()` / `log.warn()` / `log.error()`

**验收：** `grep -c "console\.\(log\)" <file>` 对这 5 个文件返回 0；1,360 测试全过

---

### 1.3 修复管理后台 XSS 风险 🔴 — 1 天

**问题：** 18 处 `innerHTML` 赋值，`escapeHtml()` 使用不一致。`onclick="refundOrder('${order._id}')"` 中属性值未转义引号。

**改动：**
- [admin/js/app.js](admin/js/app.js) — 新增 `escapeAttr()` 函数（转义 `'`、`"`、`<`、`>`、`&`）
- [admin/js/orders.js](admin/js/orders.js)、[members.js](admin/js/members.js)、[articles.js](admin/js/articles.js)、[refunds.js](admin/js/refunds.js)、[coupons.js](admin/js/coupons.js) — 所有 `onclick` 属性值用 `escapeAttr()` 包裹；确认所有显示值用 `escapeHtml()`

**验收：** 所有 innerHTML 插值都有对应的转义函数包裹

---

### 1.4 替换原生 confirm() 为自定义确认对话框 🔴 — 1 天

**问题：** 退款、删除会员、删除文章等危险操作使用原生 `confirm()`，无法自定义样式、不支持键盘、无审计记录。

**改动：**
- [admin/dashboard.html](admin/dashboard.html) — 添加确认对话框 HTML 结构
- [admin/css/style.css](admin/css/style.css) — 添加对话框样式
- [admin/js/app.js](admin/js/app.js) — 重写 `confirmAction()` 为 Promise 版本，支持 Escape 关闭 + Enter 确认

**依赖：** 1.3 完成后开始

**验收：** 所有 `confirm()` 替换为自定义对话框；键盘可操作

---

### 1.5 清理 app.js 死代码 🔴 — 1 天

**问题：** `app.js` 810 行，含重复登录流程：新 `_startupSequence` 与旧 `silentLogin()` + `callSilentLoginCloudFunction()` 并存。`initCloudDevelopment()` 与 `_initCloudAsync()` 重复。

**改动：**
- [miniprogram/app.js](miniprogram/app.js) — 移除 6 个已废弃方法：`silentLogin()`、`callSilentLoginCloudFunction()`、`simulatedLogin()`、`initCloudDevelopment()`、`refreshTokenIfNeeded()`、`checkRequestPermission()`
- 预计从 ~810 行降至 ~600 行

**依赖：** 1.2（logger 替换）完成后开始

**验收：** `grep -n "silentLogin\b\|callSilentLoginCloudFunction\|simulatedLogin\|initCloudDevelopment\|refreshTokenIfNeeded\|checkRequestPermission" app.js` 无匹配；登录流程在微信开发者工具中正常

---

## Phase 2：代码质量与模式（第 3-4 周）— P1

### 2.1 管理后台提取 CRUD 公共模式 — 2 天

**问题：** 8 个管理模块（orders/members/articles/refunds/coupons/users/bills/risk）重复相同的 `loadXxx → callCloudFunction → displayXxx → renderPagination` 模式。

**改动：**
- 新建 [admin/js/crud-base.js](admin/js/crud-base.js) — 提供 `createCrudModule(config)` 工厂函数，封装 loading/error/pagination 逻辑
- 改造 8 个模块：每个从 ~120 行缩减到 ~50 行配置 + 显示函数

**依赖：** 1.3 + 1.4 完成后

**验收：** 每个模块行数减少 ≥ 40%；10 个管理 Tab 功能不变

---

### 2.2 管理后台引入 Vite 构建 — 2 天

**问题：** 14 个 `<script>` 标签全局加载，无压缩、无模块化、无 tree-shaking。

**改动：**
- 新建 `admin/package.json` + `admin/vite.config.js`
- 将 `admin/js/*.js` 迁移为 ES modules（`export`/`import`）
- 新建 `admin/src/main.js` 作为入口
- [admin/dashboard.html](admin/dashboard.html) 替换 14 个 script 标签为 1 个 `<script type="module">`
- CloudBase SDK（`lib/cloudbase.js`）保留为外部 script

**依赖：** 2.1 完成后

**验收：** `npm run build` 产出压缩包；`npm run dev` 支持 HMR；所有 Tab 功能不变

---

### 2.3 修复 guide.js 直接变异模式 — 1 天

**问题：** `toggleSymptom`、`removeSymptom` 等方法直接修改 `this.data` 嵌套对象后调用 `setData()`。6 处变异：行 183、342、353-354、401-402、426、571-572。

**改动：**
- [miniprogram/pages/symptom/guide.js](miniprogram/pages/symptom/guide.js) — 用 `map()` + `Object.assign()` 不可变模式替换直接变异
- 涉及方法：`toggleSymptom`、`removeSymptom`、`clearAllSymptoms`、`resetPageState`

**验收：** `this.data` 属性在 `setData()` 前无任何直接修改；症状选择/取消功能正常

---

### 2.4 拆分 submitAssessment 长函数 — 1 天

**问题：** `submitAssessment()` 157 行（行 541-698），混合验证、数据提取、API 调用、结果路由。

**改动：**
- [miniprogram/pages/symptom/guide.js](miniprogram/pages/symptom/guide.js) — 提取为 4 个独立方法：
  - `_validateSubmission()` → 返回 `{ valid, data, error }`
  - `_buildSubmitData()` → 构建提交载荷
  - `_handleEmergencyResult(data)` → 高风险紧急路由
  - `_handleNormalResult(data)` → 正常结果导航
- `submitAssessment()` 缩减为 ~30 行编排器

**依赖：** 2.3 完成后

**验收：** `submitAssessment` < 40 行；每个子方法可独立测试

---

### 2.5 修复触摸目标尺寸 — 1 天

**问题：** `.nav-back` 64rpx、`.symptom-check` 32rpx，均低于 88rpx 最小标准。

**改动：**
- [miniprogram/pages/symptom/guide.wxss](miniprogram/pages/symptom/guide.wxss) — `.nav-back` 加 `min-width/min-height: 88rpx`；`.symptom-check` 用 padding 扩大点击区域至 88rpx
- 扫描所有 WXSS 文件找出 < 88rpx 的 `bindtap` 元素

**依赖：** 1.1（CSS 变量修复）完成后

**验收：** 所有可点击元素触摸区域 ≥ 88rpx；视觉无明显变化

---

### 2.6 核心 WXML 页面添加 ARIA 属性 — 2 天

**问题：** 30 个 WXML 文件零 ARIA 标签。视障用户完全无法使用。

**改动（优先级最高的 5 个页面）：**
| 页面 | 关键添加 |
|------|---------|
| [symptom/guide.wxml](miniprogram/pages/symptom/guide.wxml) | `role="form"`, 症状项 `aria-checked`, 进度条 `aria-valuenow` |
| [index/index.wxml](miniprogram/pages/index/index.wxml) | Tab 栏 `role="navigation"`, 快捷操作 `aria-label` |
| [pet/profile.wxml](miniprogram/pages/pet/profile.wxml) | 宠物卡片 `aria-label`, 表单输入标签 |
| [hospital/list.wxml](miniprogram/pages/hospital/list.wxml) | 医院列表 `role="list"`, 距离信息标签 |
| [user/index.wxml](miniprogram/pages/user/index.wxml) | 用户统计和菜单 `aria-label` |

**验收：** 5 个核心页面交互元素都有 `aria-label`；状态驱动元素使用 `aria-checked`/`aria-disabled`

---

## Phase 3：架构改善（第 5-8 周）— P2

### 3.1 拆分 pet/profile.js（1,207 行） — 3 天

**改动：** 拆分为 4 个模块：
- `pages/pet/pet-service.js` — 宠物 CRUD 云函数调用
- `pages/pet/mock-data.js` — 本地模拟数据
- `pages/pet/record-manager.js` — 记录加载逻辑
- `pages/pet/form-handler.js` — 表单验证、图片上传
- `profile.js` 缩减为 < 300 行的编排器

### 3.2 管理后台添加表单验证 — 2 天

**改动：** 新建 `admin/src/utils/validator.js`（通用验证规则 + 内联错误提示），应用到 articles/coupons/settings 表单

### 3.3 管理后台语义化 HTML + 键盘导航 — 2 天

**改动：** [admin/dashboard.html](admin/dashboard.html) — `<div class="sidebar">` → `<aside><nav>`，`<div class="main-content">` → `<main>`，表格加 `<caption>` + `scope`，模态框加 `role="dialog"` + `aria-modal`

### 3.4 清理剩余 12 个文件的 console.log — 2 天

**改动：** 同 1.2 模式，处理剩余 ~140 处 console.log

### 3.5 管理后台提取 CSS 变量 — 1 天

**改动：** [admin/css/style.css](admin/css/style.css) — `:root` 定义 `--color-primary` 等 15+ 变量，替换所有硬编码色值

---

## Phase 4：持续优化（第 9-12 周）— Backlog

| 任务 | 工时 | 说明 |
|------|------|------|
| 4.1 统一加载/空/错误状态组件 | 2 天 | 新建 `components/state-view/`，应用到缺失页面 |
| 4.2 管理后台单元测试 | 3 天 | Vitest + DOM mock，覆盖 api/orders/coupons/auth |
| 4.3 合并大型 WXSS 文件 | 2 天 | `index.wxss`（1,152 行）拆分去重 |
| 4.4 ESLint 强制 no-console | 0.5 天 | `no-console: error` + pre-commit hook |

---

## 依赖关系图

```
Phase 1 (无依赖，可并行):
  1.1 CSS 变量 ─────┐
  1.2 console 清理 ──┤
  1.3 XSS 修复 ──────┤
                     ├→ 1.4 自定义 confirm
  1.5 死代码清理 ────┘    (依赖 1.2 + 1.3)

Phase 2:
  2.1 CRUD 模式 ← 1.3 + 1.4
  2.2 Vite 构建 ← 2.1
  2.3 变异修复 ← (独立)
  2.4 函数拆分 ← 2.3
  2.5 触摸目标 ← 1.1
  2.6 ARIA 属性 ← (独立)

Phase 3:
  3.1 profile 拆分 ← 1.2
  3.2 表单验证 ← 2.2
  3.3 语义 HTML ← 2.2
  3.4 console 清理 ← 1.2 模式
  3.5 CSS 变量 ← 1.1 模式
```

## 验证策略

每个任务完成后：
1. `cd d:/.../well && npm test` — 确认 1,360 个已有测试全过
2. 微信开发者工具预览 — 确认小程序页面正常渲染
3. 管理后台打开所有 10 个 Tab — 确认功能不变
4. `grep -c "console\.log"` 验证日志清理任务
5. 浏览器 DevTools 检查 CSS 变量是否生效（Phase 1.1）

## 关键文件清单

| 文件 | 改动类型 | 涉及任务 |
|------|---------|---------|
| [miniprogram/utils/design-tokens.wxss](miniprogram/utils/design-tokens.wxss) | 添加 CSS 自定义属性 + 暗黑模式 | 1.1 |
| [miniprogram/app.js](miniprogram/app.js) | logger 替换 + 删死代码 | 1.2, 1.5 |
| [miniprogram/pages/symptom/guide.js](miniprogram/pages/symptom/guide.js) | logger + 不可变模式 + 函数拆分 | 1.2, 2.3, 2.4 |
| [miniprogram/pages/pet/profile.js](miniprogram/pages/pet/profile.js) | logger + 拆分模块 | 1.2, 3.1 |
| [admin/js/app.js](admin/js/app.js) | escapeAttr + 自定义 confirm | 1.3, 1.4 |
| [admin/js/orders.js](admin/js/orders.js) | XSS 修复 + CRUD 重构 | 1.3, 2.1 |
| [admin/dashboard.html](admin/dashboard.html) | 对话框 HTML + 语义化 + Vite 迁移 | 1.4, 2.2, 3.3 |
| [admin/css/style.css](admin/css/style.css) | 对话框样式 + CSS 变量 | 1.4, 3.5 |
