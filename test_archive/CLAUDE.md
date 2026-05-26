# 宠物症状自查小程序

> 微信小程序云开发项目 - 宠物健康自查工具

## 项目概述

这是一个基于微信小程序云开发的宠物症状自查应用，帮助宠物主人快速识别和初步判断宠物的健康问题。

**技术栈**: 微信小程序 + 云开发 (云函数 + 云数据库 + 云存储)

**项目名称**: 宠物症状自查小程序 V1.0

**AppID**: wxee33a0c47421db2c

## 项目结构

```
well/
├── miniprogram/          # 小程序前端代码
│   ├── pages/           # 页面
│   │   ├── index/       # 首页
│   │   └── example/     # 示例页面
│   ├── components/      # 组件
│   ├── images/          # 图片资源
│   ├── app.js          # 小程序入口
│   ├── app.json        # 小程序配置
│   └── app.wxss        # 全局样式
├── cloudfunctions/      # 云函数
│   └── quickstartFunctions/  # 示例云函数
├── project.config.json  # 项目配置
└── .gitignore          # Git忽略配置
```

## 开发指南

### 环境要求

- 微信开发者工具
- 微信小程序开发权限
- 云开发环境开通

### 开发流程

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd well
   ```

2. **配置云开发环境**
   - 在微信开发者工具中打开项目
   - 点击"云开发"按钮，创建云开发环境
   - 获取环境 ID 并填入 `miniprogram/app.js` 中的 `env` 字段

3. **开发页面**
   - 页面位于 `miniprogram/pages/` 目录
   - 每个页面包含 `.js`、`.json`、`.wxml`、`.wxss` 四个文件

4. **开发云函数**
   - 云函数位于 `cloudfunctions/` 目录
   - 右键云函数文件夹选择"上传并部署：云端安装依赖"

### 代码规范

- 使用 ES6+ 语法
- 组件化开发，复用性优先
- 适当的错误处理和用户提示
- 遵循微信小程序开发规范

### 云开发使用

- **云数据库**: 用于存储宠物症状数据、用户记录等
- **云函数**: 处理复杂业务逻辑，避免敏感信息暴露
- **云存储**: 存储宠物图片等静态资源

## 核心功能规划

### 当前状态
- ✅ 基础项目结构搭建
- ✅ 云开发环境配置模板
- ✅ 示例页面和组件

### 待开发功能
- ⏳ 宠物症状选择器
- ⏳ 智能诊断逻辑
- ⏳ 症状历史记录
- ⏳ 用户反馈系统
- ⏳ 宠物档案管理

## 部署说明

1. **上传云函数**
   ```bash
   # 使用微信开发者工具右键云函数文件夹
   # 选择"上传并部署：云端安装依赖"
   ```

2. **上传小程序**
   - 在微信开发者工具中点击"上传"
   - 填写版本号和项目备注
   - 在微信公众平台提交审核

## 注意事项

- 敏感信息不要提交到代码仓库
- 云函数环境变量通过云开发控制台配置
- 生产环境需要配置正确的环境 ID
- 注意小程序包大小限制（主包 2MB，总包 20MB）

## Git 提交规范

遵循 Conventional Commits 格式：

- `feat`: 新功能
- `fix`: 修复bug
- `refactor`: 代码重构
- `docs`: 文档更新
- `test`: 测试相关
- `chore`: 构建/工具变更

示例：
```bash
git commit -m "feat: 添加宠物症状选择页面"
git commit -m "fix: 修复云函数调用失败问题"
```

## 相关资源

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [小程序组件文档](https://developers.weixin.qq.com/miniprogram/dev/component/)
- [小程序 API 文档](https://developers.weixin.qq.com/miniprogram/dev/api/)

---

**项目状态**: 开发中

**最后更新**: 2025-05-20

**维护者**: 开发团队
