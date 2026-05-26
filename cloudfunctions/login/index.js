// 云函数入口文件
const cloud = require('wx-server-sdk');

// 本地常量定义（避免跨云函数引用）
const COLLECTIONS = {
  USERS: 'users',
  PETS: 'pets',
  SYMPTOM_RECORDS: 'symptom_records',
  AI_CACHE: 'ai_cache',
  ORDERS: 'orders',
  HOSPITALS: 'hospitals'
};

const RESPONSE_CODE = {
  SUCCESS: 0,
  ERROR: -1,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 用户登录云函数
 * @param {Object} event - 请求参数
 * @param {string} event.code - 微信登录code
 * @param {string} event.nickname - 用户昵称（可选）
 * @param {string} event.avatar - 用户头像（可选）
 * @returns {Object} 登录结果
 */
exports.main = async (event, context) => {
  const { code, nickname = '', avatar = '' } = event;

  try {
    // 1. 参数校验
    if (!code) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '登录code不能为空',
        data: {}
      };
    }

    // 2. 调用微信登录接口获取openid
    const wxResult = await cloud.openapi.auth.code2Session({
      jsCode: code
    });

    if (wxResult.errcode !== 0) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '微信登录失败：' + wxResult.errmsg,
        data: {}
      };
    }

    const openid = wxResult.openid;
    const unionid = wxResult.unionid || '';

    // 3. 查询用户是否已存在
    const userResult = await db.collection(COLLECTIONS.USERS).where({
      openid: openid
    }).get();

    let userId;
    let isNewUser = false;

    if (userResult.data.length === 0) {
      // 4. 新用户，创建用户记录
      const userData = {
        openid: openid,
        unionid: unionid,
        nickname: nickname,
        avatar: avatar,
        member_expire: null,        // 非会员
        created_at: new Date(),
        updated_at: new Date()
      };

      const insertResult = await db.collection(COLLECTIONS.USERS).add({
        data: userData
      });

      userId = insertResult._id;
      isNewUser = true;

    } else {
      // 5. 老用户，更新用户信息
      userId = userResult.data[0]._id;
      const updateData = {
        updated_at: new Date()
      };

      if (nickname) {
        updateData.nickname = nickname;
      }
      if (avatar) {
        updateData.avatar = avatar;
      }

      await db.collection(COLLECTIONS.USERS).doc(userId).update({
        data: updateData
      });
    }

    // 6. 获取完整的用户信息
    const finalUserResult = await db.collection(COLLECTIONS.USERS).doc(userId).get();
    const userInfo = finalUserResult.data;

    // 7. 判断会员状态
    const isMember = userInfo.member_expire &&
                     new Date(userInfo.member_expire) > new Date();

    // 8. 返回登录结果
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: isNewUser ? '注册成功' : '登录成功',
      data: {
        userId: userId,
        openid: openid,
        userInfo: {
          nickname: userInfo.nickname,
          avatar: userInfo.avatar,
          isMember: isMember,
          memberExpire: userInfo.member_expire
        },
        isNewUser: isNewUser
      }
    };

  } catch (error) {
    console.error('登录失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务器错误，请稍后重试',
      data: {
        error: error.message
      }
    };
  }
};