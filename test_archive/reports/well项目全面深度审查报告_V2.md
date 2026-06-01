# 宠物症状自查小程序 — 全面深度审查报告 V2

> **审查日期**: 2026-05-30
> **审查范围**: 全项目（miniprogram/ + cloudfunctions/ + docs/）
> **项目类型**: 微信小程序 + 腾讯云开发
> **代码规模**: ~15个云函数, ~12个前端页面, ~6个工具模块

---

## 一、项目总览

### 1.1 项目架构

```
well/
├── miniprogram/               # 微信小程序前端
│   ├── app.js                 # 主入口（存在两个版本）
│   ├── app-user-scheme.js     # ⚠️ app.js的旧版本副本
│   ├── pages/
│   │   ├── index/             # 首页
│   │   ├── symptom/guide.js   # 症状自查（3步向导）
│   │   ├── risk/result.js     # 风险评估结果
│   │   ├── emergency/index.js # 急救通道
│   │   ├── hospital/list.js   # 附近医院列表
│   │   ├── pet/profile.js     # 宠物档案管理
│   │   └── user/index.js      # 用户中心
│   └── utils/
│       ├── mapService.js       # 腾讯地图API封装
│       ├── imageUpload.js      # 图片上传安全模块
│       ├── design-tokens.wxss  # 设计系统（250+工具类）
│       ├── ui-components.wxss  # UI组件
│       └── responsive.wxss     # 响应式样式
├── cloudfunctions/            # 云函数后端
│   ├── common/
│   │   ├── constants.js       # 全局常量
│   │   ├── ruleEngine.js      # ⚠️ 旧版规则引擎（未使用）
│   │   └── dbInit.js          # 数据库初始化脚本
│   ├── silentLogin/           # 静默登录 ★
│   ├── submitSymptom/         # 症状评估提交 ★
│   ├── savePet / getPetList / deletePet /
│   ├── getUserStats / getRecordDetail / getHospitals
│   └── login / quickLogin     # ⚠️ 备用登录方案
└── test_archive/              # 历史测试和修复报告（大量）
```

### 1.2 技术栈

| 层 | 技术 | 评价 |
|----|------|------|
| 前端框架 | 微信小程序原生 | ✅ 合适 |
| 后端 | 腾讯云开发 CloudBase | ✅ 合适 |
| 地图API | 腾讯地图 WebService API | ✅ 合适 |
| 数据库 | 云开发数据库 (MongoDB-like) | ✅ 合适 |
| 样式方案 | 自建设计系统 + rpx | ✅ 设计良好 |

---

## 二、严重问题（CRITICAL）

### C1. 双版本 app.js —— 维护灾难

**位置**: [miniprogram/app.js](miniprogram/app.js) vs [miniprogram/app-user-scheme.js](miniprogram/app-user-scheme.js)

两个文件都是 `App()` 入口，但内容差异巨大：

| 特性 | app.js | app-user-scheme.js |
|------|--------|-------------------|
| 降级模式 | ✅ 有 | ❌ 无 |
| 登录回调机制 | ✅ 有 | ❌ 无 |
| 位置权限管理 | ✅ 有 | ❌ 无 |
| 恢复登录状态 | ✅ 有 | ❌ 无 |
| 统一getOpenid | ✅ 有 | ❌ 无 |
| initCloudDevelopment | ✅ 100ms延迟 | ❌ 立即调用 |

**风险**: 如果微信开发者工具加载了错误的入口文件，整个应用行为将完全改变。

**建议**: 立即删除 `app-user-scheme.js`，统一使用 `app.js`。

---

### C2. 规则引擎双版本不一致 —— 评估结果矛盾

**位置**:
- [cloudfunctions/common/ruleEngine.js](cloudfunctions/common/ruleEngine.js) — 使用**中文症状名**（如 `"呕吐"`, `"尿血"`）
- [cloudfunctions/submitSymptom/index.js](cloudfunctions/submitSymptom/index.js) — 使用**英文症状ID**（如 `"vomit"`, `"hematuria"`）

