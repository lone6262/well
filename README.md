# 宠脉AI - 宠物症状自查小程序

> 基于微信云开发的宠物健康风险评估 + AI健康助手 + 会员服务平台

## 项目结构

```
well/
├── miniprogram/              # 小程序前端代码
│   ├── app.js               # 入口文件
│   ├── app.json             # 全局配置
│   ├── components/          # 公共组件
│   ├── config/              # 前端配置（敏感词等）
│   ├── images/              # 图片资源
│   ├── pages/               # 页面目录
│   └── utils/               # 工具函数
├── cloudfunctions/           # 云函数（77 个可部署）
│   ├── common/              # 公共模块（唯一源码，见 CLAUDE.md）
│   └── <func>/             # 各云函数 index.js + package.json + common/ 副本
├── admin/                    # Web 管理后台（HTML/CSS/JS）
├── scripts/                 # 部署与同步脚本
├── docs/                    # 开发文档合集（权威：开发文档V1.5-FINAL.md）
├── archive/                 # 历史归档（旧报告 + V1.0/V1.1 文档，仅供查阅）
├── __tests__/               # 自动化测试
├── project.config.json
└── project.private.config.json
```

## 技术栈

- **框架**：微信小程序原生框架
- **后端**：微信云开发（CloudBase）
- **AI**：DeepSeek API
- **地图**：腾讯位置服务
- **支付**：微信支付

## 核心功能

1. 🐾 **症状自查** - 多轮问答式症状分析
2. 🤖 **AI报告** - 智能生成健康评估报告（付费）
3. 🏥 **附近医院** - 地图查找宠物医院
4. 💳 **会员体系** - 月卡/年卡订阅
5. 📚 **科普知识库** - 宠物健康知识
6. 🔄 **回访系统** - 24小时自动回访
7. 🤝 **邀请裂变** - 邀请得免费报告

## 快速开始

1. 在微信开发者工具中打开本项目
2. 开通云开发环境
3. 部署所有云函数
4. 运行 dbInit 初始化数据库
5. 配置 cloudfunctions/common/secrets.js
6. 确保所有集合索引已创建

## 当前版本

V1.5 商业化增强版
