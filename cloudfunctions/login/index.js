// 浜戝嚱鏁板叆鍙ｆ枃浠?const cloud = require('wx-server-sdk');

// 鏈湴甯搁噺瀹氫箟锛堥伩鍏嶈法浜戝嚱鏁板紩鐢級
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
 * 鐢ㄦ埛鐧诲綍浜戝嚱鏁? * @param {Object} event - 璇锋眰鍙傛暟
 * @param {string} event.code - 寰俊鐧诲綍code
 * @param {string} event.nickname - 鐢ㄦ埛鏄电О锛堝彲閫夛級
 * @param {string} event.avatar - 鐢ㄦ埛澶村儚锛堝彲閫夛級
 * @returns {Object} 鐧诲綍缁撴灉
 */
exports.main = async (event, context) => {
  const { code, nickname = '', avatar = '' } = event;

  try {
    // 1. 鍙傛暟鏍￠獙
    if (!code) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '鐧诲綍code涓嶈兘涓虹┖',
        data: {}
      };
    }

    // 2. 璋冪敤寰俊鐧诲綍鎺ュ彛鑾峰彇openid
    const wxResult = await cloud.openapi.auth.code2Session({
      jsCode: code
    });

    if (wxResult.errcode !== 0) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '寰俊鐧诲綍澶辫触锛? + wxResult.errmsg,
        data: {}
      };
    }

    const openid = wxResult.openid;
    const unionid = wxResult.unionid || '';

    // 3. 鏌ヨ鐢ㄦ埛鏄惁宸插瓨鍦?    const userResult = await db.collection(COLLECTIONS.USERS).where({
      user_id: openid
    }).get();

    let userId;
    let isNewUser = false;

    if (userResult.data.length === 0) {
      // 4. 鏂扮敤鎴凤紝鍒涘缓鐢ㄦ埛璁板綍
      const userData = {
        user_id: openid,
        unionid: unionid,
        nickname: nickname,
        avatar: avatar,
        member_expire: null,        // 闈炰細鍛?        created_at: new Date(),
        updated_at: new Date()
      };

      const insertResult = await db.collection(COLLECTIONS.USERS).add({
        data: userData
      });

      userId = insertResult._id;
      isNewUser = true;

    } else {
      // 5. 鑰佺敤鎴凤紝鏇存柊鐢ㄦ埛淇℃伅
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

    // 6. 鑾峰彇瀹屾暣鐨勭敤鎴蜂俊鎭?    const finalUserResult = await db.collection(COLLECTIONS.USERS).doc(userId).get();
    const userInfo = finalUserResult.data;

    // 7. 鍒ゆ柇浼氬憳鐘舵€?    const isMember = userInfo.member_expire &&
                     new Date(userInfo.member_expire) > new Date();

    // 8. 杩斿洖鐧诲綍缁撴灉
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: isNewUser ? '娉ㄥ唽鎴愬姛' : '鐧诲綍鎴愬姛',
      data: {
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
    console.error('鐧诲綍澶辫触:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '鏈嶅姟鍣ㄩ敊璇紝璇风◢鍚庨噸璇?,
      data: {
        error: error.message
      }
    };
  }
};
