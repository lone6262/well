# 全维度审查报告

**项目**：微信小程序 + 云函数 + 管理后台
**审查日期**：2025-06-11
**审查范围**：后端安全、后端业务逻辑、前端页面逻辑、前端UI/样式/兼容性、管理后台

---

## 执行摘要

| 维度 | CRITICAL | HIGH | MEDIUM | LOW | 合计 |
|------|----------|------|--------|-----|------|
| 后端安全 | 4 | 7 | 8 | 5 | 24 |
| 后端业务逻辑 | 4 | 9 | 12 | 6 | 31 |
| 前端页面逻辑 | 4 | 8 | 14 | 8 | 34 |
| 前端UI/样式/兼容性 | - | - | - | - | 待补充 |
| 管理后台 | 3 | 6 | 7 | 6 | 22 |
| **合计** | **15** | **30** | **41** | **25** | **111+** |

---

## 一、后端安全审查（云函数）

### CRITICAL 级别（4项）

| 编号 | 文件:行号 | 问题描述 | 原因/影响 |
|------|-----------|---------|----------|
| **CRITICAL-1** | `payCallback/index.js:42` | **MOCK_PAY=true 导致支付签名验证被完全绕过** | 任何人只要构造包含合法 `out_trade_no` 的请求体，即可伪造支付成功回调，免费获取所有付费服务。最高风险。 |
| **CRITICAL-2** | `createOrder/index.js:29`, `memberActivate/index.js:22`, `purchasePoints/index.js:12`, `renewMemberByAuto/index.js:14` | **多处 MOCK_PAY=true 未移除，模拟支付在生产环境仍激活** | 可以在无任何真实支付的情况下完成所有购买，等同于全平台免费。 |
| **CRITICAL-3** | `processRefund/index.js:14-15` | **退款审批仅检查 adminSecret 是否存在，未验证其值** | `if (!adminSecret)` 只判断非空，未与 `SERVER_CONFIG.ADMIN_SECRET` 比较。任意用户可伪造管理员身份批准退款，造成资金损失。 |
| **CRITICAL-4** | `adminGateway/index.js:53-55` | **adminGateway 的 DIRECT_ACTIONS 未验证 token 有效性** | Gateway 层只检查 token 是否存在，未调用 `verifyAdminToken()`。约 14 个高危操作（退款、会员取消、风控放行等）可被任意用户执行。 |

### HIGH 级别（7项）

| 编号 | 文件:行号 | 问题描述 | 原因/影响 |
|------|-----------|---------|----------|
| **HIGH-1** | `adminLogin/index.js:78` | **adminSecret 明文比较存在时序攻击风险** | 应使用常量时间比较 `timingSafeEqual`，可通过高频请求逐字节猜测密钥。 |
| **HIGH-2** | `processInviteReward/index.js:5-14` | **processInviteReward 缺少 Token 验证 + warmupConfig 未导入** | 任何知道 inviteCode 的人可代替他人领取奖励；且 `warmupConfig is not defined` 导致函数崩溃。 |
| **HIGH-3** | `autoIssueCoupon/index.js` | **autoIssueCoupon 无任何身份验证** | 设计为内部调用但无鉴权，任何人可批量为任意用户发放优惠券。 |
| **HIGH-4** | `consumePoint/index.js:11-14`, `refundPoint/index.js:11-12`, `rollbackCoupon/index.js:11` | **内部云函数无身份验证，接受外部传入 openid** | `refundPoint` 可无限增加任意用户点数；`rollbackCoupon` 可重复使用已核销优惠券。 |
| **HIGH-5** | `acceptFamilyInvite/index.js:83-95` | **查询用户记录使用 _openid 字段而非 user_id** | 整个项目统一使用 `user_id`，此处用 `_openid` 导致家庭会员邀请功能数据错误。 |
| **HIGH-6** | `inviteFamilyMember/index.js:21-27` | **邀请码使用 Math.random() 生成，密码学不安全** | 8位62字符集约47 bits，可被暴力枚举猜测。对比 `createInvite` 使用 `crypto.randomBytes(8).toString('hex')` 的安全实现。 |
| **HIGH-7** | `payCallback/index.js:129` | **金额一致性校验在 MOCK_PAY=true 时被跳过** | 即使切换真实支付，签名验证使用 V2 MD5 算法（第277行），若接入 V3 API 需完整重写。 |