**前端 symptom/guide.js 提交的是英文ID**:

```javascript
// guide.js: 症状数据使用英文ID
{ name: "呕吐", id: "vomit", ... }
// 提交时:
symptomIds: self.data.selectedSymptoms  // ["vomit", "diarrhea", ...]
```

**submitSymptom云函数的高风险症状列表用英文ID**:
```javascript
const HIGH_RISK_SYMPTOMS = ['seizure', 'coma', 'dyspnea', 'bleeding', ...]
```

**但 common/ruleEngine.js 使用中文**:
```javascript
symptoms: ["呕吐", "腹泻", "精神萎靡"]  // 永远无法匹配英文ID
```

**结果**: `common/ruleEngine.js` 如果被任何地方调用，将完全无法匹配前端提交的症状数据。幸运的是 submitSymptom 内置了自己的 evaluateRisk 函数，但代码库中存在两个不同的规则引擎本身就是隐患。

**建议**: 删除 `common/ruleEngine.js` 或统一为英文ID版本。

---

### C3. 用户标识字段不一致 —— 数据孤岛风险

| 云函数 | 用户标识字段 | 查询方式 |
|--------|------------|---------|
| silentLogin | `_openid` | `where({ _openid: OPENID })` |
| savePet | `user_id` | 直接使用前端传入的 openid |
| getPetList | `user_id` | `where({ user_id: openid })` |
| deletePet | `user_id` | `where({ user_id: openid })` |
| submitSymptom | `user_id` | 直接使用前端传入的 openid |
| getUserStats | `user_id` | `where({ user_id: openid })` |

**问题**: `silentLogin` 创建用户时使用 `_openid` 字段，但其他所有云函数查询 `user_id` 字段。虽然前端在两个地方传递的是同一个 openid 值，但如果未来某个地方逻辑改变，`silentLogin` 创建的用户记录将无法被其他云函数找到。

**建议**: 统一所有集合的用户标识字段为 `_openid`（利用云开发自动索引）或全部改为 `user_id`。

---

### C4. Token安全 —— Base64不是加密

**位置**: [cloudfunctions/silentLogin/index.js:70-75](cloudfunctions/silentLogin/index.js)

```javascript
const tokenData = {
  openid: OPENID,
  userId: userData._id,
  expireTime: Date.now() + 7 * 24 * 60 * 60 * 1000
};
const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
```

**问题**:
1. Token 只是 Base64 编码，不是加密，任何人解码即可获取 openid 和 userId
2. 没有签名验证，token 可被伪造
3. 前端从未验证 token 是否被篡改
4. Token 中的 `expireTime` 从未在后端验证

**建议**: 使用 JWT + HMAC 签名，或直接依赖微信小程序自动管理的登录态。

---

### C5. 腾讯地图API密钥泄漏风险

**位置**: [miniprogram/utils/mapConfig.js](miniprogram/utils/mapConfig.js)

**风险**: 如果该文件包含真实的API密钥，在小程序包中可被反编译获取。腾讯地图WebService API密钥应按域名/小程序APPID做白名单限制。

**建议**: 
1. 在腾讯地图控制台将API Key绑定到小程序APPID
2. 将地图搜索逻辑移到云函数中（服务端调用API）

---

## 三、高危问题（HIGH）

### H1. 大量 console.log —— 生产代码污染

**范围**: 全项目所有 JS 文件

几乎每个函数都有 `console.log` 调用，例如：
- `app.js`: 60+ 处
- `pet/profile.js`: 80+ 处
- `symptom/guide.js`: 40+ 处

**风险**:
- 性能影响（每次日志都需要序列化）
- 敏感信息泄漏（openid、位置信息会出现在控制台）
- 违反编码规范中"生产代码不应有 console.log"的要求

**建议**: 实现一个日志工具模块，通过环境变量控制日志级别。

---

### H2. app.js 启动时序不可靠

**位置**: [miniprogram/app.js:88-107](miniprogram/app.js)

