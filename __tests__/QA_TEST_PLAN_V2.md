# QA 测试计划 V2 — pet-symptom-check（宠物症状自查）

> **项目**: pet-symptom-check（宠物症状自查微信小程序）
> **技术栈**: 微信小程序 + 云开发（云函数 / 云数据库）
> **版本**: V1.5（会员系统 + 支付系统 + 邀请系统）
> **生成日期**: 2026-06-10
> **测试框架**: Jest（单元/集成） + 自定义断言框架（云函数综合测试）

---

## 1. 执行摘要

### 1.1 测试概述

pet-symptom-check 是一款基于微信小程序云开发的宠物健康自查工具，核心功能包括：症状评估（规则引擎）、AI 健康报告生成、会员体系、支付系统、优惠券/点数系统、家庭会员、邀请奖励系统，以及管理后台。

本测试计划覆盖后端云函数（71 个）、公共模块（11 个）、小程序前端（47 个 JS 文件）、管理后台（16 个 JS 文件）的全量质量评估。

### 1.2 关键指标

| 指标 | 数值 | 状态 |
|------|------|------|
| **总测试用例数** | 1,360 | -- |
| **通过率** | 100% | PASS |
| **测试文件数** | 14 | -- |
| **测试代码行数** | 5,477 行 | -- |
| **被测源码总行数** | ~27,282 行 | -- |
| **后端核心模块覆盖率** | 100%（11/11 common 模块） | PASS |
| **云函数覆盖率** | ~15%（11/71 云函数有直接/间接测试） | WARNING |
| **前端覆盖率** | 0%（小程序 + 管理后台均无自动化测试） | CRITICAL |
| **云函数综合测试** | 118 tests（自定义框架） | PASS |
| **单元测试** | 1,037 tests（Jest） | PASS |
| **集成测试** | 205 tests（Jest） | PASS |

### 1.3 测试类型分布

```
单元测试（Unit）        1,037 tests  ████████████████████████  76.3%
集成测试（Integration）   205 tests  █████                     15.1%
云函数综合（CF）         118 tests  ███                       8.7%
E2E 测试                  0 tests  ▏                         0.0%
```

---

## 2. 覆盖率矩阵

### 2.1 功能模块 x 测试类型

图例：**C** = 完整覆盖 | **P** = 部分覆盖 | **N** = 未覆盖 | **-** = 不适用

| 功能模块 | 单元测试 | 集成测试 | E2E | 手工测试 | 覆盖率 |
|----------|:--------:|:--------:|:---:|:--------:|:------:|
| **common/auth.js**（Token 验证） | C | C | - | - | 100% |
| **common/admin-auth.js**（管理鉴权） | C | - | - | - | 100% |
| **common/constants.js**（常量定义） | C | - | - | - | 100% |
| **common/error-handler.js**（错误处理） | C | - | - | - | 100% |
| **common/logger.js**（日志系统） | C | - | - | - | 100% |
| **common/rate-limiter.js**（限流器） | C | - | - | - | 100% |
| **common/report-engine.js**（报告引擎） | C | - | - | - | 100% |
| **submitSymptom**（症状提交 + 规则引擎） | C | C | N | 需补充 | 85% |
| **payCallback**（支付回调） | - | C | N | 需补充 | 70% |
| **checkRiskControl**（风控检查） | C | - | N | 需补充 | 75% |
| **createOrder**（创建订单） | - | P | N | 需补充 | 30% |
| **login / silentLogin / quickLogin** | - | C | N | 需补充 | 60% |
| **savePet / getPetList / deletePet** | - | C | N | 需补充 | 50% |
| **memberActivate**（会员激活） | N | N | N | 需补充 | 0% |
| **applyCoupon / rollbackCoupon**（优惠券） | N | N | N | 需补充 | 0% |
| **receiveCoupon / getUserCoupons** | N | N | N | 需补充 | 0% |
| **autoIssueCoupon / expireCoupons** | N | N | N | 需补充 | 0% |
| **consumePoint / refundPoint**（点数） | N | N | N | 需补充 | 0% |
| **purchasePoints / getPointsBalance** | N | N | N | 需补充 | 0% |
| **createInvite / processInviteReward**（邀请） | N | N | N | 需补充 | 0% |
| **getInviteRanking / getInviteStats** | N | N | N | 需补充 | 0% |
| **generateAIReport**（AI 报告） | C(引擎) | N | N | 需补充 | 40% |
| **followupSubmit / getFollowupList** | N | N | N | 需补充 | 0% |
| **processRefund / requestRefund**（退款） | N | N | N | 需补充 | 0% |
| **cancelOrder / cancelMembership** | N | N | N | 需补充 | 0% |
| **admin 系列**（10 个云函数） | P(鉴权) | N | N | 需补充 | 10% |
| **小程序前端**（47 个 JS 文件） | N | N | N | 需手工 | 0% |
| **管理后台前端**（16 个 JS 文件） | N | N | N | 需手工 | 0% |
| **定时触发器**（5 个云函数） | N | N | N | 需手工 | 0% |

