// 用户登录云函数 - 通过微信 code 换取 openid + HMAC签名Token
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { generateToken } = require('./common/auth');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 用户登录云函数
 * 使用 wx.login() 返回的 code 调用 code2Session 获取 openid
 * @param {Object} event - 请求参数
 * @param {string} event.code - 微信登录code
 * @param {string} event.nickname - 用户昵称（可选）
 * @param {string} event.avatar - 用户头像（可选）
 * @returns {Object} 登录结果（含 token）
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
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
      user_id: openid
    }).get();

    let userId;
    let isNewUser = false;

    if (userResult.data.length === 0) {
      // 4. 新用户，创建用户记录
      const userData = {
        user_id: openid,
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

      // V1.5: 新用户自动发券
      try {
        await cloud.callFunction({
          name: 'autoIssueCoupon',
          data: { userId: openid, scene: 'new_user' }
        });
      } catch (couponErr) {
        console.warn('[login] 新用户发券跳过:', couponErr.message);
      }

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

    // 8. 生成 HMAC 签名的 Token
    const token = generateToken(openid, userId);

    // 9. 返回登录结果
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: isNewUser ? '注册成功' : '登录成功',
      data: {
        token: token,
        userId: userId,
        user_id: openid,
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
      data: {}
    };
  }
};