### MEDIUM 级别（8项）

- **MEDIUM-1**: `adminGetUsers/index.js:59-65` — 搜索功能直接将用户输入作为正则表达式，存在 ReDoS 风险
- **MEDIUM-2**: `constants.js:459-511` — warmupConfig 幂等保护基于模块级变量，密钥轮换无法生效
- **MEDIUM-3**: `receiveCoupon/index.js:34-64` — 优惠券发放存在 TOCTOU 竞态条件，可超发
- **MEDIUM-4**: `adminGateway/index.js:75` — 内部错误信息直接暴露给调用方
- **MEDIUM-5**: `adminUpdateConfig/index.js:57-84` — 允许写入任意键到 system_config，无白名单
- **MEDIUM-6**: `memberActivate/index.js:200-217` — Mock 模式先更新会员后创建订单，数据不一致
- **MEDIUM-7**: `rate-limiter.js:36` — 速率限制非原子操作，可被并发绕过
- **MEDIUM-8**: `createOrder/index.js:80-82` — 代码结构错误，顶层存在孤立 try 块

### LOW 级别（5项）

- **LOW-1**: `silentLogin/index.js:107` — 将 verifyToken 导出为 exports，增加攻击面
- **LOW-2**: `processInviteReward/index.js` — 缺少 Token 验证风格不一致
- **LOW-3**: `createOrder/index.js:57-58` — openid 检查在限流之后
- **LOW-4**: `audit-logger.js` — 审计日志仅覆盖部分高危操作
- **LOW-5**: `payCallback/index.js:224-228` — 未知异常返回 OK 可能掩盖系统故障

---

## 二、后端业务逻辑审查（云函数）

### CRITICAL 级别（4项）

| 编号 | 文件:行号 | 问题描述 | 原因/影响 |
|------|-----------|---------|----------|
| **CRITICAL-1** | `createOrder/index.js:80-81` | **语法结构破损，try 块悬空** | `exports.main` 闭合后出现孤立 `try {`，是代码合并错误残留，可能导致云函数无法部署。 |
| **CRITICAL-2** | `processInviteReward/index.js:28` | **warmupConfig 未导入但被调用** | `warmupConfig` 没有从 require 解构，运行时抛 `ReferenceError`，邀请奖励处理完全失败。 |
| **CRITICAL-3** | `generateAIReport/index.js:237–336` | **额度先扣减再生成报告，生成失败时额度不回滚** | 用户可免费获取报告（额度扣减失败），或产生无法对账的孤儿订单。 |
| **CRITICAL-4** | `memberActivate/index.js:157–169` | **先激活会员后创建订单，并发下无幂等保护** | 若订单创建失败，会员已激活但无订单记录，既无法对账也无法退款。 |

### HIGH 级别（9项）

| 编号 | 文件:行号 | 问题描述 | 原因/影响 |
|------|-----------|---------|----------|
| **HIGH-1** | `createOrder/index.js:151–155 vs 192–226` | **报告订单：额度先扣减后二次去重，存在时间窗口竞态** | 两个并发请求可同时通过检查、都扣减额度，最终用户多扣一次额度。 |
| **HIGH-2** | `payCallback/index.js:345–348` | **creditPoints 参数字段名不匹配** | `metadata.points_count` 为 `undefined`（实际是 `pack_count`），真实支付后点数到账为 0。 |
| **HIGH-3** | `receiveCoupon/index.js:33–65` | **领取优惠券存在 TOCTOU 竞态，可超发** | 100 个并发同时读到 `total_issued = 99`，全部通过检查，最终 `total_issued = 199`。 |
| **HIGH-4** | `processRefund/index.js:14–15` | **管理员鉴权仅检查 adminSecret 是否存在，未验证其值** | 任何传入非空字符串的调用都能通过鉴权执行退款操作。 |
| **HIGH-5** | `cancelOrder/index.js:54–56` | **回滚会员额度依赖 metadata.member_id，但 createOrder 中未存储** | 取消订单时会员额度永远无法回滚，用户会损失额度。 |
| **HIGH-6** | `renewMemberByAuto/index.js:55–73` | **自动续费使用 member.plan_type 但 members 集合存储的是 type 字段** | `planType` 永远为 `undefined`，所有自动续费返回 `unknown_plan_type` 失败，功能完全不可用。 |
| **HIGH-7** | `acceptFamilyInvite/index.js:63` | **家庭成员数量上限校验基于快照值，存在并发超限竞态** | 两个并发请求同时读到 `length = 3`（上限4），都执行 `_.push`，最终达到 5 人。 |
| **HIGH-8** | `inviteFamilyMember/index.js:76–80` | **邀请码无过期清理，pending_invites 数组无限增长且无唯一性校验** | 无清除过期 invites、无限制数组长度、无检查槽位被占满，且使用 `Math.random()` 非密码学安全。 |
| **HIGH-9** | `generateAIReport/index.js:244–296` | **两套并行的额度扣减路径，与 createOrder 重复扣减** | `generateAIReport` 有独立扣减逻辑，两者都被调用时用户额度被扣两次。 |