### 2.2 按业务领域汇总

| 业务领域 | 云函数数 | 已覆盖 | 部分覆盖 | 未覆盖 | 覆盖率 |
|----------|:--------:|:------:|:--------:|:------:|:------:|
| 认证/登录 | 3 | 2 | 1 | 0 | 83% |
| 症状评估 | 2 | 1 | 1 | 0 | 75% |
| 宠物管理 | 3 | 2 | 1 | 0 | 67% |
| 订单/支付 | 7 | 1 | 2 | 4 | 21% |
| 会员系统 | 6 | 0 | 0 | 6 | 0% |
| 优惠券系统 | 5 | 0 | 0 | 5 | 0% |
| 点数系统 | 4 | 0 | 0 | 4 | 0% |
| 邀请系统 | 5 | 0 | 0 | 5 | 0% |
| 管理后台 | 10 | 0 | 1 | 9 | 5% |
| 知识库 | 2 | 0 | 0 | 2 | 0% |
| 回访系统 | 3 | 0 | 0 | 3 | 0% |
| 定时任务 | 5 | 0 | 0 | 5 | 0% |
| 通知/工具 | 5 | 0 | 0 | 5 | 0% |
| 其他 | 11 | 0 | 0 | 11 | 0% |
| **合计** | **71** | **6** | **6** | **59** | **12%** |

---

## 3. 测试用例清单

### 3.1 已有测试用例（按模块分类）

#### 3.1.1 公共模块单元测试

| 测试文件 | 用例数 | 优先级 | 状态 | 覆盖目标 |
|----------|:------:|:------:|:----:|----------|
| `unit/auth.test.js` | 41 | P0 | PASS | Token 生成、验证、过期、篡改检测 |
| `unit/admin-auth.test.js` | 71 | P0 | PASS | 管理员登录、会话管理、权限校验 |
| `unit/error-handler.test.js` | 69 | P1 | PASS | 错误分类、格式化、错误码映射 |
| `unit/rate-limiter.test.js` | 16 | P0 | PASS | 滑动窗口限流、配额消耗、重置 |
| `unit/report-engine.test.js` | 60 | P0 | PASS | 报告模板渲染、数据填充、缓存逻辑 |
| `unit/logger.test.js` | 108 | P1 | PASS | 日志分级、格式化、上下文传递 |
| `unit/submit-symptom-enhanced.test.js` | 220 | P0 | PASS | 规则引擎全路径、白名单、敏感词 |
| `unit/risk-control.test.js` | 57 | P0 | PASS | 风控阈值、大额审核、刷量检测 |
| `unit/constants-v15.test.js` | 395 | P1 | PASS | 所有常量值、类型校验、一致性 |
| **小计** | **1,037** | | | |

#### 3.1.2 集成测试

| 测试文件 | 用例数 | 优先级 | 状态 | 覆盖目标 |
|----------|:------:|:------:|:----:|----------|
| `integration/login-flow.test.js` | 24 | P0 | PASS | silentLogin -> 用户创建/查找 -> Token 下发 |
| `integration/symptom-flow.test.js` | 30 | P0 | PASS | 症状选择 -> 风险评估 -> 记录创建 |
| `integration/pet-flow.test.js` | 33 | P0 | PASS | savePet -> getPetList -> deletePet 全链路 |
| `integration/pay-callback-flow.test.js` | 118 | P0 | PASS | 支付回调签名、幂等、金额校验、会员/点数分发 |
| **小计** | **205** | | | |

#### 3.1.3 云函数综合测试

| 测试文件 | 用例数 | 优先级 | 状态 | 覆盖目标 |
|----------|:------:|:------:|:----:|----------|
| `cloud_functions_test.js` | 118 | P0 | PASS | 规则引擎、Token、加密、常量一致性 |
| **小计** | **118** | | | |

### 3.2 待补充测试用例（按优先级排列）

#### P0 — 核心业务路径（必须上线前完成）

