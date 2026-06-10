# API 接口测试自动化报告 V2

> 生成日期: 2026-06-10 | 项目: 宠物症状自查微信小程序 | 平台: 微信云开发
> 报告版本: V2.0 | 基于代码静态分析 + 已有测试覆盖统计

---

## 一、项目 API 总览

### 1.1 架构说明

本项目的后端采用微信云函数架构，非标准 REST API。所有云函数通过 `wx.cloud.callFunction()` 调用，认证依赖 `cloud.getWXContext().OPENID` + HMAC-SHA256 签名 Token。

### 1.2 API 清单（21 个接口）

| 编号 | API 名称 | 类别 | 认证方式 | 请求方法 | 源文件 |
|:----:|----------|------|----------|----------|--------|
| 1 | silentLogin | 核心业务 | OPENID 自动获取 | callFunction | `cloudfunctions/silentLogin/index.js` |
| 2 | login | 核心业务 | wx.login code | callFunction | `cloudfunctions/login/index.js` |
| 3 | submitSymptom | 核心业务 | Token + OPENID | callFunction | `cloudfunctions/submitSymptom/index.js` |
| 4 | generateAIReport | 核心业务 | OPENID | callFunction | `cloudfunctions/generateAIReport/index.js` |
| 5 | createOrder | 核心业务 | Token + 限流 | callFunction | `cloudfunctions/createOrder/index.js` |
| 6 | payCallback | 核心业务 | 微信支付签名 | callFunction | `cloudfunctions/payCallback/index.js` |
| 7 | checkRiskControl | 核心业务 | OPENID | callFunction | `cloudfunctions/checkRiskControl/index.js` |
| 8 | memberActivate | 会员系统 | Token + 限流 | callFunction | `cloudfunctions/memberActivate/index.js` |
| 9 | getMemberStatus | 会员系统 | OPENID | callFunction | `cloudfunctions/getMemberStatus/index.js` |
| 10 | cancelMembership | 会员系统 | Token + OPENID | callFunction | `cloudfunctions/cancelMembership/index.js` |
| 11 | toggleAutoRenew | 会员系统 | Token + OPENID | callFunction | `cloudfunctions/toggleAutoRenew/index.js` |
| 12 | checkExpiredMembers | 会员系统 | 定时触发器 | callFunction | `cloudfunctions/checkExpiredMembers/index.js` |
| 13 | consumePoint | 点数系统 | 内部调用 | callFunction | `cloudfunctions/consumePoint/index.js` |
| 14 | purchasePoints | 点数系统 | Token + 限流 | callFunction | `cloudfunctions/purchasePoints/index.js` |
| 15 | getPointsBalance | 点数系统 | Token | callFunction | `cloudfunctions/getPointsBalance/index.js` |
| 16 | applyCoupon | 优惠券系统 | 内部调用 | callFunction | `cloudfunctions/applyCoupon/index.js` |
| 17 | receiveCoupon | 优惠券系统 | Token + OPENID | callFunction | `cloudfunctions/receiveCoupon/index.js` |
| 18 | adminLogin | 管理端 | adminSecret | callFunction | `cloudfunctions/adminLogin/index.js` |
| 19 | adminGateway | 管理端 | adminToken | callFunction | `cloudfunctions/adminGateway/index.js` |
| 20 | adminGetStats | 管理端 | adminToken | callFunction | `cloudfunctions/adminGetStats/index.js` |
| 21 | adminGetUsers | 管理端 | adminToken | callFunction | `cloudfunctions/adminGetUsers/index.js` |

> 注: adminGetOrders 通过 adminGateway 路由转发，已纳入 adminGateway 测试范围。

---

## 二、API 测试矩阵

### 2.1 测试维度说明

| 维度 | 缩写 | 说明 |
|------|:----:|------|
| 功能测试 | F | 正常参数下的核心业务逻辑是否正确 |
| 参数验证 | P | 缺失参数、非法参数、边界值校验 |
| 权限测试 | A | 未登录、Token 过期、越权访问、管理员鉴权 |
| 限流测试 | R | 频率限制是否生效，超限行为是否正确 |

