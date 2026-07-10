/**
 * 解密用户手机号云函数
 *
 * 前端通过 <button open-type="getPhoneNumber"> 获取 cloudID 后，
 * 将 cloudID 传给本函数，使用云开发 getOpenData 能力解密。
 *
 * 依赖：微信云开发 getOpenData 能力（自动使用当前用户 session_key 解密）
 */

const cloud = require('wx-server-sdk');
const { verifyToken } = require('./common/auth');
const { RESPONSE_CODE, COLLECTIONS, warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);

  const { cloudID, token } = event;

  // 1. Token 鉴权
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败，请重新登录', data: {} };
  }

  // 2. 参数校验
  if (!cloudID) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少 cloudID', data: {} };
  }

  try {
    // 3. 使用云开发 getOpenData 解密（自动使用当前用户的 session_key）
    const { OPENID } = cloud.getWXContext();

    const res = await cloud.getOpenData({
      list: [cloudID]
    });

    const phoneData = res.list[0];

    if (!phoneData || !phoneData.data || !phoneData.data.phoneNumber) {
      console.error('[decryptPhone] 解密结果异常:', JSON.stringify(res));
      return { code: RESPONSE_CODE.ERROR, msg: '手机号解密失败', data: {} };
    }

    const phoneNumber = phoneData.data.phoneNumber;
    const purePhoneNumber = phoneData.data.purePhoneNumber || phoneNumber;
    const countryCode = phoneData.data.countryCode || '86';

    // 4. 保存到 users 集合（幂等：更新或创建）
    const now = new Date();
    const userResult = await db.collection(COLLECTIONS.USERS)
      .where({ user_id: OPENID })
      .limit(1)
      .get();

    if (userResult.data && userResult.data.length > 0) {
      await db.collection(COLLECTIONS.USERS).doc(userResult.data[0]._id).update({
        data: {
          phoneNumber: purePhoneNumber,
          phone_country_code: countryCode,
          updated_at: now
        }
      });
    } else {
      await db.collection(COLLECTIONS.USERS).add({
        data: {
          user_id: OPENID,
          phoneNumber: purePhoneNumber,
          phone_country_code: countryCode,
          first_report_used: false,
          invite_reward_credits: 0,
          isMember: false,
          created_at: now,
          updated_at: now
        }
      });
    }

    console.log('[decryptPhone] 手机号绑定成功:', OPENID, purePhoneNumber);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '绑定成功',
      data: {
        phoneNumber: purePhoneNumber,
        countryCode: countryCode
      }
    };

  } catch (error) {
    console.error('[decryptPhone] 处理异常:', error.message, error.stack);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '服务暂时不可用，请稍后重试',
      data: {}
    };
  }
};