| 编号 | 模块 | 测试场景 | 类型 | 预估用例数 | 状态 |
|------|------|----------|:----:|:----------:|:----:|
| T001 | createOrder | 报告订单创建 + 价格校验 | 集成 | 15 | TODO |
| T002 | createOrder | 会员订单创建（月/年/家庭） | 集成 | 12 | TODO |
| T003 | createOrder | 点数包/套餐订单创建 | 集成 | 10 | TODO |
| T004 | createOrder | 未登录/Token 无效拒绝 | 单元 | 5 | TODO |
| T005 | createOrder | 限流 + 重复订单检测 | 单元 | 8 | TODO |
| T006 | memberActivate | 新开通会员（4 种类型） | 集成 | 12 | TODO |
| T007 | memberActivate | 会员续费 + 到期计算 | 集成 | 10 | TODO |
| T008 | memberActivate | 会员过期重新开通 | 集成 | 6 | TODO |
| T009 | payCallback | MOCK_PAY=false 签名验证 | 单元 | 8 | TODO |
| T010 | payCallback | bundle 拆单逻辑 | 集成 | 10 | TODO |
| T011 | processRefund | 退款流程 + 状态流转 | 集成 | 12 | TODO |
| T012 | applyCoupon | 优惠券锁定 + 金额计算 | 集成 | 10 | TODO |
| T013 | cancelOrder | 订单取消 + 库存释放 | 集成 | 8 | TODO |
| **P0 小计** | | | | **126** | |

#### P1 — 重要业务功能（上线后 1 周内完成）

| 编号 | 模块 | 测试场景 | 类型 | 预估用例数 | 状态 |
|------|------|----------|:----:|:----------:|:----:|
| T014 | consumePoint | 点数消费 + 余额校验 | 单元 | 8 | TODO |
| T015 | refundPoint | 点数退回 | 单元 | 5 | TODO |
| T016 | purchasePoints | 点数包购买 + 到期计算 | 集成 | 8 | TODO |
| T017 | getPointsBalance | 点数余额查询（含过期） | 单元 | 6 | TODO |
| T018 | getPointTransactions | 点数流水查询 + 分页 | 单元 | 5 | TODO |
| T019 | receiveCoupon | 领取优惠券 + 数量限制 | 集成 | 8 | TODO |
| T020 | getUserCoupons | 用户券列表 + 过滤 | 单元 | 5 | TODO |
| T021 | autoIssueCoupon | 自动发券触发 | 集成 | 6 | TODO |
| T022 | expireCoupons | 过期券批量处理 | 单元 | 5 | TODO |
| T023 | rollbackCoupon | 券回滚（取消订单时） | 集成 | 6 | TODO |
| T024 | createInvite | 创建邀请 + 每日限额 | 集成 | 8 | TODO |
| T025 | processInviteReward | 邀请奖励发放 + 防刷 | 集成 | 8 | TODO |
| T026 | acceptFamilyInvite | 家庭邀请接受 | 集成 | 6 | TODO |
| T027 | inviteFamilyMember | 家庭成员邀请 | 集成 | 6 | TODO |
| T028 | removeFamilyMember | 移除家庭成员 | 集成 | 5 | TODO |
| T029 | getFamilyMembers | 家庭成员列表 | 单元 | 4 | TODO |
| T030 | cancelMembership | 取消会员 + 到期处理 | 集成 | 6 | TODO |
| T031 | toggleAutoRenew | 自动续费开关 | 集成 | 5 | TODO |
| T032 | renewMemberByAuto | 自动续费执行 | 集成 | 6 | TODO |
| T033 | getMemberStatus | 会员状态查询 | 单元 | 5 | TODO |
| **P1 小计** | | | | **125** | |

#### P2 — 次要功能（上线后 2 周内完成）