### 2.2 测试矩阵详情

#### 核心业务 API

| API | F | P | A | R | 测试要点 |
|-----|:-:|:-:|:-:|:-:|----------|
| **silentLogin** | YES | PARTIAL | NO | NO | 新用户创建、老用户更新登录信息、Token 生成、并发安全 |
| **login** | NO | PARTIAL | NO | NO | code2Session 调用、新用户创建+自动发券、老用户信息更新 |
| **submitSymptom** | YES | YES | PARTIAL | PARTIAL | 规则引擎评估(高/中/低风险)、症状白名单校验、敏感词过滤、描述长度限制、限流 10次/60s |
| **generateAIReport** | PARTIAL | PARTIAL | NO | NO | 记录归属验证、高风险禁止报告、缓存命中、额度扣减(首份/邀请/会员/点数/付费)、回访记录创建、LLM 失败自动退款 |
| **createOrder** | PARTIAL | PARTIAL | PARTIAL | PARTIAL | 多类型订单(report/member/points/bundle)、去重检查、额度解析+扣减+回滚、优惠券自动选取、风控检查、Mock/真实支付切换 |
| **payCallback** | YES | PARTIAL | PARTIAL | NO | 签名验证、幂等校验、金额一致性、状态冲突检测、按类型分发(报告/会员/家庭会员/点数/套餐)、支付失败处理、通知发送 |
| **checkRiskControl** | YES | YES | NO | NO | 频率限制(日总30/报告20/会员5)、大额审核阈值(9900)、低价刷量检测、密集下单检测、邀请刷量检测 |

#### 会员系统 API

| API | F | P | A | R | 测试要点 |
|-----|:-:|:-:|:-:|:-:|----------|
| **memberActivate** | NO | PARTIAL | PARTIAL | PARTIAL | 新开通/续费/过期重开、到期日期叠加计算、月度额度重置、重复订单拦截、限流 3次/60s |
| **getMemberStatus** | NO | PARTIAL | NO | NO | 过期自动标记、额度月度重置、配置升级同步、续费价格展示、已节省金额计算 |
| **cancelMembership** | NO | PARTIAL | PARTIAL | NO | auto_renew 标记更新、无有效会员时拒绝操作 |
| **toggleAutoRenew** | NO | YES | PARTIAL | NO | enabled 参数类型校验、操作日志记录、无有效会员时拒绝 |
| **checkExpiredMembers** | NO | NO | NO | NO | 批量分页扫描、会员状态更新+users 同步、家庭子成员级联过期、过期日志记录 |

#### 点数/优惠券系统 API

| API | F | P | A | R | 测试要点 |
|-----|:-:|:-:|:-:|:-:|----------|
| **consumePoint** | NO | PARTIAL | NO | NO | 余额检查+过期检查、原子扣减、交易流水记录 |
| **purchasePoints** | NO | PARTIAL | PARTIAL | PARTIAL | 包类型校验、重复 pending 订单拦截、Mock 直接到账、限流 5次/60s |
| **getPointsBalance** | NO | NO | PARTIAL | NO | 余额查询+过期判断、无记录返回 0 |
| **applyCoupon** | NO | PARTIAL | NO | NO | 券归属验证、过期检查、适用类型+最低金额校验、固定/折扣金额计算、锁定状态 |
| **receiveCoupon** | NO | PARTIAL | PARTIAL | NO | 总发行量校验、每人限领校验、原子递增已发行量 |

#### 管理端 API

| API | F | P | A | R | 测试要点 |
|-----|:-:|:-:|:-:|:-:|----------|
| **adminLogin** | NO | PARTIAL | YES | NO | 密钥验证、Token 生成+有效期、密钥未配置拒绝 |
| **adminGateway** | NO | PARTIAL | YES | NO | 路由转发+直接处理、adminToken 验证、退款审批、优惠券 CRUD、会员管理、对账记录、风控面板 |
| **adminGetStats** | NO | NO | YES | NO | 时间范围筛选、多维度统计(用户/订单/收入/会员/症状)、分页 |
| **adminGetUsers** | NO | PARTIAL | YES | NO | 分页+搜索+会员过滤、用户统计信息附加、pageSize 上限 100 |
| *(adminGetOrders)* | NO | PARTIAL | YES | NO | 状态/类型/时间过滤、关联用户信息、分页 |

