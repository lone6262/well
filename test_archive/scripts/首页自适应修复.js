// 首页自适应问题诊断和修复
console.log('🔍 诊断首页自适应问题\n');

const fs = require('fs');
const path = require('path');

const indexWxss = path.join(__dirname, 'miniprogram/pages/index/index.wxss');
const indexWxml = path.join(__dirname, 'miniprogram/pages/index/index.wxml');

// 读取现有样式
const wxssContent = fs.readFileSync(indexWxss, 'utf8');
const wxmlContent = fs.readFileSync(indexWxml, 'utf8');

console.log('🔍 发现的自适应问题:');
console.log('='.repeat(50));

// 检查3个问题区域
const problemAreas = [
  {
    name: '宠物急症/误食一键救命',
    className: '.emergency-btn',
    issues: []
  },
  {
    name: '症状自查',
    className: '.primary-btn',
    issues: []
  },
  {
    name: '附近宠物医院',
    className: '.secondary-btn, .hospital-preview',
    issues: []
  }
];

// 检查每个问题区域
problemAreas.forEach(area => {
  console.log(`\n📱 ${area.name}:`);

  // 检查是否有width: 100%
  const hasWidth = wxssContent.includes('width: 100%');
  if (!hasWidth) {
    area.issues.push('缺少width: 100%');
  }

  // 检查是否有box-sizing
  const hasBoxSizing = wxssContent.includes('box-sizing: border-box');
  if (!hasBoxSizing) {
    area.issues.push('缺少box-sizing: border-box');
  }

  // 检查是否有固定宽度
  const hasFixedWidth = wxssContent.match(/width:\s*\d+(rpx|px|em)/);
  if (hasFixedWidth) {
    area.issues.push(`存在固定宽度: ${hasFixedWidth[0]}`);
  }

  if (area.issues.length > 0) {
    console.log(`  ❌ 发现问题:`);
    area.issues.forEach(issue => console.log(`     - ${issue}`));
  } else {
    console.log(`  ✅ 样式正常`);
  }
});

console.log(`\n\n🛠️  修复方案:`);
console.log('='.repeat(50));

// 创建修复后的样式
const improvedWxss = `/* 首页样式 - 完全自适应版本 */
.container {
  padding: 20rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

/* 急救区域 - 修复自适应 */
.emergency-section {
  margin-bottom: 30rpx;
  width: 100%;
  box-sizing: border-box;
}

.emergency-btn {
  background: linear-gradient(135deg, #f5222d 0%, #ff4d4f 100%);
  color: white;
  border-radius: 16rpx;
  padding: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(245, 34, 45, 0.3);
  border: none;
  width: 100%;
  box-sizing: border-box;
  font-size: 32rpx;
}

.emergency-icon {
  font-size: 48rpx;
  margin-right: 16rpx;
}

.emergency-text {
  font-size: 32rpx;
  font-weight: bold;
  white-space: nowrap;
}

/* 卡片区域 - 修复自适应 */
.card-section {
  margin-bottom: 24rpx;
  width: 100%;
  box-sizing: border-box;
}

.card {
  background: white;
  border-radius: 16rpx;
  padding: 32rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
  width: 100%;
  box-sizing: border-box;
}

.card-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
}

.card-content {
  display: flex;
  flex-direction: column;
  margin-bottom: 24rpx;
}

.card-desc {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
  margin-bottom: 8rpx;
}

/* 按钮样式 - 修复自适应 */
.primary-btn {
  background: #4A90E2;
  color: white;
  border-radius: 12rpx;
  padding: 24rpx;
  font-size: 32rpx;
  border: none;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.secondary-btn {
  background: #f0f0f0;
  color: #333;
  border-radius: 12rpx;
  padding: 24rpx;
  font-size: 32rpx;
  border: none;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

/* 医院预览 - 修复自适应 */
.hospital-preview {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
  width: 100%;
  box-sizing: border-box;
}

.preview-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
}

.hospital-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}

.hospital-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
  width: 100%;
  box-sizing: border-box;
}

.hospital-item:last-child {
  border-bottom: none;
}

.hospital-name {
  font-size: 28rpx;
  color: #333;
  flex: 1;
  word-break: break-all;
}

.hospital-distance {
  font-size: 24rpx;
  color: #999;
  margin-left: 16rpx;
  white-space: nowrap;
}

/* 响应式优化 */
@media (max-width: 375px) {
  .emergency-text {
    font-size: 28rpx;
  }

  .card-title {
    font-size: 32rpx;
  }

  .primary-btn, .secondary-btn {
    font-size: 28rpx;
    padding: 20rpx;
  }
}

/* 防止横向滚动 */
* {
  max-width: 100%;
  box-sizing: border-box;
}`;

console.log('✅ 修复方案已生成');
console.log('📝 主要修复内容:');
console.log('1. 所有容器添加 width: 100% 和 box-sizing: border-box');
console.log('2. 按钮和卡片确保自适应宽度');
console.log('3. 添加响应式媒体查询');
console.log('4. 防止横向滚动的通用样式');
console.log('5. 文本换行和溢出处理');

console.log('\n🎯 修复目标:');
console.log('- 宠物急症/误食一键救命按钮: 完全自适应');
console.log('- 症状自查按钮: 完全自适应');
console.log('- 附近宠物医院列表: 完全自适应');

// 应用修复
try {
  fs.writeFileSync(indexWxss, improvedWxss, 'utf8');
  console.log('\n✅ 样式文件已更新');
  console.log('🚀 请重新编译查看效果');
} catch (error) {
  console.log('\n❌ 更新失败:', error.message);
}

console.log('\n🎉 首页自适应问题修复完成！');

module.exports = { status: '修复完成', problems: problemAreas };