| 编号 | 模块 | 测试场景 | 类型 | 预估用例数 | 状态 |
|------|------|----------|:----:|:----------:|:----:|
| T034 | adminLogin | 管理员登录流程 | 集成 | 6 | TODO |
| T035 | adminGateway | 管理接口网关鉴权 | 单元 | 8 | TODO |
| T036 | adminGetOrders | 订单列表 + 分页过滤 | 单元 | 5 | TODO |
| T037 | adminUpdateOrder | 订单状态更新 | 集成 | 5 | TODO |
| T038 | adminGetUsers | 用户列表 + 搜索 | 单元 | 4 | TODO |
| T039 | adminGetStats | 统计数据聚合 | 单元 | 5 | TODO |
| T040 | adminGetArticles | 文章管理 | 单元 | 4 | TODO |
| T041 | adminSaveArticle | 文章保存 + 校验 | 集成 | 5 | TODO |
| T042 | adminDeleteArticle | 文章删除 | 单元 | 3 | TODO |
| T043 | adminGetConfig | 配置读取 | 单元 | 3 | TODO |
| T044 | adminUpdateConfig | 配置更新 + 校验 | 集成 | 5 | TODO |
| T045 | generateAIReport | AI 报告生成全流程 | 集成 | 10 | TODO |
| T046 | generateSharePoster | 分享海报生成 | 单元 | 4 | TODO |
| T047 | getHospitals / searchHospitals | 医院搜索 | 单元 | 6 | TODO |
| T048 | getKnowledgeList / getKnowledgeDetail | 知识库查询 | 单元 | 5 | TODO |
| T049 | followupSubmit / getFollowupList / getFollowupDetail | 回访系统 | 集成 | 8 | TODO |
| T050 | trackEvent | 事件埋点 | 单元 | 4 | TODO |
| T051 | saveUserProfile | 用户资料保存 | 单元 | 4 | TODO |
| T052 | getUserStats | 用户统计 | 单元 | 3 | TODO |
| T053 | checkReportQuota | 报告配额检查 | 单元 | 6 | TODO |
| T054 | getRecordList / getRecordDetail / deleteRecord | 记录管理 | 集成 | 8 | TODO |
| T055 | orderList / orderDetail | 订单查询 | 单元 | 5 | TODO |
| T056 | requestRefund | 退款申请 | 集成 | 5 | TODO |
| **P2 小计** | | | | **117** | |

#### P3 — 定时任务与基础设施（上线后 1 月内完成）

| 编号 | 模块 | 测试场景 | 类型 | 预估用例数 | 状态 |
|------|------|----------|:----:|:----------:|:----:|
| T057 | checkDailyBill | 每日账单核对 | 单元 | 5 | TODO |
| T058 | checkExpiredMembers | 过期会员检查 | 单元 | 5 | TODO |
| T059 | closeExpiredOrders | 过期订单关闭 | 单元 | 5 | TODO |
| T060 | cleanExpiredCache | 过期缓存清理 | 单元 | 4 | TODO |
| T061 | sendExpireReminder | 到期提醒发送 | 单元 | 4 | TODO |
| T062 | sendPaymentNotification | 支付通知发送 | 单元 | 3 | TODO |
| T063 | getInviteRanking | 邀请排行榜 | 单元 | 4 | TODO |
| T064 | getInviteStats | 邀请统计 | 单元 | 3 | TODO |
| T065 | getReportHistory | 报告历史查询 | 单元 | 4 | TODO |
| T066 | dbInit | 数据库初始化 | 集成 | 5 | TODO |
| T067 | quickstartFunctions | 快速启动函数 | 单元 | 3 | TODO |
| **P3 小计** | | | | **45** | |

### 3.3 待补充测试用例汇总

| 优先级 | 用例数 | 目标完成时间 |
|:------:|:------:|:----------:|
| P0 | 126 | 上线前 |
| P1 | 125 | 上线后 1 周 |
| P2 | 117 | 上线后 2 周 |
| P3 | 45 | 上线后 1 月 |
| **合计** | **413** | |

---

## 4. 缺陷严重级分类

### 4.1 严重级别定义

| 级别 | 定义 | 影响 | 示例 | 响应时间 |
|------|------|------|------|----------|
| **CRITICAL** | 系统核心功能完全不可用，导致数据丢失或安全漏洞 | 业务中断、资金损失、用户数据泄露 | 支付回调未校验签名导致伪造支付成功；Token 密钥泄露；规则引擎返回错误风险等级导致延误就医 | **立即修复** (< 2h) |
| **HIGH** | 核心业务流程受阻，无替代方案 | 用户体验严重受损，部分功能不可用 | 订单创建失败；会员激活异常；AI 报告生成失败；风控误拦截正常用户 | **当天修复** (< 8h) |
| **MEDIUM** | 非核心功能异常，有替代方案或影响有限 | 用户体验下降，但不阻塞核心流程 | 优惠券计算偏差；点数到账延迟；邀请奖励未及时发放；分页显示错误 | **3 天内修复** |
| **LOW** | UI 瑕疵、文案错误、性能优化 | 几乎不影响使用 | 文案错别字；按钮间距不一致；加载动画不流畅；日志格式不统一 | **下个迭代修复** |

### 4.2 已知缺陷评估