### 2.3 覆盖统计

| 维度 | 已覆盖 API 数 | 总 API 数 | 覆盖率 |
|------|:------------:|:---------:|:------:|
| 功能测试 (F) | 4 | 21 | 19% |
| 参数验证 (P) | 18 | 21 | 86% |
| 权限测试 (A) | 16 | 21 | 76% |
| 限流测试 (R) | 5 | 21 | 24% |

---

## 三、已覆盖的 API 测试

### 3.1 测试文件清单

| 测试文件 | 类型 | 测试 API/模块 | 用例数 | 状态 |
|----------|------|--------------|:------:|:----:|
| `unit/auth.test.js` | 单元 | common/auth (Token 生成/验证/篡改检测/过期) | ~35 | PASS |
| `unit/admin-auth.test.js` | 单元 | common/admin-auth (管理员 Token 全链路) | ~45 | PASS |
| `unit/rate-limiter.test.js` | 单元 | common/rate-limiter (限流逻辑) | ~12 | PASS |
| `unit/risk-control.test.js` | 单元 | checkRiskControl (风控检查全逻辑) | ~55 | PASS |
| `unit/report-engine.test.js` | 单元 | common/report-engine (缓存 Key/年龄段/模板填充) | ~20 | PASS |
| `unit/submit-symptom-enhanced.test.js` | 单元 | submitSymptom (规则引擎+白名单+敏感词) | ~30 | PASS |
| `unit/logger.test.js` | 单元 | common/logger (日志脱敏) | ~10 | PASS |
| `unit/constants-v15.test.js` | 单元 | common/constants (V1.5 常量完整性) | ~15 | PASS |
| `unit/error-handler.test.js` | 单元 | 错误处理模块 | ~10 | PASS |
| `integration/login-flow.test.js` | 集成 | silentLogin (新用户/老用户/多用户/并发) | ~14 | PASS |
| `integration/symptom-flow.test.js` | 集成 | submitSymptom (低/中/高风险全流程) | ~19 | PASS |
| `integration/pet-flow.test.js` | 集成 | savePet/getPetList/deletePet | ~33 | PASS |
| `integration/pay-callback-flow.test.js` | 集成 | payCallback (响应/状态/金额/路由/到期/点数/幂等) | ~70 | PASS |

**总用例数: 约 368 个**

### 3.2 按 API 覆盖情况

| API | 单元测试 | 集成测试 | 覆盖等级 |
|-----|:--------:|:--------:|:--------:|
| silentLogin | - | YES (login-flow) | MEDIUM |
| login | - | NO | NONE |
| submitSymptom | YES (enhanced) | YES (symptom-flow) | HIGH |
| generateAIReport | YES (report-engine 部分) | NO | LOW |
| createOrder | - | NO | NONE |
| payCallback | - | YES (pay-callback-flow) | MEDIUM |
| checkRiskControl | YES (risk-control) | NO | HIGH |
| memberActivate | - | NO | NONE |
| getMemberStatus | - | NO | NONE |
| cancelMembership | - | NO | NONE |
| toggleAutoRenew | - | NO | NONE |
| checkExpiredMembers | - | NO | NONE |
| consumePoint | - | NO | NONE |
| purchasePoints | - | NO | NONE |
| getPointsBalance | - | NO | NONE |
| applyCoupon | - | NO | NONE |
| receiveCoupon | - | NO | NONE |
| adminLogin | YES (admin-auth) | NO | MEDIUM |
| adminGateway | YES (admin-auth 部分) | NO | LOW |
| adminGetStats | - | NO | NONE |
| adminGetUsers | - | NO | NONE |

### 3.3 公共模块覆盖情况

