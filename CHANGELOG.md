# 更新日志 (CHANGELOG)

> 本文件记录 Mewora 宠物AI助手 项目的版本变更。格式参考 [Keep a Changelog](https://keepachangelog.com/)。

---

## [V1.5.1] - 2026-07-12 会员升级链路加固

### 🔧 修复

#### 1. createOrder mock_pay 模式激活失败（核心修复）
- **问题**：mock_pay 模式下，`createOrder` 通过云函数间调用 `payCallback` 激活会员，可能因超时/异常导致会员记录未更新（`type` 未切换、额度未刷新），订单 `dispatch_status` 停留在 `undefined`。
- **修复**：`cloudfunctions/createOrder/index.js`
  - 调用 `payCallback` 后增加**激活校验**：查 members 表确认 `type` 已切换 + `activated_by_order` 已更新
  - 校验失败时执行 **`inlineActivateMember` 内联兜底**（完整激活逻辑：到期日取 max、额度按类型查配置、升级重置 used=0）
  - 兜底成功标记 `dispatch_status: completed`，失败标记 `dispatch_status: failed` + 记录 `dispatch_error`
- **影响范围**：所有 mock_pay 模式下的会员订单（新开/续费/升级）

#### 2. renewMemberByAuto 字段名错误 + 额度未同步
- **问题**：`cloudfunctions/renewMemberByAuto/index.js` 自动续费时写入错误字段名 `next_reset_date`（应为 `report_credits_reset_at`），且未更新 `report_credits_total`，导致后台调整额度后续费不生效。
- **修复**：
  - `next_reset_date` → `report_credits_reset_at`
  - 新增 `report_credits_total: renewCredits` 同步总额度

#### 3. 前端升级轮询误报成功
- **问题**：`miniprogram/pages/member/order.js` 的 `_pollMemberActivation` 仅检查 `is_member === true` 就提示成功。个人年卡升级到家庭年卡时 `is_member` 本就为 true，导致支付后立刻提示成功但 payCallback 可能还没执行完，用户看到的次数还是旧的。
- **修复**：
  - 升级模式（`upgradeMode`）下额外校验 `type` 已切换为目标类型
  - 轮询次数从 4 次提升到 8 次（每次间隔 1s）

#### 4. order/detail.js 中文编码损坏
- **问题**：`miniprogram/pages/order/detail.js` 中文字符编码损坏，导致微信开发者工具编译报 `Unexpected token`，订单详情页无法打开。
- **修复**：以 UTF-8 without BOM 重新保存，恢复全部中文（待支付、已支付、退款中等）。

### ✅ 验证

- 端到端测试通过：个人月卡 → 家庭年卡升级，额度从 3 → 6，已用次数清零
- 部署状态：`createOrder` / `renewMemberByAuto` / `payCallback` 均已部署到云端
- 数据库修复：受影响的会员记录已手动修正

### 📝 涉及文件

| 文件 | 改动类型 |
|------|---------|
| `cloudfunctions/createOrder/index.js` | 新增 `inlineActivateMember` + mock_pay 校验兜底 |
| `cloudfunctions/renewMemberByAuto/index.js` | 字段名修复 + 额度同步 |
| `miniprogram/pages/member/order.js` | 升级轮询校验 |
| `miniprogram/pages/order/detail.js` | 编码修复 |
| `CLAUDE.md` | 补充会员升级链路文档 |
| `docs/开发文档V1.5-FINAL.md` | 更新 8.3 会员订阅与升级流程 |
| `README.md` | 补充会员体系说明 |

---

## [V1.5] - 2024-06 商业化增强版

- 会员订阅（个人/家庭 × 月卡/年卡）
- 微信支付集成（模拟/真实切换）
- 邀请裂变系统
- Web 管理后台
- 额度管理（按月重置）
- 点数包、优惠券、套餐组合

---

## [V1.1] - 2024-06 代码质量优化

- 常量系统重构
- Git 规范化
- ESLint + Prettier 集成

---

## [V1.0] - 2024-05 初始版本

- 症状自查 + 规则引擎风险评级
- DeepSeek AI 报告生成
- 附近医院地图搜索
- 宠物档案管理