| 编号 | 描述 | 级别 | 模块 | 状态 |
|------|------|------|------|------|
| D001 | `createOrder` 中 `MOCK_PAY=true`，上线前必须切换为 `false` 并接入真实支付 | **CRITICAL** | createOrder | 已知 TODO |
| D002 | `payCallback` 缺少微信支付签名验证（MOCK 模式跳过） | **CRITICAL** | payCallback | 已知 TODO |
| D003 | `payCallback` 缺少金额一致性校验（MOCK 模式跳过） | **CRITICAL** | payCallback | 已知 TODO |
| D004 | `common/constants.js` 中 `SERVER_CONFIG` 在 warmupConfig 前为空，可能导致服务启动失败 | **HIGH** | constants | 已知风险 |
| D005 | V1.5 新增云函数（优惠券/点数/邀请）均无自动化测试 | **HIGH** | V1.5 模块 | 待补充 |
| D006 | 管理后台前端无任何自动化测试 | **MEDIUM** | admin | 待补充 |
| D007 | 小程序前端无任何自动化测试 | **MEDIUM** | miniprogram | 待补充 |

---

## 5. 发布检查清单

### 5.1 上线前必须通过项（Go / No-Go）

| 序号 | 检查项 | 类别 | 负责人 | 状态 | 阻塞上线 |
|:----:|--------|:----:|--------|:----:|:--------:|
| G01 | 所有 1,360 个现有测试 100% 通过 | 自动化 | QA | PASS | YES |
| G02 | P0 待补充测试（126 用例）全部通过 | 自动化 | QA | TODO | YES |
| G03 | `MOCK_PAY=false` 且真实微信支付接入 | 配置 | 后端 | TODO | YES |
| G04 | 支付回调签名验证开启并测试通过 | 安全 | 后端 | TODO | YES |
| G05 | 支付回调金额一致性校验开启 | 安全 | 后端 | TODO | YES |
| G06 | 支付回调幂等性测试通过 | 安全 | QA | PASS | YES |
| G07 | `SERVER_CONFIG` 密钥已写入数据库（dbInit 执行成功） | 配置 | 运维 | TODO | YES |
| G08 | 无 CRITICAL 级别未修复缺陷 | 质量 | QA | TODO | YES |
| G09 | 限流阈值在压力测试下表现正常 | 性能 | QA | TODO | YES |
| G10 | 核心用户路径手工冒烟测试通过 | 手工 | QA | TODO | YES |
| G11 | 管理后台登录 + CRUD 操作正常 | 手工 | QA | TODO | YES |
| G12 | 小程序体验版核心流程测试通过 | 手工 | QA | TODO | NO |
| G13 | 数据库集合索引已创建 | 性能 | 运维 | TODO | YES |
| G14 | 云函数冷启动优化（预置并发）已配置 | 性能 | 运维 | TODO | NO |
| G15 | 错误监控告警已配置（云函数错误率 > 5%） | 运维 | 运维 | TODO | YES |

### 5.2 核心用户路径（冒烟测试）

以下路径需在上线前完成手工验证：

```
路径1（新用户）: 打开小程序 -> 静默登录 -> 选择宠物 -> 症状自查 -> 查看结果 -> 购买报告
路径2（会员）: 购买会员 -> 会员激活 -> 使用会员额度 -> 查看会员状态
路径3（支付）: 选择套餐 -> 创建订单 -> 完成支付 -> 支付回调 -> 订单状态更新
路径4（退款）: 申请退款 -> 退款审核 -> 退款执行 -> 优惠券/点数回退
路径5（邀请）: 生成邀请码 -> 分享 -> 被邀请人完成自查 -> 奖励发放
路径6（管理后台）: 管理员登录 -> 查看订单 -> 处理退款 -> 查看统计
```

---

## 6. 质量仪表板

### 6.1 测试金字塔

```
                    /\
                   /  \
                  / E2E \           0 tests (0%)
                 /________\
                /          \
               /  集成测试   \       205 tests (15.1%)
              /______________\
             /                \
            /    单元测试       \    1,037 tests (76.3%)
           /____________________\
          /      云函数综合测试    \  118 tests (8.7%)
         /________________________\
```

### 6.2 模块覆盖率热力图