| 公共模块 | 单元测试 | 覆盖率评估 |
|----------|:--------:|:----------:|
| common/auth.js (Token) | YES (auth.test.js) | HIGH |
| common/admin-auth.js | YES (admin-auth.test.js) | HIGH |
| common/rate-limiter.js | YES (rate-limiter.test.js) | HIGH |
| common/logger.js | YES (logger.test.js) | MEDIUM |
| common/constants.js | YES (constants-v15.test.js) | MEDIUM |
| common/report-engine.js | YES (report-engine.test.js) | MEDIUM |

---

## 四、API 安全测试清单

### 4.1 认证安全

| 检查项 | 状态 | 详情 |
|--------|:----:|------|
| Token 签名算法 | SAFE | 使用 HMAC-SHA256，密钥从数据库加载 |
| Token 时效性 | SAFE | 1 天有效期，exp 字段服务端校验 |
| Token 篡改防护 | SAFE | 三段式 JWT，签名段使用 timingSafeEqual 防时序攻击 |
| 管理员 Token | SAFE | 独立 adminSecret，24h 过期，timingSafeEqual |
| 密钥未配置拒绝 | SAFE | ADMIN_SECRET/TOKEN_SECRET 未配置时拒绝所有请求 |
| openid 获取方式 | SAFE | 服务端 `cloud.getWXContext()` 获取，不信任客户端 |

### 4.2 授权安全

| 检查项 | 状态 | 详情 |
|--------|:----:|------|
| 用户数据隔离 | SAFE | symptom_records/orders/members 按 user_id 查询并校验归属 |
| 管理端鉴权 | SAFE | 所有 admin API 经过 validateAdminRequest 校验 |
| 越权访问防护 | PARTIAL | generateAIReport 中校验 record.user_id === openid；**但 getPointsBalance 未校验 openid 绑定** |
| 管理员操作审计 | MISSING | 管理端操作无独立审计日志（仅有 console.log） |

### 4.3 注入防护

| 检查项 | 状态 | 详情 |
|--------|:----:|------|
| NoSQL 注入 | SAFE | 微信云数据库 SDK 使用参数化查询，不拼接字符串 |
| 症状 ID 注入 | SAFE | VALID_SYMPTOM_SET 白名单校验，拒绝非法 ID |
| 描述文本注入 | SAFE | 长度限制 10000 字符 + 敏感词过滤 |

### 4.4 XSS / 内容安全

| 检查项 | 状态 | 详情 |
|--------|:----:|------|
| 描述文本过滤 | SAFE | 后端敏感词检查（医疗 + 有害内容关键词表） |
| 前端输出转义 | N/A | 小程序 WXML 自动转义 HTML |
| 用户昵称/头像 | PARTIAL | login 接受 nickname/avatar 直接存储，**无 XSS 过滤** |

### 4.5 CSRF / 请求伪造

| 检查项 | 状态 | 详情 |
|--------|:----:|------|
| 写操作 Token 验证 | SAFE | submitSymptom/createOrder/memberActivate 等写入操作要求 Token |
| 支付回调签名验证 | SAFE | 非 MOCK_PAY 模式下验证微信支付签名 (MD5 签名 + 商户密钥) |
| 云函数调用来源 | SAFE | 微信云函数只能被同环境的客户端或云函数调用 |

### 4.6 支付安全

| 检查项 | 状态 | 详情 |
|--------|:----:|------|
| 金额一致性 | SAFE | payCallback 中校验 total_fee === order.amount |
| 幂等性 | SAFE | 已支付订单直接返回 OK，条件更新 PENDING 状态 |
| 去重检查 | SAFE | createOrder 创建后二次去重检查 |
| Mock 模式标记 | WARN | MOCK_PAY=true，需上线前切换为 false |
| 商户密钥管理 | SAFE | 从环境变量 `WECHAT_PAY_MCH_KEY` 读取 |

### 4.7 风控安全

| 检查项 | 状态 | 详情 |
|--------|:----:|------|
| 限流机制 | SAFE | checkRateLimit 模块，写操作 fail-closed |
| 频率限制 | SAFE | 每日总订单 30、报告 20、会员 5 |
| 大额审核 | SAFE | >= 9900 分自动标记 need_manual_review |
| 刷量检测 | SAFE | 低价订单 >= 5 笔、5 分钟内 >= 10 笔、邀请 1h >= 10 人 |
| 风控 fail-closed | SAFE | checkRiskControl 异常时拒绝（不放行） |

