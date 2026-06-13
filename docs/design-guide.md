# 宠脉AI — 反 AI 模板设计规范

> 「Warm Professionalism」设计系统规范文档
> 版本：2.0 · 更新：2026-06-10

---

## 1. 设计哲学

像一家有品位的宠物诊所——温暖、值得信赖、有生命力。

| 原则 | 做法 |
|------|------|
| 克制胜于堆砌 | 90% 表面不使用渐变，用纯色表达自信 |
| 手工质感 | 空状态、插图等关键位置引入有机形状 |
| 专业图标语言 | 用 SVG 矢量图标替代 emoji |
| 排版即个性 | 靠字重、字号、间距建立层次，而非颜色 |
| 色彩有温度 | 暖色主色调 + 柔和辅助色 |

---

## 2. 禁止清单

以下模式是 AI 生成 UI 的典型痕迹，**严禁使用**：

### ❌ 禁止

| 项目 | 原因 | 替代方案 |
|------|------|----------|
| Emoji 充当图标（🐾🩺🏥📋等） | 不专业、跨平台渲染不一致 | SVG 图标 `/images/icons/*.svg` |
| `linear-gradient` 渐变背景 | 廉价感、视觉噪音 | 纯色 `var(--brand-primary)` |
| `backdrop-filter: blur()` 毛玻璃 | 性能差、低端机卡顿 | `rgba(255,255,255,0.95)` + 细边框 |
| 冷色系（蓝紫 `#4A90E2`、`#667eea`） | 千篇一律 AI 模板感 | 陶土色 `#B35D3A` 暖色系 |
| 千篇一律的圆角卡片 + 阴影 | 看起来像 AI 批量生成 | 三种卡片类型区分（内容卡/功能磁贴/状态卡） |
| `box-shadow` 彩色阴影 | 过度装饰 | 仅使用 3 级暖色阴影 |
| `bounce` / 大幅 `scale` 动画 | 不专业、干扰注意力 | `scale(0.97)` 按压反馈 |
| 通用 Material Design 配色 | 没有品牌个性 | 自定义暖色色板 |

### ✅ 唯一保留的渐变

VIP 会员卡：`linear-gradient(135deg, var(--brand-primary), var(--brand-accent))`
仅此一处，其余渐变一律清除。

---

## 3. 色彩体系

### 3.1 浅色模式

| Token | 色值 | 用途 |
|-------|------|------|
| `--brand-primary` | `#B35D3A` | 主色（陶土色） |
| `--brand-primary-light` | `#F5EDE8` | 主色浅底 |
| `--brand-primary-dark` | `#8B3F20` | 按压态 |
| `--brand-secondary` | `#5B8C7A` | 辅助色（鼠尾草绿） |
| `--brand-accent` | `#E8A87C` | 强调色（桃色） |
| `--brand-emergency` | `#D94F4F` | 紧急/危险 |
| `--bg-color` | `#FDFAF7` | 页面底色（暖白） |
| `--bg-secondary` | `#F5F0EB` | 次级底色（暖灰） |
| `--bg-card` | `#FFFFFF` | 卡片底色 |
| `--text-primary` | `#2D2A26` | 主文字（暖黑） |
| `--text-secondary` | `#7A7267` | 辅助文字 |
| `--text-tertiary` | `#A39E97` | 淡色文字 |
| `--border-color` | `#E8E2DC` | 边框色 |

### 3.2 语义色

| Token | 色值 | 场景 |
|-------|------|------|
| `--color-success` | `#6B9E7D` | 成功、安全 |
| `--color-warning` | `#D4A855` | 警告、提醒 |
| `--color-danger` | `#D94F4F` | 危险、急救 |
| `--color-info` | `#7B9EB8` | 信息、提示 |

### 3.3 暗黑模式

暗黑模式 Token 在 `design-tokens.wxss` 的 `@media (prefers-color-scheme: dark)` 块中定义。页面只需使用 `var()` 引用即可自动适配。

---

## 4. 图标系统

### 4.1 技术方案

- **SVG 矢量图标**，存放于 `/images/icons/*.svg`
- WXML 引用：`<image class="icon-img" src="/images/icons/xxx.svg" />`
- 尺寸工具类：`.icon-img-sm`(28rpx) / `.icon-img`(40rpx) / `.icon-img-lg`(48rpx) / `.icon-img-xl`(64rpx)
- 颜色通过 SVG 内 `stroke` 属性控制，统一为 `#B35D3A`

### 4.2 图标清单