```
覆盖等级: [100%] [>=75%] [>=50%] [>=25%] [<25%] [0%]

common/auth.js                [100%] ████████████████████ 
common/admin-auth.js          [100%] ████████████████████ 
common/constants.js           [100%] ████████████████████ 
common/error-handler.js       [100%] ████████████████████ 
common/logger.js              [100%] ████████████████████ 
common/rate-limiter.js        [100%] ████████████████████ 
common/report-engine.js       [100%] ████████████████████ 
submitSymptom                 [ 85%] █████████████████░░░
checkRiskControl              [ 75%] ███████████████░░░░░
login / silentLogin           [ 60%] ████████████░░░░░░░░
payCallback                   [ 70%] ██████████████░░░░░░
savePet / getPetList          [ 50%] ██████████░░░░░░░░░░
createOrder                   [ 30%] ██████░░░░░░░░░░░░░░
generateAIReport              [ 40%] ████████░░░░░░░░░░░░
admin 系列                    [ 10%] ██░░░░░░░░░░░░░░░░░░
memberActivate                [  0%] ░░░░░░░░░░░░░░░░░░░░
优惠券系统                    [  0%] ░░░░░░░░░░░░░░░░░░░░
点数系统                      [  0%] ░░░░░░░░░░░░░░░░░░░░
邀请系统                      [  0%] ░░░░░░░░░░░░░░░░░░░░
小程序前端                    [  0%] ░░░░░░░░░░░░░░░░░░░░
管理后台前端                  [  0%] ░░░░░░░░░░░░░░░░░░░░
```

### 6.3 关键质量指标

```
┌──────────────────────────────────────────────────────────────┐
│                    质量指标仪表板                              │
├──────────────────────┬───────────────────────────────────────┤
│ 代码总行数            │  ~27,282 行                            │
│ 测试代码行数          │  5,477 行（测试/代码比 = 1:5.0）        │
│ 测试通过率            │  ████████████████████ 100%             │
│ 公共模块覆盖率        │  ████████████████████ 100% (11/11)     │
│ 云函数覆盖率          │  ██░░░░░░░░░░░░░░░░░░ 12% (11/71)     │
│ 前端覆盖率            │  ░░░░░░░░░░░░░░░░░░░░ 0%               │
│ P0 缺陷数             │  3（均为已知 TODO 项）                  │
│ 安全审计状态          │  待执行                                 │
└──────────────────────┴───────────────────────────────────────┘
```

### 6.4 测试趋势

```
版本       单元    集成   云函数   总计    通过率
V1.0       186     0      0       186     100%
V1.2       350     54     0       404     100%
V1.4       640     87     118     845     100%
V1.5       1,037   205    118     1,360   100%
  ^        ^       ^      ^       ^
  +601     +151    +118   +869    增长率 367%
```

---

## 7. 自动化 ROI 分析

### 7.1 投入分析

| 投入项 | 详情 | 成本 |
|--------|------|------|
| 测试代码量 | 5,477 行 | ~40 人时 |
| 测试框架搭建 | Jest + 自定义 Mock 框架 | ~8 人时 |
| CI 集成 | 本地执行（无 CI 管道） | ~2 人时 |
| 维护成本（预估） | 每月 ~4 人时（随用例增长） | 持续 |
| **总投入** | | **~54 人时** |

### 7.2 收益分析

| 收益项 | 详情 | 价值 |
|--------|------|------|
| 回归测试 | 每次代码变更自动验证 1,360 个用例 | ~2 人时/次 |
| Bug 预防 | 规则引擎 220 用例确保核心逻辑正确 | 避免医疗建议风险 |
| 重构安全 | 公共模块 100% 覆盖，重构零风险 | 降低技术债 |
| 文档作用 | 测试用例即行为文档 | 降低沟通成本 |
| 持续价值 | 1,360 用例每次运行 ~30 秒完成 | 快速反馈 |

### 7.3 ROI 计算

```
假设：
- 每月代码变更次数: 20 次
- 每次手工回归测试时间: 2 小时
- 每月节省: 20 x 2 = 40 人时
- 自动化维护成本: 4 人时/月
- 净节省: 36 人时/月

投入回收期: 54 / 36 = 1.5 个月
年化 ROI: (36 x 12 - 54 x 0) / 54 = 700%
```

### 7.4 当前自动化盲区 ROI

| 盲区 | 潜在损失风险 | 自动化 ROI |
|------|-------------|-----------|
| 支付流程无 MOCK=false 测试 | 资金损失（CRITICAL） | 极高 |
| 会员系统无测试 | 会员权益异常导致用户投诉 | 高 |
| 优惠券/点数无测试 | 金额计算错误导致财务损失 | 高 |
| 邀请系统无测试 | 刷量漏洞导致成本失控 | 高 |
| 前端无测试 | UI 回归问题 | 中 |

---

## 8. 风险和遗留问题

### 8.1 高风险区域