```javascript
onLaunch: function () {
    this.restoreLoginState();
    // ...
    setTimeout(() => { this.initCloudDevelopment() }, 100);
    // ...
    setTimeout(() => { this.createMockUser() }, 200);
    // ...
    this.silentLogin();
    // ...
    setTimeout(() => { this.checkFirstLaunch() }, 300);
}
```

**问题**:
1. 使用固定 setTimeout 延迟保证执行顺序是脆弱的
2. 如果 `restoreLoginState()` 的异步通知（100ms延迟）在 `createMockUser()` 之前触发，用户可能被分配模拟openid然后又被覆盖
3. 如果设备性能差，100ms 可能不够云开发初始化完成

**建议**: 使用 Promise 链或 async/await 控制启动顺序。

---

### H3. getHospitals 云函数永远返回模拟数据

**位置**: [cloudfunctions/getHospitals/index.js](cloudfunctions/getHospitals/index.js)

这个云函数声明了 `latitude`, `longitude`, `is24h` 等参数，但函数体内**完全使用硬编码的模拟数据**，参数只影响 mock 数据的经纬度偏移。前端实际上通过 `mapService.js` 直接调用腾讯地图API，该云函数从未被真正用于实时数据。

**建议**: 要么删除此云函数，要么实现真正的数据库查询。

---

### H4. pet/profile.js 函数重复定义

**位置**: [miniprogram/pages/pet/profile.js:858-949](miniprogram/pages/pet/profile.js)

`autoOpenEditModal` 函数被**完全定义了两次**（第858行和第905行），代码完全相同。同样：
- `showAddModal` (247行) 和 `addPet` (300行) **功能相同**
- `showEditModal` (268行) 和 `editPet` (319行) 功能相同但查询字段不同（`_id` vs `petId`）

**风险**: 修改一处忘记修改另一处，导致行为不一致。

**建议**: 立即合并重复函数，保留一个版本。

---

## 四、中危问题（MEDIUM）

### M1. 前端直接调用腾讯地图API

**位置**: [miniprogram/utils/mapService.js:88-143](miniprogram/utils/mapService.js)

`searchWithKeyword` 方法直接从小程序前端通过 `wx.request` 调用腾讯地图API。API密钥暴露在前端代码中。

**建议**: 将地图搜索逻辑移到云函数中，前端只传经纬度。

---

### M2. symptom/guide.js 描述文本中的简单敏感词过滤

**位置**: [miniprogram/pages/symptom/guide.js:397-407](miniprogram/pages/symptom/guide.js)

```javascript
var sensitiveWords = ['激素', '抗生素', '处方药', '剧毒', '致命']
for (var i = 0; i < sensitiveWords.length; i++) {
  if (description.indexOf(sensitiveWords[i]) !== -1) {
    wx.showToast({ title: '描述中包含敏感词汇', ... })
    return
  }
}
```

**问题**:
1. 敏感词列表硬编码，不完整且不灵活
2. 只阻止了输入，但没有解释为什么这些词是敏感的
3. 真正的有害内容（如SQL注入、XSS攻击向量）没有被过滤

---

### M3. 离线/降级数据分散在各页面

每个页面各自维护离线模拟数据：
- [index.js:315-319](miniprogram/pages/index/index.js) — 3个医院
- [emergency/index.js:165-195](miniprogram/pages/emergency/index.js) — 2个急救医院
- [hospital/list.js:186-224](miniprogram/pages/hospital/list.js) — 3个医院
- [pet/profile.js:187-228](miniprogram/pages/pet/profile.js) — 2个宠物
- [risk/result.js:140-170](miniprogram/pages/risk/result.js) — 风险评估示例
- [mapService.js:243-279](miniprogram/utils/mapService.js) — 3个医院

**问题**: 数据和逻辑不一致，修改一处需要同步多处。例如不同页面的医院名称、电话格式都不同。

**建议**: 创建统一的离线数据模块 `utils/offlineData.js`。

---

### M4. 宠物档案编辑使用 petId vs _id 不一致

**位置**: 多处

