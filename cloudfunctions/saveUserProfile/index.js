// 保存用户资料云函数 - 按需授权时使用
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE , warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { checkRateLimit } = require('./common/rate-limiter');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 保存用户资料云函数
 * 对应用户方案中的步骤5：按需获取用户资料
 * 只有在需要显示昵称/头像时才调用（必须用户点击触发）
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { userInfo, action, token } = event;
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  // Token 验证（写操作需验证身份）
  if (action !== 'get' && !verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败，请重新登录', data: {} };
  }

  // 速率限制（写操作故障时拒绝）
  if (action !== 'get' && !await checkRateLimit(db, openid, 'saveUserProfile', 10, 60000, false)) {
    return { code: RESPONSE_CODE.ERROR, msg: '操作过于频繁，请稍后再试', data: {} };
  }

  try {
    // 如果是获取用户信息
    if (action === 'get') {
      if (!openid) {
        return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
      }
      const userResult = await db.collection(COLLECTIONS.USERS).where({
        user_id: openid
      }).get();
      if (userResult.data.length > 0) {
        const userData = userResult.data[0];
        return {
          code: RESPONSE_CODE.SUCCESS,
          msg: '获取成功',
          data: {
            nickName: userData.nickName || '',
            avatarUrl: userData.avatarUrl || ''
          }
        };
      }
      return { code: RESPONSE_CODE.NOT_FOUND, msg: '用户不存在', data: {} };
    }

    console.log('=== 保存用户资料 ===');

    // 参数校验
    if (!openid || !userInfo) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '参数不完整',
        data: {}
      };
    }

    // 查找用户
    const userResult = await db.collection(COLLECTIONS.USERS).where({
      user_id: openid
    }).get();

    if (userResult.data.length === 0) {
      return {
        code: RESPONSE_CODE.NOT_FOUND,
        msg: '用户不存在',
        data: {}
      };
    }

    const userId = userResult.data[0]._id;

    // 更新用户资料
    // ⚠️ TODO: 敏感字段（手机号 phone、地址 address 等）上线前应使用加密存储
    //   建议使用 wx.cloud.callFunction 配合服务端 crypto 模块进行 AES 加密
    //   参考文档: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html
    const updateData = {
      nickName: userInfo.nickName,
      avatarUrl: userInfo.avatarUrl,
      updateTime: new Date()
    };

    // 可选：保存其他用户资料
    if (userInfo.gender !== undefined) {
      updateData.gender = userInfo.gender;
    }
    if (userInfo.country) {
      updateData.country = userInfo.country;
    }
    if (userInfo.province) {
      updateData.province = userInfo.province;
    }

    await db.collection(COLLECTIONS.USERS).doc(userId).update({
      data: updateData
    });

    console.log('用户资料更新成功');

    // 返回更新后的用户信息
    const updatedUser = await db.collection(COLLECTIONS.USERS).doc(userId).get();

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '用户资料保存成功',
      data: {
        userId: userId,
        userInfo: updatedUser.data
      }
    };

  } catch (error) {
    console.error('保存用户资料失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '保存失败，请稍后重试',
      data: {}
    };
  }
};