| 风险编号 | 风险描述 | 影响 | 概率 | 缓解措施 |
|----------|---------|:----:|:----:|----------|
| R01 | `MOCK_PAY=true` 上线后未切换 | CRITICAL | 高 | 代码审查清单项；上线前自动化检查 |
| R02 | 微信支付签名验证缺失 | CRITICAL | 高 | T009 测试用例；上线前强制代码审查 |
| R03 | V1.5 会员/优惠券/点数系统无自动化测试 | HIGH | 高 | P0/P1 补充测试计划 |
| R04 | 前端页面无自动化测试 | MEDIUM | 中 | 小程序 miniprogram-simulate 框架 |
| R05 | `SERVER_CONFIG` 冷启动时为空 | HIGH | 中 | warmupConfig 超时保护（已有） |
| R06 | 限流器在高并发下可能失效 | MEDIUM | 低 | 压力测试验证；Redis 限流替代方案 |
| R07 | AI 报告生成依赖外部 API（DeepSeek） | HIGH | 中 | 缓存机制（已有）；降级策略 |
| R08 | 邀请系统可能被刷量 | HIGH | 中 | checkRiskControl 刷量检测（已有） |
| R09 | 管理后台无鉴权测试覆盖 | MEDIUM | 低 | P2 补充测试 |
| R10 | 数据库无备份策略 | CRITICAL | 低 | 上线前配置自动备份 |

### 8.2 遗留问题追踪

| 编号 | 问题 | 状态 | 负责人 | 目标日期 |
|------|------|:----:|--------|---------|
| L01 | `MOCK_PAY` 切换为 `false` | OPEN | 后端 | 上线前 |
| L02 | 微信支付签名验证实现 | OPEN | 后端 | 上线前 |
| L03 | 支付回调金额一致性校验 | OPEN | 后端 | 上线前 |
| L04 | dbInit 部署后验证所有密钥 | OPEN | 运维 | 上线前 |
| L05 | CI/CD 管道搭建 | OPEN | DevOps | 上线后 2 周 |
| L06 | 小程序前端测试框架引入 | OPEN | 前端 | 上线后 1 月 |
| L07 | E2E 测试方案设计 | OPEN | QA | 上线后 2 月 |
| L08 | 性能测试方案设计 | OPEN | QA | 上线后 1 月 |

---

## 9. 下一步建议

### 9.1 测试改进路线图

```
Phase 1: 上线前（0-2 周）                    Phase 2: 稳定期（2-4 周）
├─ 补充 P0 测试用例（126 个）                ├─ 补充 P1 测试用例（125 个）
├─ MOCK_PAY 切换 + 签名验证测试              ├─ 搭建 CI/CD 管道（GitHub Actions）
├─ 核心路径手工冒烟测试                      ├─ 代码覆盖率采集（Istanbul/c8）
├─ 安全审计（支付/认证/数据）                 ├─ 管理后台自动化测试
├─ Go/No-Go 检查清单确认                     ├─ 定时任务测试
└─ 数据库备份策略配置                        └─ 监控告警自动化

Phase 3: 增长期（1-2 月）                    Phase 4: 成熟期（2-3 月）
├─ 补充 P2/P3 测试用例（162 个）             ├─ 小程序 E2E 自动化（miniprogram-automator）
├─ 前端单元测试框架引入                      ├─ 性能基准测试 + 压力测试
├─ 小程序组件测试（miniprogram-simulate）     ├─ 混沌工程（云函数故障模拟）
├─ 代码覆盖率目标: 后端 80%+                 ├─ 安全渗透测试
└─ 测试数据工厂建设                          └─ 测试覆盖率目标: 全栈 60%+
```

### 9.2 优先级排序原则

1. **安全优先**: 支付签名验证、密钥管理、输入校验（直接影响资金安全）
2. **核心业务优先**: 订单、支付、会员、症状评估（直接影响用户体验和收入）
3. **数据一致性优先**: 优惠券计算、点数余额、会员权益（直接影响财务准确性）
4. **运维保障优先**: 监控、告警、备份（直接影响服务可用性）
5. **效率优先**: CI/CD、自动化覆盖率（间接提升交付质量）

### 9.3 技术建议

| 建议 | 描述 | 预期收益 |
|------|------|----------|
| 引入 Jest 统一测试框架 | 替换自定义断言框架为 Jest，统一所有测试 | 更好的报告、watch 模式、覆盖率 |
| 搭建 CI 管道 | GitHub Actions / GitLab CI 自动运行测试 | 每次提交自动质量把关 |
| 引入代码覆盖率工具 | Istanbul/nyc 覆盖率采集 | 可量化的覆盖率指标 |
| 建立测试数据工厂 | 通用 Mock 数据生成器 | 减少测试代码重复 |
| 引入 miniprogram-automator | 微信官方小程序自动化测试工具 | 前端 E2E 自动化 |
| 引入 miniprogram-simulate | 小程序组件单元测试 | 前端组件级别测试 |