- `savePet` 云函数接受 `petId` 参数用于编辑
- `deletePet` 云函数接受 `petId` 参数
- `getPetList` 返回 `petId: pet._id`（两者设为相同值）
- 前端映射时需要兼容两种：`pet._id || pet.petId`
- `editPet` 使用 `p.petId` 查找，`showEditModal` 使用 `p._id` 查找

**建议**: 统一使用一个字段名（推荐 `_id`，因为这是云开发数据库的原始字段）。

---

### M5. 硬编码的云环境ID

**位置**: [miniprogram/app.js:382,386](miniprogram/app.js) + [miniprogram/app-user-scheme.js:233,236](miniprogram/app-user-scheme.js)

```javascript
env: 'cloud1-d8gdi44zqfec250b5'
```

云环境ID在多处硬编码。如果环境变更，需要修改多处。

**建议**: 提取到配置文件或使用 `cloud.DYNAMIC_CURRENT_ENV`。

---

## 五、低危问题（LOW）

### L1. 过度依赖 var 声明

全项目使用 `var` 而非 `let`/`const`。虽然项目配置中 `es6: true`，但代码未使用 ES6 块级作用域。

**建议**: 新代码使用 `const` 默认，`let` 按需。

---

### L2. 云函数内重复定义常量

每个云函数都在文件头部重复定义 `COLLECTIONS` 和 `RESPONSE_CODE`，而非引入 `common/constants.js`。

```javascript
// 在 savePet, getPetList, deletePet, getHospitals 中重复定义:
const COLLECTIONS = { USERS: 'users', PETS: 'pets', ... }
const RESPONSE_CODE = { SUCCESS: 0, ERROR: -1, ... }
```

**建议**: 通过 `require('../common/constants')` 统一引入。

---

### L3. login 云函数携带 node_modules

`cloudfunctions/login/node_modules/` 包含完整的 SDK 依赖，但该云函数可能不再使用（已被 silentLogin 取代），造成不必要的部署体积。

---

### L4. silentLogin 中的测试文件

`cloudfunctions/silentLogin/test-simple.js` — 测试文件遗留在了部署目录中，应该移到 test_archive 或删除。

---

### L5. 错误处理不一致

- 有些地方有完整的 try-catch + error logging
- 有些地方只有 console.error
- 有些地方完全忽略错误
- 用户看到的错误信息有时是英文技术术语（如 "error.message"）

---

### L6. app.js onLaunch 中无条件创建模拟用户

```javascript
if (!this.globalData.openid) {
    setTimeout(() => { this.createMockUser() }, 200);
}
```

即使云环境正常，只要 openid 还未返回，就会创建一个模拟用户。后续 silentLogin 成功后 openid 会被覆盖，但模拟数据已经写入了本地存储。

---

## 六、架构设计评价

### 6.1 优点

1. **降级策略完善**: 云开发不可用时自动切换到本地存储模式，用户体验不中断
2. **登录回调机制**: `onLoginComplete` 回调列表设计良好，解决了页面加载时openid未就绪的问题
3. **设计系统**: `design-tokens.wxss` 提供了完整的设计令牌系统，CSS变量组织良好
4. **图片上传安全**: `imageUpload.js` 有完善的格式验证、尺寸检查、文件大小验证
5. **位置权限统一管理**: `app.js` 集中管理位置权限，避免各页面重复逻辑
6. **数据恢复**: `restoreLoginState` 从本地存储完整恢复用户状态
7. **电话拨打安全**: emergency 页面有电话号码验证、清理、格式检查的完整链路

### 6.2 缺点

1. **规则引擎分裂**: 两份规则引擎、不同症状ID体系
2. **缺乏数据层抽象**: 没有 Repository 模式，数据访问逻辑散落在各页面
3. **缺乏统一状态管理**: 依赖 globalData + 本地存储的混合方案
4. **缺乏API层**: 前端直接调用 `wx.cloud.callFunction`，没有封装
5. **没有自动化测试**: 0% 测试覆盖率（只有 test_archive 中的手动测试脚本）
6. **日志系统缺失**: 60+ 处的 console.log 无分级、无过滤

