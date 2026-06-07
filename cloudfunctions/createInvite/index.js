// 创建邀请记录云函数
// 用户分享时调用，生成唯一邀请码
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  INVITE_STATUS,
  INVITE_CONFIG
, warmupConfig} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 创建邀请记录
 * 校验每日邀请上限，生成唯一邀请码
 *
 * @returns {object} { inviteCode, inviteId }
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  let OPENID_OBJ = cloud.getWXContext();
  let openid = OPENID_OBJ.OPENID;

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    // 1. 每日邀请上限检查
    let now = new Date();
    let todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let todayCount = await db.collection(COLLECTIONS.INVITE_RECORDS)
      .where({
        inviter_id: openid,
        created_at: db.command.gte(todayStart)
      })
      .count();

    if (todayCount.total >= INVITE_CONFIG.MAX_INVITES_PER_DAY) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '今日邀请次数已达上限',
        data: {}
      };
    }

    // 2. 生成唯一邀请码（使用密码学安全的随机数）
    const crypto = require('crypto');
    let inviteCode = crypto.randomBytes(8).toString('hex');

    // 3. 计算过期时间
    let expiresAt = new Date(now.getTime() + INVITE_CONFIG.EXPIRE_DAYS * 24 * 60 * 60 * 1000);

    // 4. 写入邀请记录
    let result = await db.collection(COLLECTIONS.INVITE_RECORDS).add({
      data: {
        inviter_id: openid,
        invitee_id: '',
        invite_code: inviteCode,
        status: INVITE_STATUS.PENDING,
        expires_at: expiresAt,
        created_at: now,
        updated_at: now
      }
    });

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '邀请创建成功',
      data: {
        inviteCode: inviteCode,
        inviteId: result._id
      }
    };

  } catch (error) {
    console.error('创建邀请失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '操作失败', data: {} };
  }
};