### MEDIUM 级别（12项）

- **MEDIUM-1**: `payCallback/index.js:222–228` — 未知异常返回 OK 导致微信支付停止重试，但业务可能未处理
- **MEDIUM-2**: `processRefund/index.js:118–147` — rollbackUserResources 仅回滚 member 类型订单
- **MEDIUM-3**: `processRefund/index.js:76–82` — 退款金额未验证，可申请超额退款
- **MEDIUM-4**: `checkExpiredMembers/index.js:33–67` — 分页扫描存在漏处理问题
- **MEDIUM-5**: `createOrder/index.js:667–675` — calcNextReset 月份计算逻辑 off-by-one
- **MEDIUM-6**: `purchasePoints/index.js:124–129` — 点数流水中 balance_after 基于 stale 读取值计算
- **MEDIUM-7**: `processInviteReward/index.js:119–172` — 奖励发放部分成功时回滚不完整
- **MEDIUM-8**: `renewMemberByAuto/index.js:73–74` — 自动续费重置额度时使用固定30天，而非按开通日对齐
- **MEDIUM-9**: `closeExpiredOrders/index.js:38–50` — 关闭订单后才回滚资源，若更新成功但回滚失败无补偿
- **MEDIUM-10**: `getPointsBalance/index.js:28` — 仅展示层判断过期，实际余额字段未清零
- **MEDIUM-11**: `processInviteReward/index.js:175–184` — 里程碑总数统计在原子更新之后，计数可能比实际多1
- **MEDIUM-12**: `createOrder/index.js:519–554` — Bundle 套餐子订单创建成功后，主订单创建失败无回滚

### LOW 级别（6项）

- **LOW-1**: `acceptFamilyInvite/index.js:83` — 查询用户记录时使用 _openid 字段，与其他云函数不一致
- **LOW-2**: `constants.js:446,459` — warmupConfig 的模块级单例在热实例复用时可能缓存失效配置
- **LOW-3**: `checkReportQuota/index.js:103–164` — 未检查 trial 会员额度
- **LOW-4**: `followupSubmit/index.js:82–89` — 回访发券无幂等保护
- **LOW-5**: `sendExpireReminder` — 待确认调用关系
- **LOW-6**: `createOrder/index.js:148` — 订单号使用 Date.now() + Math.random()，存在重复风险

---

## 三、前端页面逻辑审查（小程序 JS）

### CRITICAL 级别（4项）

| 编号 | 文件:行号 | 问题描述 | 原因/影响 |
|------|-----------|---------|----------|
| **C-1** | `pages/order/detail.js:125` | **退款后 loadOrder() 无参数调用，必定报错** | `loadOrder` 签名是 `loadOrder(orderId)`，无参调用导致 `orderId` 为 `undefined`，云函数接收空参数，退款后界面状态不刷新。 |
| **C-2** | `pages/member/order.js:158` | **支付流程有 1.5 秒无意义 setTimeout 延迟，且 isDestroyed 机制不完整** | 人工延迟增加等待时间；边界条件下 `purchasing` 状态可能永久锁死。 |
| **C-3** | `utils/api.js:15` | **模块顶层调用 getApp() 存在时序风险** | `getApp()` 在模块加载时立即执行，若页面在 onLaunch 阶段 require 此模块，可能返回 `undefined`，导致整个 API 调用层失效。 |
| **C-4** | `pages/validate/validate.js:45-47` | **直接 mutation this.data 后再 setData，违反框架规范** | `this.data.logs.push(...)` 直接修改，会导致框架 dirty-check 失效，视图可能不更新。 |

### HIGH 级别（8项）

