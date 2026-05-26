/**
 * 快速云开发验证脚本 - 控制台版本
 * 使用方法：复制代码到微信开发者工具控制台运行
 */

(function() {
  console.log('🚀 云开发环境快速验证工具启动');

  // 获取当前环境配置
  const app = getApp();
  const envId = app?.globalData?.env || "cloud1-d8gdi44zqfec250b";

  console.log('📋 当前环境ID:', envId);
  console.log('🔍 开始验证...');

  // 验证流程
  async function quickVerify() {
    try {
      // 1. 检查基础库
      if (!wx.cloud) {
        console.error('❌ 基础库版本不支持云开发');
        console.log('💡 建议：使用2.2.3或以上基础库');
        return;
      }
      console.log('✅ 基础库支持云开发');

      // 2. 检查环境ID格式
      if (!envId || envId.trim() === '') {
        console.error('❌ 环境ID为空');
        console.log('💡 建议：在app.js中配置有效的环境ID');
        return;
      }
      console.log('✅ 环境ID格式检查通过');

      // 3. 测试云开发初始化
      console.log('🔄 正在初始化云开发...');

      const initResult = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error('❌ 云开发初始化超时（10秒）');
          console.log('💡 建议：检查网络连接或环境ID是否正确');
          resolve({ success: false, error: 'timeout' });
        }, 10000);

        wx.cloud.init({
          env: envId,
          traceUser: true,
          success: () => {
            clearTimeout(timeout);
            console.log('✅ 云开发初始化成功');
            resolve({ success: true });
          },
          fail: (err) => {
            clearTimeout(timeout);
            const errorMsg = parseCloudError(err);
            console.error('❌ 云开发初始化失败:', errorMsg);
            console.log('💡 建议:', getSuggestion(err));
            resolve({ success: false, error: err });
          }
        });
      });

      if (!initResult.success) {
        return;
      }

      // 4. 测试数据库连接
      console.log('🔄 正在测试数据库连接...');

      const db = wx.cloud.database();
      db.listCollections({
        success: (res) => {
          console.log('✅ 数据库连接正常');
          console.log('📊 集合数量:', res.collections.length);
          if (res.collections.length > 0) {
            console.log('📋 集合列表:', res.collections.map(c => c.name));
          }
          console.log('🎉 云开发环境验证通过！');
        },
        fail: (err) => {
          console.warn('⚠️ 数据库查询失败，但云开发基础功能正常');
          console.log('💡 可能需要配置数据库权限');
          console.log('🎉 云开发基础功能验证通过！');
        }
      });

    } catch (error) {
      console.error('❌ 验证过程异常:', error.message);
    }
  }

  // 解析云开发错误
  function parseCloudError(err) {
    const errMsg = err.errMsg || JSON.stringify(err);

    if (errMsg.includes('env:not exist') || errMsg.includes('环境不存在')) {
      return '云环境ID不存在';
    } else if (errMsg.includes('permission') || errMsg.includes('权限')) {
      return '权限不足';
    } else if (errMsg.includes('network') || errMsg.includes('网络')) {
      return '网络连接失败';
    } else {
      return `连接失败: ${errMsg}`;
    }
  }

  // 获取建议
  function getSuggestion(err) {
    const errMsg = err.errMsg || '';

    if (errMsg.includes('env:not exist')) {
      return '检查环境ID拼写或在云开发控制台确认环境存在';
    } else if (errMsg.includes('permission')) {
      return '确认项目AppID与云开发环境匹配';
    } else {
      return '检查网络连接，稍后重试';
    }
  }

  // 开始验证
  setTimeout(() => {
    quickVerify();
  }, 100);

  console.log('📖 验证结果将显示在下方日志中...');
  console.log('');

})();