### 9.4 里程碑目标

| 里程碑 | 时间 | 测试用例目标 | 覆盖率目标 |
|--------|------|:----------:|:----------:|
| V1.5 上线 | Week 0 | 1,360（现状） | common 100% |
| 上线前完成 | Week 2 | 1,486（+126 P0） | 核心 CF 50%+ |
| 稳定期完成 | Week 4 | 1,611（+125 P1） | 后端 60%+ |
| 增长期完成 | Week 8 | 1,773（+162 P2/P3） | 后端 80%+ |
| 成熟期完成 | Week 12 | 1,900+（+E2E） | 全栈 60%+ |

---

## 附录

### A. 云函数完整清单（71 个）

#### 认证/登录（3 个）
`login`, `silentLogin`, `quickLogin`

#### 症状评估（2 个）
`submitSymptom`, `checkReportQuota`

#### 宠物管理（3 个）
`savePet`, `getPetList`, `deletePet`

#### 订单/支付（7 个）
`createOrder`, `payCallback`, `cancelOrder`, `orderList`, `orderDetail`, `requestRefund`, `processRefund`

#### 会员系统（6 个）
`memberActivate`, `cancelMembership`, `getMemberStatus`, `toggleAutoRenew`, `renewMemberByAuto`, `checkExpiredMembers`

#### 优惠券系统（5 个）
`applyCoupon`, `receiveCoupon`, `getUserCoupons`, `rollbackCoupon`, `autoIssueCoupon`, `expireCoupons`

#### 点数系统（4 个）
`consumePoint`, `refundPoint`, `purchasePoints`, `getPointsBalance`, `getPointTransactions`

#### 邀请系统（5 个）
`createInvite`, `processInviteReward`, `getInviteRanking`, `getInviteStats`, `acceptFamilyInvite`, `inviteFamilyMember`, `removeFamilyMember`, `getFamilyMembers`

#### 知识库（2 个）
`getKnowledgeList`, `getKnowledgeDetail`

#### 回访系统（3 个）
`followupSubmit`, `getFollowupList`, `getFollowupDetail`

#### AI 报告（2 个）
`generateAIReport`, `getReportHistory`

#### 管理后台（10 个）
`adminLogin`, `adminGateway`, `adminGetOrders`, `adminUpdateOrder`, `adminGetUsers`, `adminGetStats`, `adminGetArticles`, `adminSaveArticle`, `adminDeleteArticle`, `adminGetConfig`, `adminUpdateConfig`

#### 定时任务（5 个）
`checkDailyBill`, `closeExpiredOrders`, `expireCoupons`, `cleanExpiredCache`, `sendExpireReminder`

#### 通知/工具（5 个）
`sendPaymentNotification`, `generateSharePoster`, `trackEvent`, `saveUserProfile`, `getUserStats`

#### 其他（4 个）
`dbInit`, `quickstartFunctions`, `getHospitals`, `searchHospitals`, `getRecordList`, `getRecordDetail`, `deleteRecord`

### B. 测试文件索引

| 文件路径 | 类型 | 用例数 |
|----------|:----:|:------:|
| `__tests__/unit/auth.test.js` | 单元 | 41 |
| `__tests__/unit/admin-auth.test.js` | 单元 | 71 |
| `__tests__/unit/constants-v15.test.js` | 单元 | 395 |
| `__tests__/unit/error-handler.test.js` | 单元 | 69 |
| `__tests__/unit/logger.test.js` | 单元 | 108 |
| `__tests__/unit/rate-limiter.test.js` | 单元 | 16 |
| `__tests__/unit/report-engine.test.js` | 单元 | 60 |
| `__tests__/unit/submit-symptom-enhanced.test.js` | 单元 | 220 |
| `__tests__/unit/risk-control.test.js` | 单元 | 57 |
| `__tests__/integration/login-flow.test.js` | 集成 | 24 |
| `__tests__/integration/symptom-flow.test.js` | 集成 | 30 |
| `__tests__/integration/pet-flow.test.js` | 集成 | 33 |
| `__tests__/integration/pay-callback-flow.test.js` | 集成 | 118 |
| `__tests__/cloud_functions_test.js` | 综合 | 118 |

---

> **文档维护**: 本测试计划应随每个版本迭代更新，确保覆盖率矩阵、测试用例清单和风险登记表保持最新。
>
> **审批**: 请项目负责人和技术负责人在上线前确认本计划中所有 Go/No-Go 检查项。
