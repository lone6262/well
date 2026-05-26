// 最简单的测试云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  try {
    console.log('=== 测试云函数被调用 ===');
    console.log('收到event:', event);
    console.log('收到context:', context);

    // 直接获取openid
    const { OPENID } = cloud.getWXContext();
    console.log('获取OPENID成功:', OPENID);

    return {
      code: 0,
      msg: '测试成功',
      data: {
        openid: OPENID,
        message: '云函数正常工作'
      }
    };

  } catch (error) {
    console.error('测试云函数失败:', error);
    return {
      code: -1,
      msg: '测试失败: ' + error.message,
      data: {
        error: error.toString()
      }
    };
  }
};