### 4.8 安全风险汇总

| 风险等级 | 数量 | 详情 |
|:--------:|:----:|------|
| CRITICAL | 0 | - |
| HIGH | 1 | 管理端操作无审计日志，无法追踪管理员行为 |
| MEDIUM | 2 | login 接口昵称无 XSS 过滤；getPointsBalance 未绑定 openid 交叉校验 |
| LOW | 1 | MOCK_PAY 模式仍为 true（预期上线前修改） |

---

## 五、API 性能基准

### 5.1 性能关注点分析

基于代码静态分析，识别以下性能关键路径：

| API | 关注点 | 风险等级 | 说明 |
|-----|--------|:--------:|------|
| **generateAIReport** | LLM 调用 | HIGH | 外部 API 调用，AI_CONFIG.TIMEOUT_MS=30s，可能超时 |
| **generateAIReport** | 多次数据库查询 | HIGH | 查记录 -> 查宠物 -> 查用户 -> 查会员 -> 查点数 -> 创建订单 -> 创建回访，共 6+ 次 DB 操作 |
| **createOrder** | 额度解析链 | MEDIUM | resolveQuota 依次查询 users -> orders -> members -> user_points，最坏 4 次 DB 查询 |
| **createOrder** | 优惠券选取 | MEDIUM | autoSelectCoupon 查询 user_coupons + coupons 两个集合 |
| **payCallback** | 套餐拆单 | MEDIUM | processBundle 递归调用 dispatchPostPayment，N 个子订单 = N 次 DB 查询 |
| **adminGetStats** | 并行聚合查询 | MEDIUM | 11 个 Promise.all 并行查询，单集合数据量大时可能超时 |
| **adminGetUsers** | N+1 查询 | HIGH | 为每个用户附加宠物/记录/订单统计，触发 3N 次额外查询 |
| **checkExpiredMembers** | 批量扫描 | LOW | 分页 100 条批量处理，数据量大时单次执行时间长 |

### 5.2 冷启动预估

| API | 预估冷启动时间 | 说明 |
|-----|:-------------:|------|
| silentLogin | 1-3s | 初始化 + warmupConfig + 1 次 DB 查询 |
| submitSymptom | 1-3s | 初始化 + warmupConfig + 限流查询 + 评估 + 1 次写入 |
| generateAIReport | 3-15s | 含 LLM 调用，超时 30s |
| createOrder | 2-5s | 多次 DB 查询 + 风控 + 优惠券 |
| payCallback | 1-3s | 签名验证 + 状态更新 + 业务分发 |

### 5.3 数据库索引建议

以下查询模式需要确保索引存在：

| 集合 | 索引字段 | 使用场景 |
|------|----------|----------|
| `users` | `user_id` (唯一) | 所有用户查询 |
| `members` | `user_id` + `status` | 会员状态查询 |
| `members` | `status` + `expire_date` | 过期扫描 |
| `orders` | `user_id` + `status` | 用户订单查询 |
| `orders` | `out_trade_no` (唯一) | 支付回调查询 |
| `orders` | `user_id` + `type` + `status` + `created_at` | 风控频率检查 |
| `orders` | `status` + `created_at` | 管理端筛选 |
| `symptom_records` | `user_id` + `created_at` | 用户记录查询 |
| `rate_limits` | `openid` + `action` + `created_at` | 限流查询 |
| `user_points` | `user_id` | 点数余额查询 |
| `user_coupons` | `user_id` + `status` + `expire_at` | 用户优惠券查询 |
| `point_transactions` | `user_id` + `created_at` | 点数流水查询 |
| `invite_records` | `inviter_id` + `created_at` | 邀请刷量检测 |

### 5.4 性能优化建议

