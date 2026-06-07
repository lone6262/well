// 快速登录云函数 - 用于测试和创建用户
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE , warmupConfig} = require('./common/constants');
const { generateToken } = require('./common/auth');
const { checkRateLimit } = require('./common/rate-limiter');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 快速登录云函数 - 自动创建用户
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { userInfo = {} } = event;

  try {
    // 获取用户openid
    const { OPENID } = cloud.getWXContext();

    console.log('用户登录信息获取成功');

    // 速率限制
    if (!await checkRateLimit(db, OPENID, 'quickLogin', 20, 60000, false)) {
      return { code: RESPONSE_CODE.ERROR, msg: '操作过于频繁，请稍后再试', data: {} };
    }

    // 检查用户是否已存在
    const userResult = await db.collection(COLLECTIONS.USERS).where({
      user_id: OPENID
    }).get();

    let userData;

    if (userResult.data.length === 0) {
      // 用户不存在，创建新用户
      userData = {
        user_id: OPENID,
        nickName: userInfo.nickName || '测试用户',
        avatarUrl: userInfo.avatarUrl || '',
        createTime: new Date(),
        updateTime: new Date(),
        isMember: false,
        loginCount: 1,
        lastLoginTime: new Date()
      };

      const addResult = await db.collection(COLLECTIONS.USERS).add({
        data: userData
      });

      console.log('创建用户成功:', addResult._id);

      const token = generateToken(OPENID, addResult._id);

      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '用户创建成功',
        data: {
          openid: OPENID,
          userId: addResult._id,
          token: token,
          userInfo: userData
        }
      };
    } else {
      // 用户已存在，更新登录信息
      const existingUser = userResult.data[0];

      await db.collection(COLLECTIONS.USERS).doc(existingUser._id).update({
        data: {
          lastLoginTime: new Date(),
          loginCount: (existingUser.loginCount || 0) + 1,
          updateTime: new Date()
        }
      });

      console.log('用户登录成功:', existingUser._id);

      const token = generateToken(OPENID, existingUser._id);

      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '登录成功',
        data: {
          openid: OPENID,
          userId: existingUser._id,
          token: token,
          userInfo: existingUser
        }
      };
    }
  } catch (error) {
    console.error('登录失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '登录失败，请稍后重试',
      data: {}
    };
  }
};
