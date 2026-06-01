# getUserStats 云函数修复指南

## 问题描述
用户中心页面调用 `getUserStats` 云函数时出现 -501000 错误，提示 "FunctionName parameter could not be found"。

## 解决方案

### 1. 云函数已创建
已在 `cloudfunctions/getUserStats/` 目录下创建以下文件：
- `index.js` - 云函数主逻辑
- `package.json` - 依赖配置

### 2. 云函数功能
该云函数统计用户的以下数据：
- **checkCount**: 症状自查次数
- **reportCount**: 问诊报告数
- **petCount**: 宠物数量  
- **orderCount**: 订单数量
- **favoriteCount**: 收藏数量

### 3. 部署步骤

#### 方式一：微信开发者工具部署（推荐）
1. 打开微信开发者工具
2. 在左侧项目结构中找到 `cloudfunctions/getUserStats` 文件夹
3. 右键点击该文件夹
4. 选择 "上传并部署：云端安装依赖"
5. 等待部署完成

#### 方式二：命令行部署
如果有配置微信开发者工具的命令行工具：
```bash
# 进入云函数目录
cd cloudfunctions/getUserStats

# 安装依赖
npm install

# 使用微信工具命令行部署
# 具体命令视微信CLI工具版本而定
```

### 4. 验证部署

部署完成后，在小程序中：
1. 进入用户中心页面
2. 查看控制台日志
3. 应该看到 "用户统计数据加载成功" 的日志
4. 用户统计数据卡片应正确显示数字

### 5. 技术细节

云函数逻辑：
- 并行查询 pets、symptom_records、orders 三个集合
- 基于 openid 过滤用户数据
- 使用 count() 方法获取统计数量
- 返回统一的响应格式

## 故障排除

如果仍然报错，请检查：
1. 云函数是否成功部署（在云开发控制台查看）
2. 云环境 ID 是否正确配置
3. 用户 openid 是否有效获取
4. 数据库集合是否存在数据

## 相关文件
- 云函数：`cloudfunctions/getUserStats/index.js`
- 调用代码：`miniprogram/pages/user/index.js` (第97行)
- 项目配置：`project.config.json`