**核心图标（19 个）：**
paw, stethoscope, hospital, user, alert, phone, compass, pin, crown, clipboard, check, cross, warning, pill, gift, cat, dog, eye, question

**使用规范：**
- 图标必须带 `aria-label` 属性（无障碍）
- 图标 + 文字组合表达语义，不单靠图标
- 空状态使用 `/images/illustrations/*.svg` 插图

---

## 5. 组件规范

### 5.1 内容卡片 `<content-card>`

```
白底 | border-radius: 20rpx | 1rpx 边框 | 左侧 4rpx 品牌色强调线
无阴影 | 无渐变
Props: accent = 'brand' | 'success' | 'warning' | 'danger'
```

### 5.2 功能磁贴 `<feature-tile>`

```
白底 | border-radius: 20rpx | 1rpx 边框 | 顶部 4rpx 分类色条
图标在 80rpx 淡色圆容器中 | 无渐变
Props: color, icon, title
```

### 5.3 状态卡片 `<status-card>`

```
带色彩背景（非白底）| border-radius: 24rpx | 大内边距 36rpx
无 shadow | 靠背景色区分
Props: type = 'success' | 'warning' | 'danger' | 'info'
```

---

## 6. 排版

| 角色 | 字号 | 字重 |
|------|------|------|
| 页面标题 | 40rpx | 600 |
| 卡片标题 | 36rpx | 600 |
| 功能名 | 32rpx | 600 |
| 正文 | 28rpx | 400 |
| 辅助描述 | 26rpx | 300 |
| 标签/overline | 20rpx | 600 + letter-spacing 2rpx |

字体栈：`"PingFang SC", "Noto Sans SC", -apple-system, sans-serif`

---

## 7. 阴影系统

仅 3 级，暖色调：

| 级别 | 值 | 用途 |
|------|-----|------|
| `--shadow-xs` | `0 1rpx 2rpx rgba(45,42,38,0.04)` | 浮层 |
| `--shadow-sm` | `0 1rpx 3rpx rgba(45,42,38,0.06)` | 常规卡片 |
| `--shadow-md` | `0 4rpx 8rpx rgba(45,42,38,0.08)` | 模态框/底部动作条 |

**规则：** 有色背景卡片不用 shadow，靠背景色和边框区分。

---

## 8. 动效

| 场景 | 效果 | 参数 |
|------|------|------|
| 按钮按压 | `scale(0.97)` + 背景色过渡 | 100ms, `--ease-standard` |
| 急救按钮 | scale 1.06 + 透明度脉冲 | 0.85→1.0, 3s 周期 |
| 交错入场 | `translateY(16rpx) → 0` + `opacity` | 40ms 交错, ≤400ms 总时长 |
| 页面过渡 | `fade-in` / `slide-up` | `--ease-standard` |
| 骨架屏 | 微光扫过 | `--bg-secondary` 暖灰底 |

---

## 9. 验证检测

```bash
# 残留 emoji（目标：0）
grep -rn "[🩺🏥📋💉💊📞🧭📍🐱🐶🐾👑⭐🎁📚✅❌⚠️🚨💡📖✏️🗑️📸📝💚📊📤💬🔧🎫🤝💰🔄📦🗺️👁🏆🥇🥈🥉🎉👋]" miniprogram/ --include="*.wxml" --include="*.js"

# 残留旧色值（目标：0）
grep -rn "#4A90E2\|#667eea\|#764ba2" miniprogram/ --include="*.wxss" --include="*.wxml" --include="*.js"

# 残留渐变（目标：≤1，仅 VIP 卡）
grep -rn "linear-gradient" miniprogram/ --include="*.wxss"

# 残留毛玻璃（目标：0）
grep -rn "backdrop-filter" miniprogram/ --include="*.wxss"
```

---

## 10. 文件清单

| 文件 | 职责 |
|------|------|
| `utils/design-tokens.wxss` | 全部 CSS 变量（含暗黑模式） |
| `styles/iconfont.wxss` | 图标基础样式 + 尺寸/颜色工具类 |
| `utils/ui-components.wxss` | 通用组件样式库 |
| `components/content-card/` | 内容卡片组件 |
| `components/feature-tile/` | 功能磁贴组件 |
| `components/status-card/` | 状态卡片组件 |
| `images/icons/*.svg` | 19 个矢量图标 |
| `images/illustrations/*.svg` | 3 个空状态插图 |
| `images/icons/*.png` | TabBar 专用图标 |
