// 静默登录云函数 - 简化版本，使用云开发内置openid
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 静默登录云函数 - 简化版本
 * 直接使用云开发内置的WX Context，避免调用微信API
 */
exports.main = async (event, context) => {
  try {
    console.log('=== 静默登录开始（简化版本） ===');

    // 直接从context获取openid（云开发内置）
    const { OPENID } = cloud.getWXContext();

    console.log('获取openid成功:', OPENID);

    // 查找或创建用户
    const userResult = await db.collection('users').where({
      _openid: OPENID
    }).get();

    let userData;
    let isNewUser = false;

    if (userResult.data.length === 0) {
      // 新用户，创建记录
      userData = {
        _openid: OPENID,
        nickName: '宠物主人',
        avatarUrl: '',
        createTime: new Date(),
        updateTime: new Date(),
        isMember: false,
        lastLoginTime: new Date(),
        loginCount: 1
      };

      const addResult = await db.collection('users').add({
        data: userData
      });

      userData._id = addResult._id;
      isNewUser = true;

      console.log('创建新用户成功:', userData._id);
    } else {
      // 老用户，更新登录信息
      userData = userResult.data[0];
      userData.lastLoginTime = new Date();
      userData.loginCount = (userData.loginCount || 0) + 1;

      await db.collection('users').doc(userData._id).update({
        data: {
          lastLoginTime: userData.lastLoginTime,
          loginCount: userData.loginCount,
          updateTime: new Date()
        }
      });

      console.log('用户登录成功:', userData._id);
    }

    // 生成简化的token（Base64编码的用户信息）
    const tokenData = {
      openid: OPENID,
      userId: userData._id,
      expireTime: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天
    };
    const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');

    console.log('生成token成功');

    return {
      code: 0,
      msg: isNewUser ? '登录成功（新用户）' : '登录成功',
      data: {
        token: token,
        openid: OPENID,
        userId: userData._id,
        userInfo: {
          nickName: userData.nickName,
          avatarUrl: userData.avatarUrl,
          isMember: userData.isMember
        },
        isNewUser: isNewUser
      }
    };

  } catch (error) {
    console.error('静默登录失败:', error);
    return {
      code: -1,
      msg: '登录失败: ' + error.message,
      data: {},
      error: error.toString()
    };
  }
};