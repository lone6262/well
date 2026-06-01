// 保存用户资料云函数 - 按需授权时使用
const cloud = require('wx-server-sdk');

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
  const { openid, userInfo, action } = event;

  try {
    // 如果是获取用户信息
    if (action === 'get') {
      if (!openid) {
        return { code: -1, msg: '缺少openid', data: {} };
      }
      const userResult = await db.collection('users').where({
        user_id: openid
      }).get();
      if (userResult.data.length > 0) {
        const userData = userResult.data[0];
        return {
          code: 0,
          msg: '获取成功',
          data: {
            nickName: userData.nickName || '',
            avatarUrl: userData.avatarUrl || ''
          }
        };
      }
      return { code: -1, msg: '用户不存在', data: {} };
    }

    console.log('=== 保存用户资料 ===');
    console.log('OpenID:', openid);
    console.log('用户资料:', userInfo);

    // 参数校验
    if (!openid || !userInfo) {
      return {
        code: -1,
        msg: '参数不完整',
        data: {}
      };
    }

    // 查找用户
    const userResult = await db.collection('users').where({
      user_id: openid
    }).get();

    if (userResult.data.length === 0) {
      return {
        code: -1,
        msg: '用户不存在',
        data: {}
      };
    }

    const userId = userResult.data[0]._id;

    // 更新用户资料
    const updateData = {
      nickName: userInfo.nickName,
      avatarUrl: userInfo.avatarUrl,
      isMember: true, // 已授权个人资料
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

    await db.collection('users').doc(userId).update({
      data: updateData
    });

    console.log('用户资料更新成功');

    // 返回更新后的用户信息
    const updatedUser = await db.collection('users').doc(userId).get();

    return {
      code: 0,
      msg: '用户资料保存成功',
      data: {
        userId: userId,
        userInfo: updatedUser.data
      }
    };

  } catch (error) {
    console.error('保存用户资料失败:', error);
    return {
      code: -1,
      msg: '保存失败: ' + error.message,
      data: {}
    };
  }
};