| 编号 | 文件:行号 | 问题描述 | 原因/影响 |
|------|-----------|---------|----------|
| **H-1** | `pages/user/index.js:530-531, 567-568, 610-611` | **多处直接 mutate this.data 中的对象** | `userInfo.avatar = res.fileID` 直接改 data 里的对象，框架 dirty-check 失效，视图可能不刷新。 |
| **H-2** | `pages/order/list.js:46-53` | **直接 mutate 云函数返回的原始对象** | `newOrders[i].typeText = ...` 直接修改返回数据，违反不可变原则。 |
| **H-3** | `pages/index/data-loader.js:57-60` | **loadPetList 直接调用 wx.cloud.callFunction 而非统一 API 层** | 绕过 loading 关闭，错误处理不一致。 |
| **H-4** | `pages/pet/profile.js:173-178` | **退出登录重新登录时直接清空 token 再调 silentLogin，存在竞态** | 多次点击"立即登录"按钮将触发多次 `silentLogin` 并累积回调，重复弹出添加宠物弹窗。 |
| **H-5** | `pages/risk/result.js:447-448, pages/symptom/guide.js:700-703` | **wx.showLoading 在某些失败路径无对应 wx.hideLoading** | 用户界面卡在"加载中"状态或意外关闭其他页面 loading。 |
| **H-6** | `pages/member/index.js:24-34, pages/member/status.js:27-33` | **onLoad + onShow 都调 loadMemberStatus，每次显示双重请求** | 每次从子页面返回都触发 2 个云函数调用。 |
| **H-7** | `pages/pet/profile.js:50-52` | **onShow 无条件调 loadPetList，每次切换 Tab 都重新拉取** | 每次返回都重新拉取全量宠物列表，流量浪费且有 loading 闪烁。 |
| **H-8** | `pages/knowledge/list.js:147` | **onPullDownRefresh 调用 wx.stopPullDownRefresh() 后才调 loadArticles** | 下拉刷新动画立即消失，但数据还在加载，UI 反馈不正确。 |

### MEDIUM 级别（14项）

- **M-1**: `app.js:103` — onLaunch 强制清空 token 后再恢复，逻辑矛盾
- **M-2**: `pages/risk/result.js:108` — loadAssessmentDetail 中重复调用 getApp()
- **M-3**: `pages/symptom/guide.js:704-709` — 提交评估的超时保护时间（5秒）过短
- **M-4**: `pages/index/data-loader.js:156` — formatHospitals 中 id 使用 Date.now() + Math.random() 作为 fallback
- **M-5**: `pages/pet/record-manager.js:12-16` — loadRecordCounts 拉取 pageSize:100 全量记录
- **M-6**: `pages/member/order.js:154-165` — doPurchase 中 1.5 秒 setTimeout 内云函数调用无登录态验证
- **M-7**: `pages/invite/index.js:278` — Canvas 海报生成使用 setTimeout(fn, 300) 等待绘制完成
- **M-8**: `pages/pet/profile.js:83-89` — showEmptyState 中 this 绑定使用 .bind(this) 后又在回调内访问 this._emptyStateShown
- **M-9**: `pages/knowledge/detail.js:32-35` — 知识库详情要求必须登录，游客无法浏览公开内容
- **M-10**: `pages/hospital/list.js:33-36` — onShow 中 hospitals.length > 0 才刷新，首次加载失败后 onShow 不重试
- **M-11**: `app.js:167-169` — env ID 硬编码在 app.js
- **M-12**: `pages/user/index.js:203-210` — 两次连续 setData 更新 userStats，应合并
- **M-13**: `pages/member/order.js:186-190` — 会员开通成功后跳转 redirectTo 传递硬编码 riskLevel=mid
- **M-14**: `pages/coupon/list.js:21-38` — onLoad + onShow 都调 loadCoupons，每次回到页面重复请求

### LOW 级别（8项）

- **L-1**: `utils/login-manager.js` — 文件存在但实际未被任何页面 require（死代码）
- **L-2**: `app.js:142-147` — 30 秒登录回调超时清理的 setTimeout 本身未被清理
- **L-3**: `pages/index/index.js:279-282` — addPet 中 setTimeout 内为空函数
- **L-4**: `pages/risk/result.js:371` — 免责声明 key 使用字符串魔法值
- **L-5**: `utils/constants.js:22` — SEARCH_RADIUS 注释写"5 米"，实际是 5000 即 5 公里
- **L-6**: `pages/user/index.js:334-336` — 登录超时保护用 setTimeout 3 秒 hideLoading，与 onLoginComplete 竞争
- **L-7**: `pages/symptom/guide.js:571-604` — _validateSubmission 中兜底提取症状逻辑说明状态同步问题
- **L-8**: `pages/emergency/index.js:219-230` — 离线急救数据地址与坐标不一致

