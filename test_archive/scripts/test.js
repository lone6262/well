// 测试文件 - 检查timeout是否依然存在
console.log('测试文件开始执行');

// 测试1: 检查wx对象
console.log('wx对象存在:', typeof wx !== 'undefined');
console.log('wx.cloud存在:', typeof wx.cloud !== 'undefined');

// 测试2: 尝试访问各种API
if (typeof wx !== 'undefined') {
  console.log('系统信息:', wx.getSystemInfoSync());
  console.log('存储信息:', wx.getStorageSync('hasLaunched'));
}

console.log('测试文件执行完成');