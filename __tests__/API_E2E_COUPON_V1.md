# 优惠券模块 API 测试用例 + E2E 手动清单（AutoTest 步骤 4-5）

> 生成时间：2026-07-16 · 分支 `fix/code-review-remediation`
> 平台适配：小程序运行于微信客户端（非浏览器），E2E 无法用 Playwright 驱动；
> 云函数需真实 CloudBase 环境+密钥。故本文件产出**可执行的手动用例 + API 用例清单**，
> 自动化骨架见 [e2e/coupon-purchase.automator.js](e2e/coupon-purchase.automator.js)。

## 一、API 接口测试用例（步骤 5）

> 执行环境：微信云开发 `cloud1-d8gdi44zqfec250b5`，MOCK_PAY=true（避免真实扣款）
> 执行方式：`tcb fn invoke <funcName> --params '<json>'` 或微信开发者工具云函数面板

### 1. `getUserCoupons`（拉取用户可用券）

| 用例 | 入参 | 预期 |
|------|------|------|
| AC-01 | `{ token, status:'unused', orderType:'points' }` | code=0；返回 coupons 仅含 type∈{points,universal} 且未用未过期；字段为驼峰（discountType/discountValue/minAmount） |
| AC-02 | `{ token, status:'unused', orderType:'member' }` | 仅 member+universal 券 |
| AC-03 | `{ token, status:'unused', orderType:'report' }` | 仅 report+universal 券 |
| AC-04 | 无可用券 | code=0，coupons=[] |
| AC-05 | token 无效/过期 | 鉴权失败 code≠0 |

### 2. `createOrder`（含 couponId 的下单）

| 用例 | 入参 | 预期（与 coupon-helper 三端口径一致） |
|------|------|------|
| CO-01 | `{ type:'points', packType:'PACK_3', couponId:'<uc_8zhe>', token }` | 抵扣=floor(price×(10-8)/10)；payAmount=price-抵扣；user_coupons 置 used；coupon_discount 记录 |
| CO-02 | `{ type:'points', packType:'PACK_3', couponId:'' , token }` | **不使用券**（修复点）：coupon_discount=0，实付=原价，不锁定任何券 |
| CO-03 | `{ type:'points', couponId:'<无效或他人券>', token }` | 自动选最优兜底；订单成功；无报错 |
| CO-04 | `{ type:'member_yearly', couponId:'<uc_fixed>', token }` | 抵扣=fixed 值，封顶不超过 amount |
| CO-05 | `{ type:'report', couponId:'<universal_uc>', token }`（已付费） | 抵扣正确；报告额度到账 |
| CO-06 | `{ type:'points', couponId:'<uc_8zhe>', token }`（isTestMode） | 测试单跳过券（isTestMode） |
| CO-07 | percent 脏数据（discount_value=80，历史百分比） | clamp→10折→抵扣0，**不产生负折扣资损** |

### 3. `applyCoupon`（⚠️ 死代码，无调用方）

| 用例 | 预期 | 优先级 |
|------|------|--------|
| 见 [unit/coupon-apply-mocked.test.js](unit/../integration/coupon-apply-mocked.test.js) 已覆盖 10 路径 | mock 全绿 | — |
| 建议：若不启用，删除该云函数减少维护面 | — | 低 |

### 4. 性能/契约（基准，建议项）

- `getUserCoupons` P95 < 300ms（单用户券数 < 50）
- `createOrder` 含券查询 P95 < 800ms（DB 查 user_coupons + coupons 模板）
- 契约：所有金额字段单位「分」(整数)，前端展示除以 100 保留 2 位

## 二、E2E 手动执行清单（步骤 4）

> 三条下单链路 × 4 个选券状态。前置：测试号已领 universal / points / member 券各一张。

### 链路 A：点数包购买（pages/points/index）

| 步骤 | 操作 | 预期 |
|------|------|------|
| A1 | 进入点数页 | 默认**预选最优可用券**；券后价 < 原价；折扣行显示（如「-¥2.00」） |
| A2 | 切换 PACK_3 ↔ PACK_5 | 折扣金额按新原价**联动重算**；选中券保留 |
| A3 | 点「不使用优惠券」 | 实付 = 原价；购买弹窗无「券后」文案 |
| A4 | 重新点选某张券 | 实付恢复券后价 |
| A5 | 点购买（MOCK_PAY） | 成功；点数到账；该券状态变 used（再次进入不显示） |
| A6 | 领一张 8 折点数券 + 一张 fixed 5 元券（原价 19.90） | 默认预选 fixed（抵5元）而非 8 折（抵3.98），因 fixed 抵扣更大 |

### 链路 B：会员订单（pages/member/order）

| 步骤 | 操作 | 预期 |
|------|------|------|
| B1 | 进入会员页，选月卡 | 预选最优 member/universal 券 |
| B2 | 选「不使用」→ 购买 | 实付原价；createOrder 收到 couponId='' |
| B3 | 选一张未达门槛券（min_amount 高于月卡价） | 该券置灰不可选；或选了被后端兜底换最优 |
| B4 | 升级模式（已是月卡→年卡）选券购买 | 升级补差价正确扣除券抵扣；type 切换成功 |

### 链路 C：报告下单（pages/order/detail）

| 步骤 | 操作 | 预期 |
|------|------|------|
| C1 | 付费报告页（额度用尽） | 预选 report/universal 券 |
| C2 | 选券购买 | 抵扣正确；报告额度到账 |
| C3 | 测试单（isTestMode） | 跳过券逻辑（不锁定、不抵扣） |

### 异常/边界

| 用例 | 预期 |
|------|------|
| E1 | 网络断开时选券 | loadCoupons 失败回调；不阻断下单（按不使用处理） |
| E2 | 支付取消 | user_coupons 若已 locked，需有回滚（验证 rollbackCoupon 是否调用） |
| E3 | 8 折券 + 0.01 元订单 | 抵扣 = floor(1×2/10)=0，实付 0.01（不免费） |

## 三、发现的缺陷/风险

| 编号 | 描述 | 严重级 | 状态 |
|------|------|--------|------|
| F-01 | `applyCoupon` 云函数无任何调用方（死代码），其 fixed 分支未封顶 discount 与活路径分叉 | 低 | 记录（建议删除或启用前对齐） |
| F-02 | `discountValue \|\| 10`：值为 0 时触发默认 10 折。admin 录入 min=0.01 已规避，但 DB 直写 0 会被当无折扣 | 低 | 记录 |
| F-03 | warmupConfig 在 mock 环境查询 system_config 报 command 未定义（降级 warn） | 信息 | 生产有真实 db.command，不影响 |
