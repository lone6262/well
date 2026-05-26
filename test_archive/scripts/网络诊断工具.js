/**
 * 网络诊断工具 - 绕过wx.cloud.init直接测试连接
 * 使用方法：在微信开发者工具控制台运行
 */

(function() {
  console.log('🔍 网络诊断工具启动');
  console.log('📋 测试目标：云开发服务器连接性');

  const envId = "cloud1-d8gdi44zqfec250b5"; // 当前环境ID
  const testUrls = [
    `https://${envId}.api.weixin.qq.com`,
    `https://api.weixin.qq.com`,
    `https://servicewechat.com`
  ];

  console.log('🌐 当前环境ID:', envId);
  console.log('🔗 测试URL列表:', testUrls);

  // 网络请求测试
  async function testConnectivity() {
    console.log('🚀 开始网络连接测试...');

    for (let i = 0; i < testUrls.length; i++) {
      const url = testUrls[i];
      console.log(`🔗 测试连接 ${i + 1}/${testUrls.length}: ${url}`);

      try {
        const result = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({ success: false, error: 'timeout', url: url });
          }, 5000);

          wx.request({
            url: url + '/health', // 健康检查端点
            method: 'GET',
            success: (res) => {
              clearTimeout(timeout);
              resolve({ success: true, url: url, status: res.statusCode });
            },
            fail: (err) => {
              clearTimeout(timeout);
              // 即使404也说明连接成功
              if (err.errMsg.includes('404') || err.errMsg.includes('request:fail')) {
                resolve({ success: true, url: url, note: '连接可达但端点不存在' });
              } else {
                resolve({ success: false, error: err.errMsg, url: url });
              }
            }
          });
        });

        if (result.success) {
          console.log(`✅ ${url} 连接成功`, result);
        } else {
          console.log(`❌ ${url} 连接失败:`, result.error);
        }

      } catch (error) {
        console.log(`❌ ${url} 测试异常:`, error.message);
      }
    }
  }

  // 云开发API测试
  function testCloudAPI() {
    console.log('🔄 测试云开发API可用性...');

    // 测试wx.cloud对象是否存在
    if (!wx.cloud) {
      console.error('❌ wx.cloud对象不存在');
      console.log('💡 原因：基础库版本过低或云开发未启用');
      return;
    }

    console.log('✅ wx.cloud对象存在');

    // 测试wx.cloud.init方法
    if (typeof wx.cloud.init !== 'function') {
      console.error('❌ wx.cloud.init方法不存在');
      return;
    }

    console.log('✅ wx.cloud.init方法存在');

    // 测试环境ID格式
    const envPattern = /^[a-zA-Z0-9\-]+$/;
    if (!envPattern.test(envId)) {
      console.error('❌ 环境ID格式无效');
      return;
    }

    console.log('✅ 环境ID格式有效');

    // 尝试同步初始化
    console.log('🔄 尝试同步初始化...');
    try {
      wx.cloud.init({
        env: envId,
        traceUser: true
      });
      console.log('✅ 同步初始化调用成功（不等待结果）');
    } catch (error) {
      console.log('⚠️ 同步初始化异常:', error.message);
    }
  }

  // 系统环境检查
  function checkSystemEnvironment() {
    console.log('🔧 系统环境检查...');

    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    console.log('📱 设备信息:', {
      platform: systemInfo.platform,
      system: systemInfo.system,
      SDKVersion: systemInfo.SDKVersion,
      benchmarkLevel: systemInfo.benchmarkLevel
    });

    // 检查基础库版本
    const SDKVersion = systemInfo.SDKVersion;
    console.log('📚 基础库版本:', SDKVersion);

    const versionParts = SDKVersion.split('.').map(Number);
    const isCompatible = versionParts[0] > 2 ||
                        (versionParts[0] === 2 && versionParts[1] >= 2);

    if (isCompatible) {
      console.log('✅ 基础库版本支持云开发');
    } else {
      console.log('❌ 基础库版本过低，不支持云开发');
    }

    // 检查网络类型
    console.log('🌐 网络状态检查...');
    if (wx.getNetworkType) {
      wx.getNetworkType({
        success: (res) => {
          console.log('📡 网络类型:', res.networkType);

          if (res.networkType === 'none') {
            console.error('❌ 无网络连接');
          } else {
            console.log('✅ 网络连接正常');
          }
        },
        fail: () => {
          console.log('⚠️ 无法获取网络类型');
        }
      });
    }
  }

  // 运行完整诊断
  async function runDiagnostics() {
    console.log('🏥 开始完整诊断流程...');
    console.log('');

    // 1. 系统环境检查
    checkSystemEnvironment();
    console.log('');

    // 2. 云开发API检查
    testCloudAPI();
    console.log('');

    // 3. 网络连接测试
    await testConnectivity();
    console.log('');

    console.log('🏁 诊断完成');
    console.log('💡 根据诊断结果采取相应措施');
  }

  // 启动诊断
  setTimeout(() => {
    runDiagnostics();
  }, 100);

})();