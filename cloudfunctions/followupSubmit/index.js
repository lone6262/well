// 回访提交云函数
// 用户提交宠物恢复状态的回访结果
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  FOLLOWUP_STATUS
, warmupConfig} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

let VALID_STATUSES = [FOLLOWUP_STATUS.IMPROVED, FOLLOWUP_STATUS.NO_CHANGE, FOLLOWUP_STATUS.WORSENED];

/**
 * 提交回访结果
 *
 * @param {string} followupId - 回访记录ID
 * @param {string} status - 恢复状态 'improved' | 'no_change' | 'worsened'
 * @param {boolean} visitedVet - 是否就医
 * @param {string} notes - 补充说明
 * @returns {object} 提交结果
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  let OPENID_OBJ = cloud.getWXContext();
  let openid = OPENID_OBJ.OPENID;
  let followupId = event.followupId;
  let status = event.status;
  let visitedVet = !!event.visitedVet;
  let notes = event.notes || '';

  // 1. 参数校验
  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (!followupId) {
    return { code: RESPONSE_CODE.ERROR, msg: '回访记录ID不能为空', data: {} };
  }
  if (!status || VALID_STATUSES.indexOf(status) === -1) {
    return { code: RESPONSE_CODE.ERROR, msg: '恢复状态参数无效', data: {} };
  }

  try {
    // 2. 查询回访记录
    let followupResult;
    try {
      followupResult = await db.collection(COLLECTIONS.FOLLOWUP_RECORDS).doc(followupId).get();
    } catch (e) {
      return { code: RESPONSE_CODE.NOT_FOUND, msg: '回访记录不存在', data: {} };
    }

    let followup = followupResult.data;

    // 3. 归属验证
    if (followup.user_id !== openid) {
      return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '无权操作此记录', data: {} };
    }

    // 4. 状态验证（不能重复提交）
    if (followup.status !== FOLLOWUP_STATUS.PENDING) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '该回访已提交过',
        data: { followup_id: followupId, status: followup.status }
      };
    }

    // 5. 更新回访记录
    let now = new Date();
    await db.collection(COLLECTIONS.FOLLOWUP_RECORDS).doc(followupId).update({
      data: {
        status: status,
        visited_vet: visitedVet,
        notes: notes,
        completed_at: now,
        updated_at: now
      }
    });

    // V1.5: 回访完成自动发券
    try {
      await cloud.callFunction({
        name: 'autoIssueCoupon',
        data: { userId: openid, scene: 'followup' }
      });
    } catch (couponErr) {
      console.warn('[followupSubmit] 回访发券跳过:', couponErr.message);
    }

    // 6. 返回结果
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '提交成功',
      data: {
        followup_id: followupId,
        status: status,
        visited_vet: visitedVet
      }
    };

  } catch (error) {
    console.error('回访提交失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '提交失败，请稍后重试', data: {} };
  }
};