---

## 四、前端 UI/样式/兼容性审查（小程序 WXML/WXSS）

> 注：此维度审查代理未能正常返回结果，建议手动补充审查以下重点：
> 
> 1. **样式一致性**：硬编码色值是否清理完毕？是否遗留旧渐变/emoji？
> 2. **布局响应式**：rpx 使用、固定 px 溢出、图片 mode、长文本处理
> 3. **安全区适配**：iPhone 刘海/底部 home bar 的 safe-area-inset 处理
> 4. **交互状态**：按钮 hover-class/禁用态、loading/空状态/错误状态
> 5. **WXML 质量**：wx:for 缺失 wx:key、内联样式滥用、空 bindtap
> 6. **兼容性**：高版本基础库 API 降级、lazyCodeLoading、分包配置

---

## 五、管理后台审查（admin）

### CRITICAL 级别（3项）

| 编号 | 文件:行号 | 问题描述 | 原因/影响 |
|------|-----------|---------|----------|
| **CRITICAL-1** | `admin/js/auth.js:32-42` / `admin/src/auth.js:50-58` | **前端鉴权完全依赖客户端 Token 校验，无法防止绕过** | 攻击者可在浏览器控制台修改 localStorage 绕过登录页直接访问 dashboard。 |
| **CRITICAL-2** | `admin/js/auth.js:10,17` | **adminToken 存入 localStorage，存在 XSS 窃取风险** | 任何 XSS 漏洞均可通过 `localStorage.getItem('adminToken')` 窃取 token。 |
| **CRITICAL-3** | `admin/js/orders.js:50` / `admin/src/orders.js:48` | **订单金额直接使用服务端字符串 amountDisplay，未经数值化处理** | 若服务端数据被篡改，可插入任意字符串实现 XSS。 |

### HIGH 级别（6项）

| 编号 | 文件:行号 | 问题描述 | 原因/影响 |
|------|-----------|---------|----------|
| **HIGH-1** | `admin/js/bills.js:114` / `admin/src/bills.js:109` | **runBillCheck 调用未在 CLOUD_FUNCTIONS 中注册的云函数名** | 硬编码调用 `checkDailyBill` 而非 `adminGateway`，可能绕过网关鉴权。 |
| **HIGH-2** | `admin/js/crud-base.js:122,127` | **confirmedAction 重新命名局部变量 message 遮蔽外层参数** | 遮蔽变量是常见 bug 来源。 |
| **HIGH-3** | `admin/js/orders.js:65` | **refundOrder（js 版）调用了不存在的函数 confirmedAction** | 脚本加载顺序出错时会抛 `ReferenceError`，退款按钮静默失效。 |
| **HIGH-4** | `admin/js/refunds.js:67-75` / `admin/src/refunds.js` | **退款审批缺少二次防重复提交保护** | 多次点击"批准"可能触发多个并发云函数调用。 |
| **HIGH-5** | `admin/js/refunds.js:81` / `admin/src/risk.js:114` | **拒绝退款原因通过原生 prompt() 收集，UX 降级且不受 CSP 保护** | `prompt` 在严格 CSP 下会被阻断，冻结原因未 trim/限制长度。 |
| **HIGH-6** | 整个 `admin/js/` vs `admin/src/` | **两套并行代码产生逻辑分叉，维护风险极高** | 修复一个 bug 可能只修了一套，另一套仍有漏洞。 |

### MEDIUM 级别（7项）

