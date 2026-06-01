// 蹇€熺櫥褰曚簯鍑芥暟 - 鐢ㄤ簬娴嬭瘯鍜屽垱寤虹敤鎴?const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 蹇€熺櫥褰曚簯鍑芥暟 - 鑷姩鍒涘缓鐢ㄦ埛
 */
exports.main = async (event, context) => {
  const { userInfo = {} } = event;

  try {
    // 鑾峰彇鐢ㄦ埛openid
    const { OPENID } = cloud.getWXContext();

    console.log('鐢ㄦ埛OPENID:', OPENID);
    console.log('鐢ㄦ埛淇℃伅:', userInfo);

    // 妫€鏌ョ敤鎴锋槸鍚﹀凡瀛樺湪
    const userResult = await db.collection('users').where({
      user_id: OPENID
    }).get();

    let userData;

    if (userResult.data.length === 0) {
      // 鐢ㄦ埛涓嶅瓨鍦紝鍒涘缓鏂扮敤鎴?      userData = {
        user_id: OPENID,
        nickName: userInfo.nickName || '娴嬭瘯鐢ㄦ埛',
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

      console.log('鍒涘缓鐢ㄦ埛鎴愬姛:', addResult);

      return {
        code: 0,
        msg: '鐢ㄦ埛鍒涘缓鎴愬姛',
        data: {
          openid: OPENID,
          userId: addResult._id,
          userInfo: userData
        }
      };
    } else {
      // 鐢ㄦ埛宸插瓨鍦紝鏇存柊鐧诲綍淇℃伅
      const existingUser = userResult.data[0];

      await db.collection('users').doc(existingUser._id).update({
        data: {
          lastLoginTime: new Date(),
          loginCount: existingUser.loginCount + 1 || 1,
          updateTime: new Date()
        }
      });

      console.log('鐢ㄦ埛鐧诲綍鎴愬姛:', existingUser);

      return {
        code: 0,
        msg: '鐧诲綍鎴愬姛',
        data: {
          openid: OPENID,
          userId: existingUser._id,
          userInfo: existingUser
        }
      };
    }
  } catch (error) {
    console.error('鐧诲綍澶辫触:', error);
    return {
      code: -1,
      msg: '鐧诲綍澶辫触: ' + error.message,
      data: {}
    };
  }
};

