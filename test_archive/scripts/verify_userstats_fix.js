// getUserStats 云函数修复验证脚本
// 在微信开发者工具控制台中运行此脚本

console.log('=== getUserStats 云函数修复验证 ===');

// 获取当前用户openid
const app = getApp();
const openid = app.globalData.openid;

if (!openid) {
  console.error('❌ 无法获取用户openid，请先登录');
  return;
}

console.log('当前用户openid:', openid);

// 测试修复后的getUserStats云函数
wx.cloud.callFunction({
  name: 'getUserStats',
  data: {
    openid: openid
  },
  success: function(res) {
    console.log('✅ getUserStats云函数调用成功!');
    console.log('返回结果:', res.result);

    if (res.result.code === 0) {
      const stats = res.result.data;
      console.log('=== 统计数据详情 ===');
      console.log('🐾 宠物数量:', stats.petCount);
      console.log('🔍 自查次数:', stats.checkCount);
      console.log('📋 健康报告:', stats.reportCount);
      console.log('📦 订单数量:', stats.orderCount);
      console.log('❤️ 收藏数量:', stats.favoriteCount);

      // 验证修复效果
      if (stats.petCount > 0) {
        console.log('✅ 修复成功！宠物数量正确显示');
      } else {
        console.log('⚠️ 注意：宠物数量仍为0，可能需要检查数据库数据');
      }

      wx.showModal({
        title: '云函数验证成功',
        content: `宠物数量: ${stats.petCount}个\n自查次数: ${stats.checkCount}次\n修复状态: ${stats.petCount > 0 ? '✅ 正常' : '⚠️ 需检查'}`,
        showCancel: false
      });
    } else {
      console.log('❌ 云函数返回错误:', res.result.msg);
    }
  },
  fail: function(err) {
    console.error('❌ getUserStats云函数调用失败!');
    console.error('错误码:', err.errCode);
    console.error('错误信息:', err.errMsg);

    wx.showModal({
      title: '云函数调用失败',
      content: '错误码: ' + err.errCode + '\n错误信息: ' + err.errMsg,
      showCancel: false
    });
  }
});

console.log('=== 验证脚本执行完成 ===');