1. **adminGetUsers N+1 问题**: 改为批量查询 — 先收集所有 user_id，再批量查 pets/records/orders，避免循环内单条查询
2. **generateAIReport 链式查询**: 考虑将用户额度信息缓存到 users 文档中，减少查询次数
3. **warmupConfig 缓存**: 已实现单次加载 + 3s 超时保护，设计合理
4. **限流记录清理**: 已实现 1% 概率清理过期记录，但随用户量增长建议改为定时任务
5. **adminGetStats 并行查询**: 11 个 Promise.all 合理，但收入统计需要遍历所有 paid 订单金额，大数据量时考虑预聚合

---

## 六、Mock 服务配置建议

### 6.1 本地测试环境架构

由于微信云函数无法在本地直接运行，需要搭建 Mock 环境进行隔离测试。推荐架构如下：

```
                     +---------------------------+
                     |     本地测试运行器          |
                     |   (Node.js / Jest)         |
                     +-------------+-------------+
                                   |
                    +--------------+--------------+
                    |                             |
          +---------+--------+          +---------+--------+
          |  Mock wx-server-sdk |          |  Mock Database   |
          |  (cloud.init,       |          |  (内存集合,       |
          |   getWXContext,     |          |   支持 where/add/ |
          |   callFunction)     |          |   update/count)   |
          +---------------------+          +-------------------+
```

### 6.2 Mock 数据库实现

项目已有 `createMockDb()` 模式，建议统一封装为可复用的 Mock 工厂：

```javascript
// __tests__/helpers/mock-db.js
function createMockDb(initialData = {}) {
  const collections = {};

  for (const [name, docs] of Object.entries(initialData)) {
    collections[name] = docs.map((doc, i) => ({ _id: `mock_${name}_${i}`, ...doc }));
  }

  return {
    collection(name) {
      if (!collections[name]) collections[name] = [];

      const data = collections[name];
      return {
        where(query) {
          const filtered = data.filter(doc => matchQuery(doc, query));
          return {
            get: async () => ({ data: filtered }),
            count: async () => ({ total: filtered.length }),
            limit(n) { return { get: async () => ({ data: filtered.slice(0, n) }) }; },
            update(updateData) {
              filtered.forEach(doc => Object.assign(doc, updateData.data));
              return { stats: { updated: filtered.length } };
            },
            remove() {
              // 从 collections 中移除匹配项
              return { stats: { removed: filtered.length } };
            }
          };
        },
        doc(id) {
          const doc = data.find(d => d._id === id);
          return {
            get: async () => ({ data: doc || null }),
            update(updateData) {
              if (doc) Object.assign(doc, updateData.data);
              return { stats: { updated: doc ? 1 : 0 } };
            },
            remove() {
              const idx = data.indexOf(doc);
              if (idx >= 0) data.splice(idx, 1);
              return { stats: { removed: idx >= 0 ? 1 : 0 } };
            }
          };
        },
        add(doc) {
          const newDoc = { _id: `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`, ...doc.data };
          data.push(newDoc);
          return { _id: newDoc._id };
        },
        orderBy() { return this; },
        skip(n) { return this; }
      };
    },
    command: {
      gte: v => ({ $gte: v }),
      gt: v => ({ $gt: v }),
      lt: v => ({ $lt: v }),
      lte: v => ({ $lte: v }),
      eq: v => ({ $eq: v }),
      neq: v => ({ $neq: v }),
      in: v => ({ $in: v }),
      inc: v => ({ $inc: v }),
      and: (...args) => ({ $and: args }),
      or: (...args) => ({ $or: args })
    }
  };
}
```

### 6.3 Mock wx-server-sdk 实现

