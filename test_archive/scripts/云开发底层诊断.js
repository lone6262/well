/**
 * 云开发底层诊断工具 - 直接测试wx.cloud API
 * 在微信开发者工具控制台运行
 */

console.log('🔍 云开发底层诊断开始');

// 1. 基础环境检查
console.log('📊 基础环境信息：');
const systemInfo = wx.getSystemInfoSync();
console.log('- 平台:', systemInfo.platform);
console.log('- 系统版本:', systemInfo.system);
console.log('- 基础库版本:', systemInfo.SDKVersion);
console.log('- 微信版本:', systemInfo.version);

// 2. wx.cloud对象检查
console.log('\n🔧 wx.cloud对象检查：');
console.log('- wx.cloud存在:', typeof wx.cloud !== 'undefined');
console.log('- wx.cloud类型:', typeof wx.cloud);

if (typeof wx.cloud !== 'undefined') {
  console.log('- wx.cloud.init存在:', typeof wx.cloud.init === 'function');
  console.log('- wx.cloud.database存在:', typeof wx.cloud.database === 'function');
  console.log('- wx.cloud.callFunction存在:', typeof wx.cloud.callFunction === 'function');
} else {
  console.error('❌ wx.cloud对象不存在，云开发不可用');
  console.log('💡 可能原因：');
  console.log('  1. 基础库版本过低（需要>=2.2.3）');
  console.log('  2. AppID无效或没有云开发权限');
  console.log('  3. project.config.json配置错误');
}

// 3. 环境ID格式验证
const envId = "cloud1-d8gdi44zqfec250b5"; // 当前使用的环境ID
console.log('\n🏷️ 环境ID验证：');
console.log('- 当前环境ID:', envId);
console.log('- 格式检查:', /^[a-z0-9\-]+$/.test(envId) ? '✅有效' : '❌无效');

// 4. 尝试多种初始化方式
console.log('\n🔄 测试不同初始化方式：');

// 方式1：无参数初始化
console.log('\n方式1: wx.cloud.init() 无参数');
try {
  wx.cloud.init();
  console.log('✅ 无参数初始化成功');
} catch (e) {
  console.log('❌ 无参数初始化失败:', e.message);
}

// 方式2：带环境ID初始化
console.log('\n方式2: wx.cloud.init({env: "' + envId + '"})');
try {
  wx.cloud.init({
    env: envId,
    traceUser: true
  });
  console.log('✅ 带环境ID初始化成功');
} catch (e) {
  console.log('❌ 带环境ID初始化失败:', e.message);
}

// 方式3：动态环境初始化
console.log('\n方式3: wx.cloud.init({ env: wx.cloud.DynamicCloud })');
try {
  wx.cloud.init({
    env: wx.cloud.DynamicCloud
  });
  console.log('✅ 动态环境初始化成功');
} catch (e) {
  console.log('❌ 动态环境初始化失败:', e.message);
}

// 5. 测试数据库连接
console.log('\n🗄️ 测试数据库连接：');
setTimeout(() => {
  try {
    const db = wx.cloud.database();
    console.log('✅ 数据库对象创建成功');

    // 尝试简单查询
    db.collection('test').count({
      success: (res) => {
        console.log('✅ 数据库查询成功:', res);
      },
      fail: (err) => {
        console.log('⚠️ 数据库查询失败:', err.errMsg);
        console.log('💡 这可能表示：');
        console.log('  1. 环境ID不存在');
        console.log('  2. 数据库权限未配置');
        console.log('  3. 网络连接问题');
      }
    });
  } catch (e) {
    console.log('❌ 数据库测试失败:', e.message);
  }
}, 2000);

// 6. 检查AppID配置
console.log('\n📱 AppID信息：');
console.log('- 当前AppID: wxee33a0c47421db2c');
console.log('- 项目类型: 云开发项目');

// 7. 建议和下一步
console.log('\n💡 诊断建议：');
console.log('1. 确认云开发环境是否真的存在');
console.log('2. 检查微信开发者工具的"云开发"按钮能否打开控制台');
console.log('3. 尝试创建新的云开发环境');
console.log('4. 检查网络连接和防火墙设置');

console.log('\n🔗 以下步骤可能有助于解决问题：');
console.log('步骤1: 微信开发者工具 → 云开发 → 开通/进入');
console.log('步骤2: 云开发控制台 → 设置 → 复制真实的环境ID');
console.log('步骤3: 更新app.js中的环境ID');
console.log('步骤4: 重新编译测试');