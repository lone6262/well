# CLAUDE.md

> 本文件为 Claude Code 提供项目上下文。修改代码前请先通读本文档。
> 最后更新：2026-06-16 · 对应版本 V1.5

## 项目概述

**宠脉AI / 宠物症状自查小程序**（`pet-symptom-check`）—— 基于微信云开发的宠物健康风险评估 + AI 健康助手 + 会员服务平台。用户填写宠物症状 → 多规则引擎风险评级 → DeepSeek AI 生成健康报告；配套会员订阅、微信支付、邀请裂变、Web 管理后台。

| 项目 | 值 |
|------|-----|
| 版本 | V1.5 商业化增强版（生产就绪） |
| AppID | `wxee33a0c47421db2c` |
| 云开发环境 ID | `cloud1-d8gdi44zqfec250b5` |
| Git | https://github.com/lone6262/well.git |
| 部署平台 | 微信云开发 CloudBase |

## 技术栈

| 层级 | 技术 |
|------|------|
| 小程序前端 | 微信小程序原生框架（WXML + WXSS + JavaScript，非 TS） |
| 后端 | 微信云开发 CloudBase（云函数 + 云数据库 + 云存储） |
| AI 引擎 | DeepSeek Chat API（报告生成，失败时模板回退） |
| 地图 | 腾讯位置服务（附近医院搜索） |
| 支付 | 微信支付（支持模拟/真实切换，`MOCK_PAY` 开关） |
| 管理后台 | HTML5 + Vanilla JS（CloudBase 静态网站托管 + `@cloudbase/js-sdk`） |
| 认证 | 小程序端 HMAC 签名 Token；管理后台 JWT (HMAC-SHA256) |

## 目录结构

```
well/
├── miniprogram/              # 小程序前端
│   ├── app.js               # 入口：启动序列 + 静默登录 + 游客降级 + 位置管理
│   ├── app.json             # 全局配置（tabBar / pages / 权限）
│   ├── pages/               # 业务页面（index/symptom/risk/ai-report/member/
│   │                        #   emergency/hospital/pet/user/knowledge/invite/
│   │                        #   followup/order/coupon/points/bundle/agreement 等）
│   ├── components/          # 公共组件（content-card / feature-tile / state-view 等）
│   ├── config/              # 前端配置（sensitiveWords.js 敏感词过滤）
│   ├── utils/               # 工具层（见下「前端工具层」）
│   └── images/              # 图标等静态资源
├── cloudfunctions/           # 云函数（77 个可部署，含 quickstartFunctions 示例）
│   ├── common/              # ⭐ 共享模块唯一源码（见下「公共模块同步」）
│   └── <funcName>/          # 各云函数：index.js + package.json + common/ 副本
├── admin/                    # Web 管理后台（HTML/CSS/JS）
│   ├── index.html dashboard.html
│   ├── js/                  # api.js / auth.js / app.js / crud-base.js + 各业务模块（config.v2.js）
│   ├── css/  lib/  dist/    # dist/ 为构建产物（admin-bundle.v3.js，gitignore 未跟踪）
│   └── __auth/config.json   # CloudBase 匿名登录配置
├── __tests__/                # 自动化测试（unit / integration + 测试策略文档）
├── scripts/                  # 部署与同步脚本（pre-deploy-check.sh、sync-common.sh）
├── docs/                     # 开发文档合集（权威文档：开发文档V1.5-FINAL.md）
├── archive/                  # ⭐ 历史归档（一次性报告 + 旧版文档，仅供查阅）
│   ├── reports/             # 审查/重构/测试报告
│   └── docs/                # V1.0/V1.1 旧文档与历史计划
├── project.config.json       # 微信开发者工具配置
└── .eslintrc.js .prettierrc .gitignore  # 代码规范与忽略规则
```

## ⭐ 关键约定（改代码前必读）

### 1. 公共模块同步机制（最容易踩坑）

微信云开发部署时，**每个云函数只打包自身目录下的文件**，`require('../common/xxx')` 在云端会找不到模块。因此采用**副本机制**：