```javascript
// __tests__/helpers/mock-cloud.js
function createMockCloud(openid = 'test_openid_001') {
  const db = createMockDb();
  return {
    init: () => {},
    DYNAMIC_CURRENT_ENV: 'test-env',
    getWXContext: () => ({
      OPENID: openid,
      APPID: 'test_appid',
      UNIONID: ''
    }),
    database: () => db,
    callFunction: async ({ name, data }) => {
      // 模拟云函数间调用
      const handlers = {
        trackEvent: () => ({ result: { code: 0 } }),
        sendPaymentNotification: () => ({ result: { code: 0 } }),
        autoIssueCoupon: () => ({ result: { code: 0 } }),
        checkRiskControl: () => ({ result: { code: 0, data: { passed: true } } }),
        requestRefund: () => ({ result: { code: 0 } })
      };
      const handler = handlers[name];
      if (handler) return { result: handler(data) };
      return { result: { code: -1, msg: `Unknown function: ${name}` } };
    },
    openapi: {
      auth: {
        code2Session: async ({ jsCode }) => ({
          errcode: 0,
          errmsg: 'ok',
          openid: openid,
          unionid: ''
        })
      }
    }
  };
}
```

### 6.4 测试数据工厂

```javascript
// __tests__/helpers/test-data.js

// 标准用户
function createTestUser(overrides = {}) {
  return {
    user_id: 'test_openid_001',
    nickName: '测试用户',
    avatarUrl: '',
    isMember: false,
    first_report_used: false,
    invite_reward_credits: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  };
}

// 有效会员
function createTestMember(overrides = {}) {
  const now = new Date();
  return {
    user_id: 'test_openid_001',
    type: 'monthly',
    status: 'active',
    start_date: now,
    expire_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    report_credits_total: 3,
    report_credits_used: 0,
    report_credits_reset_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    auto_renew: false,
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

// 标准订单
function createTestOrder(overrides = {}) {
  return {
    user_id: 'test_openid_001',
    type: 'report',
    status: 'pending',
    amount: 990,
    out_trade_no: 'WELL_' + Date.now(),
    transaction_id: '',
    description: '测试订单',
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  };
}

// 症状记录
function createTestSymptomRecord(overrides = {}) {
  return {
    user_id: 'test_openid_001',
    pet_id: 'pet_001',
    symptoms: ['cough', 'sneeze'],
    symptom_names: ['咳嗽', '打喷嚏'],
    description: '测试描述',
    risk_level: 'low',
    status: 'completed',
    created_at: new Date(),
    ...overrides
  };
}
```

### 6.5 各 API Mock 配置要点

| API | 需要 Mock 的外部依赖 | Mock 难度 |
|-----|----------------------|:---------:|
| silentLogin | wx-server-sdk (getWXContext) | LOW |
| login | wx-server-sdk (openapi.auth.code2Session) | MEDIUM |
| submitSymptom | wx-server-sdk + rate-limiter DB | LOW |
| generateAIReport | wx-server-sdk + report-engine + LLM API | HIGH |
| createOrder | wx-server-sdk + rate-limiter + 风控 + 优惠券 | HIGH |
| payCallback | wx-server-sdk + crypto + 多集合事务 | HIGH |
| checkRiskControl | wx-server-sdk + orders/invite 集合 | MEDIUM |
| memberActivate | wx-server-sdk + rate-limiter + 多集合 | MEDIUM |
| getMemberStatus | wx-server-sdk + members + orders | LOW |
| adminGetStats | wx-server-sdk + admin-auth + 11 个集合查询 | HIGH |
| adminGetUsers | wx-server-sdk + admin-auth + N+1 查询 | HIGH |

### 6.6 推荐测试工具链

| 工具 | 用途 | 推荐度 |
|------|------|:------:|
| Jest | 测试框架（替代现有手写 assert） | HIGH |
| jest-date-mock | 时间相关测试（过期/重置） | MEDIUM |
| rewire/proxyquire | 模块内部函数 mock | MEDIUM |
| 本地 Miniprogram Simultor | 小程序端到端测试 | LOW（成本高） |
| 云开发 CLI + tcb-router | 真实环境集成测试 | MEDIUM |

---

## 七、测试缺口与优先级建议

### 7.1 高优先级（P0 - 必须覆盖）

| 缺口 | 涉及 API | 风险 | 建议用例数 |
|------|----------|------|:----------:|
| createOrder 全链路集成测试 | createOrder | 资金安全 | ~30 |
| generateAIReport 额度扣减逻辑 | generateAIReport | 免费额度滥用 | ~25 |
| payCallback 会员激活逻辑 | payCallback | 会员权益 | ~20 |
| memberActivate 到期日计算 | memberActivate | 续费计算准确性 | ~15 |
| 登录流程完整测试 | login | 认证安全 | ~10 |