- **MEDIUM-1**: `admin/index.html:1-8` / `admin/dashboard.html:1-8` — 无 Content-Security-Policy（CSP）HTTP 头
- **MEDIUM-2**: `admin/js/tcb-utils.js:16-20` / `admin/src/auth.js:62-73` — clearCloudBaseCache 每次加载清除所有相关 localStorage
- **MEDIUM-3**: `admin/js/articles.js:94-108` / `admin/src/articles.js` — 文章编辑功能不完整，loadArticleData 是空实现
- **MEDIUM-4**: `admin/js/app.js:305-313` vs `admin/dashboard.html:514-543` — 价格配置页面存在未保存字段
- **MEDIUM-5**: `admin/js/bills.js:96` / `admin/js/members.js:101` — 对账差异详情和会员详情使用 alert() 展示多行数据
- **MEDIUM-6**: `admin/js/app.js:221-252` / `admin/src/app.js:54-86` — switchTab 每次切换都重新调用 init*Module()，重复绑定事件
- **MEDIUM-7**: `admin/src/risk.js:114-130` / `admin/js/risk.js:114-130` — blockRiskOrder 提交后未校验冻结原因

### LOW 级别（6项）

- **LOW-1**: `admin/js/config.js:8` / `admin/src/config.js:4` — 云环境 ID 硬编码在源码中
- **LOW-2**: `admin/js/auth.js:56-62` — auth.js 的 checkAuth 在单页应用中路径判断脆弱
- **LOW-3**: `admin/js/app.js:9-22` / `admin/src/utils.js` — formatDate/formatDateTime 对无效日期值无防御
- **LOW-4**: `admin/index.html:79` — 登录页 showError 错误信息来自网络异常可能泄露技术细节
- **LOW-5**: `admin/js/crud-base.js:88-96` — createCrudLoader 中 dataPath 路径提取无类型校验
- **LOW-6**: `admin/js/auth.js:47-51` / `admin/src/main.js:36-38` — 无退出登录的服务端 Token 吊销

---

## 优先修复建议（TOP 10）

| 优先级 | 问题 | 维度 | 核心风险 |
|--------|------|------|---------|
| 1 | **CRITICAL-1/2**: 关闭所有 MOCK_PAY=true | 后端安全 | 支付验证被绕过，全平台免费 |
| 2 | **CRITICAL-3**: processRefund 补全密钥比对 | 后端安全 | 任意用户可批准退款 |
| 3 | **CRITICAL-4**: adminGateway 补验 token | 后端安全 | 14个高危操作可被任意执行 |
| 4 | **CRITICAL-2**: warmupConfig 未导入 | 后端业务逻辑 | 邀请奖励处理完全失败 |
| 5 | **CRITICAL-1**: createOrder 语法破损 | 后端业务逻辑 | 云函数可能无法部署 |
| 6 | **HIGH-2**: payCallback 点数字段名不匹配 | 后端业务逻辑 | 真实支付后点数到账为 0 |
| 7 | **HIGH-6**: 自动续费 plan_type 字段名错误 | 后端业务逻辑 | 自动续费功能完全失效 |
| 8 | **C-3**: utils/api.js 顶层 getApp() | 前端逻辑 | 启动时序错误可能导致白屏 |
| 9 | **CRITICAL-2**: adminToken 存 localStorage | 管理后台 | XSS 可窃取管理员凭证 |
| 10 | **MEDIUM-4**: 价格配置页面未保存字段 | 管理后台 | 运营数据错误 |

---

## 审查方法说明

本次审查采用以下方法：

1. **后端安全**：security-reviewer 代理审查云函数鉴权、支付安全、注入、敏感信息、限流等
2. **后端业务逻辑**：code-reviewer 代理审查订单/支付/积分/优惠券/会员流程的正确性、竞态、幂等性
3. **前端页面逻辑**：code-reviewer 代理审查 setData 性能、生命周期、错误处理、防重复提交、代码质量
4. **前端UI/样式**：计划审查样式一致性、布局响应式、安全区适配、交互状态、WXML质量（代理未返回结果）
5. **管理后台**：security-reviewer 代理审查登录态、鉴权、XSS、业务逻辑、代码质量

---

## 下一步行动建议

1. **立即修复**：所有 CRITICAL 级别问题（15 项），特别是支付相关的 MOCK_PAY 关闭
2. **短期修复**：HIGH 级别问题（30 项），重点解决自动续费失效、点数到账为 0 等功能缺陷
3. **中期优化**：MEDIUM 级别问题（41 项），包括竞态条件、数据一致性、用户体验改进
4. **长期改进**：LOW 级别问题（25+ 项）及代码质量提升、补充 UI/样式审查
5. **建立机制**：
   - 发布前 checklist（关闭 MOCK、鉴权测试、支付验证）
   - 安全审计流程（密钥管理、鉴权统一）
   - 代码规范（不可变数据、错误处理、样式令牌化）