- **唯一源码**在 [cloudfunctions/common/](cloudfunctions/common/)（`auth.js` `constants.js` `db.js` `report-engine.js` `error-handler.js` `logger.js` `rate-limiter.js` `admin-auth.js` `audit-logger.js`）
- 各云函数以 `require('./common/auth')` 引用**本地副本**（注意是 `./common/`，不是 `../common/`）
- 副本由 [scripts/sync-common.sh](scripts/sync-common.sh) 自动复制生成，**已在 [.gitignore](.gitignore) 中排除**，不进 Git

**操作规则：**
- ✅ 只修改 `cloudfunctions/common/` 下的源文件
- ✅ 改完后**必须**运行 `bash scripts/sync-common.sh` 同步副本，否则云端拿不到更新
- ✅ 部署前用 `bash scripts/sync-common.sh --check` 校验同步状态
- ❌ 不要直接编辑某云函数下的 `common/` 副本（会被下次同步覆盖）
- ❌ 不要在云函数里用 `require('../common/...')`（部署时找不到）

### 2. 密钥管理（绝不提交）

- 密钥文件 [cloudfunctions/common/secrets.js](cloudfunctions/common/secrets.example.js)（从 `secrets.example.js` 复制）：`TOKEN_SECRET`、`TENCENT_MAP_KEY`、`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`DEEPSEEK_MODEL`
- [tcb_query.json](tcb_query.json) 含明文 admin_secret / token_secret —— 已 gitignore，绝不提交
- 部署前 [scripts/pre-deploy-check.sh](scripts/pre-deploy-check.sh) 会校验密钥已替换、未被 Git 追踪

### 3. 设计系统 "Warm Professionalism"

- 设计令牌定义于 [miniprogram/utils/design-tokens.wxss](miniprogram/utils/design-tokens.wxss)，使用 **CSS 自定义属性**（`page { --brand-primary: #B35D3A; ... }`）
- 所有 `var(--xxx)` 引用必须先在此文件声明，否则静默失效
- 配色：主色 `#B35D3A`（深陶土）、背景 `#FDFAF7`、文字 `#2D2A26`
- **禁止硬编码色值/emoji/渐变**——已做过 Phase 1-6 全量清理（见 git 历史），新增样式须走 design tokens
- 相关样式工具：[utils/ui-components.wxss](miniprogram/utils/ui-components.wxss)、[utils/responsive.wxss](miniprogram/utils/responsive.wxss)

### 4. 登录流程（app.js 核心）

[app.js](miniprogram/app.js) 实现了健壮的启动序列，改动登录相关逻辑务必理解：

1. `onLaunch` → `restoreLoginState()`（从本地存储恢复 openid/token/userInfo）→ `_startupSequence()`
2. `_startupSequence()` Promise 链：云开发初始化 → 静默登录（`silentLogin` 云函数，HMAC Token）→ 通知登录回调 → 首次启动免责声明
3. **游客/离线降级**：云开发不可用或登录失败时进 `enterOfflineMode()`，`openid` 保持空（不再造 mock openid），会员功能受限
4. **登录回调队列** `onLoginComplete(cb)`：页面注册的回调在拿到 openid+token 后统一触发，队列上限 50、30s 超时保护
5. **按需授权**：`wx.getUserProfile` 只在用户主动操作（如添加宠物）时触发，不主动弹窗

### 5. 前端工具层

[miniprogram/utils/](miniprogram/utils/) 关键模块：

| 模块 | 职责 |
|------|------|
| [api.js](miniprogram/utils/api.js) | 统一云函数调用封装 |
| [login-manager.js](miniprogram/utils/login-manager.js) | 登录状态管理 |
| [logger.js](miniprogram/utils/logger.js) | **唯一允许 console 的前端文件**，分级日志（release 环境只输出 warn/error） |
| [error-handler.js](miniprogram/utils/error-handler.js) | 统一错误处理 |
| [constants.js](miniprogram/utils/constants.js) | 前端常量（时长/缓存/地图配置） |
| [location-manager.js](miniprogram/utils/location-manager.js) / [mapService.js](miniprogram/utils/mapService.js) | 位置权限 + 地图 |
| [storage-helper.js](miniprogram/utils/storage-helper.js) / [offlineData.js](miniprogram/utils/offlineData.js) | 缓存 + 离线数据 |

## 代码规范

**ESLint**（[.eslintrc.js](.eslintrc.js)）：`no-var: error`、`eqeqeq: always`、`prefer-const: warn`；小程序端 `no-console: error`（仅 `logger.js` 例外），云函数 `no-console: off`。

**Prettier**（[.prettierrc](.prettierrc)）：单引号、2 空格缩进、分号、`trailingComma: es5`、`printWidth: 100`、`endOfLine: lf`。

要点：
- 一律使用 `const`/`let`，**禁止 `var`**
- 小程序前端不写 `console.log`，统一走 `utils/logger.js`
- 云函数 Node 环境，可用 `console`
- 遵循不可变更新（spread 创建新对象，不原地修改）

## 测试

[__tests__/](__tests__/)：
- `unit/`：auth、admin-auth、error-handler、logger、rate-limiter、report-engine、risk-control、submit-symptom-enhanced、constants-v15
- `integration/`：login-flow、pay-callback-flow、pet-flow、symptom-flow
- `cloud_functions_test.js`：云函数联调

运行方式参考 `__tests__/` 下各 `*_REPORT.md`。

## 部署流程

1. **部署前检查**：`bash scripts/pre-deploy-check.sh`（密钥、common 同步、var、require 路径）
2. **同步公共模块**：`bash scripts/sync-common.sh`（改过 `cloudfunctions/common/` 后必须跑）
3. **数据库初始化**：部署并运行 `dbInit` 云函数
4. **上传云函数**：微信开发者工具 → 右键云函数 → 「上传并部署：云端安装依赖」
5. **上传小程序**：微信开发者工具 → 上传 → 公众平台提审
6. **管理后台**：部署到 CloudBase 静态网站托管

> ⚠️ **CDN 缓存坑**：管理后台部署后，CloudBase 静态托管 CDN 可能仍返回旧文件（环境 ID 硬编码也会导致此问题）。更新后台后注意刷新 CDN 缓存、确认环境 ID 正确，详见 [[admin-deploy-cdn-cache]]。

## Git 提交规范

遵循 Conventional Commits：

- `feat` 新功能 · `fix` 修 bug · `refactor` 重构 · `docs` 文档 · `test` 测试 · `chore` 构建/工具 · `perf` 性能 · `ci` CI

```bash
git commit -m "feat: 添加宠物症状选择页面"
git commit -m "fix: 修复云函数鉴权失败问题"
```

## 文档与资源

- **权威开发文档**：[docs/开发文档V1.5-FINAL.md](docs/开发文档V1.5-FINAL.md)（功能清单/架构/数据库/云函数/管理后台/部署）
- [docs/部署文档V1.5.md](docs/部署文档V1.5.md)、[docs/design-guide.md](docs/design-guide.md)、[docs/V1.5商业化增强版PRD_完善版.md](docs/V1.5商业化增强版PRD_完善版.md)
- **历史归档**：[archive/](archive/)（审查/重构/测试报告 + V1.0/V1.1 旧文档，仅供查阅）
- [README.md](README.md)
- [微信小程序文档](https://developers.weixin.qq.com/miniprogram/dev/framework/) · [云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)

## 常见任务速查

| 任务 | 怎么做 |
|------|--------|
| 改某个云函数业务逻辑 | 编辑 `cloudfunctions/<func>/index.js` |
| 改所有云函数共享逻辑 | 编辑 `cloudfunctions/common/*.js` → 运行 `sync-common.sh` |
| 加新页面 | `miniprogram/pages/` 建 4 件套 + 注册到 [app.json](miniprogram/app.json) `pages` |
| 改主题色 | 改 [design-tokens.wxss](miniprogram/utils/design-tokens.wxss) 的 CSS 变量，勿散落硬编码 |
| 调登录/游客态 | [app.js](miniprogram/app.js) `_startupSequence` / `enterOfflineMode` |
| 配置密钥 | 复制 `secrets.example.js` → `secrets.js` 填值（勿提交） |
