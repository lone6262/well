// 静默登录云函数 - 使用云开发内置openid + HMAC签名Token
const cloud = require('wx-server-sdk');
const { generateToken, verifyToken } = require('./common/auth');
const { warmupConfig } = require('./common/constants');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 静默登录云函数
 * 直接使用云开发内置的WX Context获取openid
 */
exports.main = async (event) => {
  await warmupConfig(db);
  try {
    console.log('[silentLogin] start');

    // 直接从context获取openid（云开发内置）
    const { OPENID } = cloud.getWXContext();
    const { source = '' } = event;


    // 查找或创建用户（使用user_id字段与其他云函数保持一致）
    const userResult = await db.collection('users').where({
      user_id: OPENID
    }).get();

    let userData;
    let isNewUser = false;

    if (userResult.data.length === 0) {
      // 新用户，创建记录
      userData = {
        user_id: OPENID,
        nickName: '宠物主人',
        avatarUrl: '',
        source: source || 'direct',  // Phase 1.5: 用户来源标记（默认 direct=直接打开）
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

      console.log('[silentLogin] new user');
    } else {
      // 老用户，更新登录信息
      const existingUser = userResult.data[0];
      const updatedLastLoginTime = new Date();
      const updatedLoginCount = (existingUser.loginCount || 0) + 1;

      userData = {
        ...existingUser,
        lastLoginTime: updatedLastLoginTime,
        loginCount: updatedLoginCount
      };

      await db.collection('users').doc(existingUser._id).update({
        data: {
          lastLoginTime: updatedLastLoginTime,
          loginCount: updatedLoginCount,
          updateTime: new Date()
        }
      });

      console.log('[silentLogin] login ok');
    }

    // 生成HMAC签名的Token（替代Base64编码）
    const token = generateToken(OPENID, userData._id);

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
    console.error('[silentLogin] fail:', error.message);
    return {
      code: -1,
      msg: '登录失败，请稍后重试',
      data: {}
    };
  }
};

// 导出verifyToken供其他云函数使用
exports.verifyToken = verifyToken;