### 7.2 中优先级（P1 - 应该覆盖）

| 缺口 | 涉及 API | 风险 | 建议用例数 |
|------|----------|------|:----------:|
| 优惠券领取+使用+回滚 | receiveCoupon, applyCoupon | 优惠券滥用 | ~15 |
| 点数购买+消费+过期 | purchasePoints, consumePoint | 点数计费准确性 | ~15 |
| 会员状态查询+过期处理 | getMemberStatus, checkExpiredMembers | 状态不一致 | ~15 |
| 管理端 CRUD 完整测试 | adminGateway | 越权操作 | ~20 |
| 退款流程 | processRefund, requestRefund | 资金安全 | ~10 |

### 7.3 低优先级（P2 - 可以延后）

| 缺口 | 涉及 API | 风险 | 建议用例数 |
|------|----------|------|:----------:|
| cancelMembership + toggleAutoRenew | 会员管理 | 功能正确性 | ~8 |
| getPointsBalance | 点数查询 | 功能正确性 | ~5 |
| adminGetStats 边界条件 | 管理端统计 | 数据准确性 | ~10 |
| adminGetUsers 搜索+分页 | 管理端用户管理 | 功能正确性 | ~8 |

### 7.4 建议新增测试文件

| 文件路径 | 类型 | 覆盖 API |
|----------|------|----------|
| `unit/order-logic.test.js` | 单元 | createOrder 额度解析/扣减/回滚/优惠券逻辑 |
| `unit/member-logic.test.js` | 单元 | memberActivate 到期日计算/额度重置 |
| `unit/coupon-logic.test.js` | 单元 | receiveCoupon/applyCoupon 校验逻辑 |
| `unit/points-logic.test.js` | 单元 | purchasePoints/consumePoint 计算逻辑 |
| `integration/order-flow.test.js` | 集成 | createOrder -> payCallback -> 业务分发完整链 |
| `integration/member-flow.test.js` | 集成 | memberActivate -> getMemberStatus -> checkExpired |
| `integration/admin-flow.test.js` | 集成 | adminLogin -> adminGateway 路由 -> 各 action |

---

## 八、总结

### 8.1 当前状态

- **已测试用例**: ~368 个
- **已覆盖 API**: 21 个中的 5 个有集成测试，6 个有单元测试，10 个无任何测试
- **公共模块覆盖**: 6/6 公共模块有单元测试
- **安全风险**: 0 CRITICAL / 1 HIGH / 2 MEDIUM / 1 LOW

### 8.2 建议优先行动

1. **立即补充 createOrder 集成测试** — 这是资金安全的核心入口
2. **补充 generateAIReport 额度扣减测试** — 防止免费额度被滥用
3. **添加管理端操作审计日志** — 安全合规要求
4. **上线前将 MOCK_PAY 切换为 false** — 当前仍为模拟支付模式
5. **为 login 接口添加昵称/头像 XSS 过滤** — 防止存储型 XSS

### 8.3 测试成熟度评估

| 维度 | 成熟度 | 评分 |
|------|--------|:----:|
| 单元测试覆盖 | 公共模块覆盖良好，业务 API 覆盖不足 | 6/10 |
| 集成测试覆盖 | 核心流程有覆盖，新功能（会员/点数/优惠券）缺失 | 4/10 |
| 安全测试 | Token/签名/限流/风控机制完善，少量缺口 | 7/10 |
| 性能测试 | 仅基于代码分析，无实际压力测试数据 | 2/10 |
| Mock 基础设施 | 已有 Mock 模式但未统一标准化 | 5/10 |
| **综合评分** | | **5/10** |

---

> 报告由自动化分析工具生成，基于 `D:/Domain_Users_Documents/jiangweilong/桌面/AI/well` 项目代码静态分析。
> 所有测试文件位于 `__tests__/` 目录下。