---

## 七、安全审查

### 7.1 通过项

| 检查项 | 状态 |
|--------|------|
| 用户身份验证 | ✅ 通过微信登录 + 云开发 OPENID |
| 数据权限隔离 | ✅ savePet/deletePet 验证 user_id 归属 |
| 图片上传安全 | ✅ 格式/尺寸/大小全面验证 |
| 电话号码验证 | ✅ emergency 页面多重验证 |
| 基本输入验证 | ✅ 云函数参数校验 |

### 7.2 待修复项

| 问题 | 严重度 | 位置 |
|------|--------|------|
| Token 无加密 | CRITICAL | silentLogin/index.js |
| API密钥前端暴露 | HIGH | mapConfig.js |
| openid 在 console.log 中泄漏 | HIGH | 全项目 |
| 无 XSS 防护 | MEDIUM | 所有文本输入 |
| 敏感词过滤不完整 | MEDIUM | symptom/guide.js |
| 无 CSRF 防护 | LOW | 微信小程序天然免疫 |
| 无请求频率限制 | LOW | 所有云函数 |

---

## 八、性能评估

### 8.1 性能优点

- 首页医院数据有5分钟缓存策略
- 位置信息缓存5分钟
- 图片上传前压缩
- 云函数使用 Promise.all 并行查询

### 8.2 性能问题

- 地图搜索使用3个串行关键词请求（应并行）
- app.js 启动链路过长（多个 setTimeout）
- 每次 onShow 可能触发不必要的 API 调用
- 设计系统文件有250+ CSS类定义，大部分未被使用
- 云函数 login 包含完整的 node_modules

---

## 九、修复优先级路线图

### 第一阶段：立即修复（本周）

1. 删除 `app-user-scheme.js`，统一为 `app.js`
2. 删除 `pet/profile.js` 中的重复函数
3. 删除 `silentLogin/test-simple.js`
4. 修复 `silentLogin` 中用户字段 `_openid` → `user_id` 一致性
5. 删除或更新 `common/ruleEngine.js` 使用英文ID

### 第二阶段：短期改进（2周内）

1. 实现日志工具模块，替换所有 console.log
2. 创建统一离线数据模块
3. 云函数常量统一引入 common/constants.js
4. 将地图API调用移到云函数
5. Token 改为 JWT + 签名

### 第三阶段：架构升级（1个月内）

1. 引入 Repository 模式封装数据访问
2. 创建统一的 API 调用层（封装 wx.cloud.callFunction）
3. 添加单元测试框架（至少覆盖云函数核心逻辑）
4. 统一 petId/_id 字段
5. 清理 login/quickLogin 等不再使用的云函数
6. 提取敏感词配置到配置文件

### 第四阶段：持续优化

1. 添加 CI/CD pipeline
2. 实现 comprehensive E2E 测试
3. 添加错误监控和日志收集
4. 清理 test_archive 历史文档（归档到独立仓库）
5. CSS 按需加载优化

---

## 十、总结评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整性 | ★★★★☆ | 核心功能完整，部分功能待开发 |
| 代码质量 | ★★★☆☆ | 重复代码多、命名不一致 |
| 架构设计 | ★★★☆☆ | 降级策略好但缺乏分层抽象 |
| 安全性 | ★★★☆☆ | 基础安全有但Token和API密钥需改进 |
| 性能 | ★★★★☆ | 缓存策略好，无明显瓶颈 |
| 可维护性 | ★★☆☆☆ | 双版本文件、重复定义、测试缺失 |
| 用户体验 | ★★★★☆ | UI设计现代化、降级方案保护体验 |
| **综合** | **★★★☆☆** | **可运行但需重大重构** |

---

> 📋 **审查结论**: 项目功能完整、用户体验良好，但存在亟待解决的关键问题（双版本app.js、规则引擎不一致、Token不安全）。建议按照修复优先级路线图逐步改进，优先解决CRITICAL和HIGH级别问题后再进行功能迭代。
