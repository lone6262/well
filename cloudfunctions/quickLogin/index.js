// 快速登录云函数 - 用于测试和创建用户
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 快速登录云函数 - 自动创建用户
 */
exports.main = async (event, context) => {
  const { userInfo = {} } = event;

  try {
    // 获取用户openid
    const { OPENID } = cloud.getWXContext();

    console.log('用户OPENID:', OPENID);
    console.log('用户信息:', userInfo);

    // 检查用户是否已存在
    const userResult = await db.collection('users').where({
      _openid: OPENID
    }).get();

    let userData;

    if (userResult.data.length === 0) {
      // 用户不存在，创建新用户
      userData = {
        _openid: OPENID,
        nickName: userInfo.nickName || '测试用户',
        avatarUrl: userInfo.avatarUrl || '',
        createTime: new Date(),
        updateTime: new Date(),
        isMember: true,
        loginCount: 1,
        lastLoginTime: new Date()
      };

      const addResult = await db.collection('users').add({
        data: userData
      });

      console.log('创建用户成功:', addResult);

      return {
        code: 0,
        msg: '用户创建成功',
        data: {
          openid: OPENID,
          userId: addResult._id,
          userInfo: userData
        }
      };
    } else {
      // 用户已存在，更新登录信息
      const existingUser = userResult.data[0];

      await db.collection('users').doc(existingUser._id).update({
        data: {
          lastLoginTime: new Date(),
          loginCount: existingUser.loginCount + 1 || 1,
          updateTime: new Date()
        }
      });

      console.log('用户登录成功:', existingUser);

      return {
        code: 0,
        msg: '登录成功',
        data: {
          openid: OPENID,
          userId: existingUser._id,
          userInfo: existingUser
        }
      };
    }
  } catch (error) {
    console.error('登录失败:', error);
    return {
      code: -1,
      msg: '登录失败: ' + error.message,
      data: {}
    };
  }
};
