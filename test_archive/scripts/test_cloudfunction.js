// 云函数测试脚本
// 在微信开发者工具控制台中运行此脚本

console.log('=== 开始测试 getUserStats 云函数 ===');

// 测试云函数部署状态
wx.cloud.callFunction({
  name: 'getUserStats',
  data: {
    openid: 'test_openid_for_check'
  },
  success: function(res) {
    console.log('✅ 云函数部署成功！');
    console.log('返回结果:', res.result);

    if (res.result.code === 0) {
      console.log('✅ 云函数功能正常');
      console.log('统计数据:', res.result.data);
      wx.showToast({
        title: '云函数正常',
        icon: 'success'
      });
    } else {
      console.log('⚠️ 云函数返回错误:', res.result.msg);
    }
  },
  fail: function(err) {
    console.error('❌ 云函数调用失败！');
    console.error('错误码:', err.errCode);
    console.error('错误信息:', err.errMsg);

    wx.showModal({
      title: '云函数测试失败',
      content: '错误码: ' + err.errCode + '\n错误信息: ' + err.errMsg,
      showCancel: false
    });

    if (err.errCode === -501000) {
      console.log('💡 提示: 云函数未部署，请按以下步骤操作：');
      console.log('1. 右键点击 cloudfunctions/getUserStats 文件夹');
      console.log('2. 选择 "上传并部署：云端安装依赖"');
      console.log('3. 等待部署完成后重新测试');
    }
  }
});

console.log('=== 测试脚本执行完成 ===');