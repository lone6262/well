// 回访详情云函数
// 查询单条回访记录的完整信息，验证用户归属
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE , warmupConfig} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 获取回访详情
 *
 * @param {string} followupId - 回访记录ID
 * @returns {object} 回访详情 + 关联的自查记录和宠物信息
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  let OPENID_OBJ = cloud.getWXContext();
  let openid = OPENID_OBJ.OPENID;
  let followupId = event.followupId;

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (!followupId) {
    return { code: RESPONSE_CODE.ERROR, msg: '回访记录ID不能为空', data: {} };
  }

  try {
    // 1. 查询回访记录
    let followupResult;
    try {
      followupResult = await db.collection(COLLECTIONS.FOLLOWUP_RECORDS).doc(followupId).get();
    } catch (e) {
      return { code: RESPONSE_CODE.NOT_FOUND, msg: '回访记录不存在', data: {} };
    }

    let followup = followupResult.data;

    // 2. 归属验证
    if (followup.user_id !== openid) {
      return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '无权查看此记录', data: {} };
    }

    // 3. 关联自查记录
    let symptomRecord = null;
    if (followup.record_id) {
      try {
        let srResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS).doc(followup.record_id).get();
        symptomRecord = srResult.data;
      } catch (e) {
        // 记录可能已删除，忽略错误
      }
    }

    // 4. 关联宠物信息
    let petInfo = null;
    let petId = followup.pet_id || (symptomRecord && symptomRecord.pet_id);
    if (petId) {
      try {
        let petResult = await db.collection(COLLECTIONS.PETS).doc(petId).get();
        petInfo = petResult.data;
      } catch (e) {
        // 宠物可能已删除，忽略错误
      }
    }

    // 5. 组装返回数据
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '查询成功',
      data: {
        followup: {
          _id: followup._id,
          record_id: followup.record_id,
          pet_id: followup.pet_id,
          pet_name: followup.pet_name || (petInfo && petInfo.name) || '未知宠物',
          pet_type: (petInfo && petInfo.type) || '',
          symptom_list: followup.symptom_list || '',
          status: followup.status,
          visited_vet: followup.visited_vet || false,
          notes: followup.notes || '',
          reminded_at: followup.reminded_at,
          completed_at: followup.completed_at,
          created_at: followup.created_at,
          updated_at: followup.updated_at
        },
        symptomRecord: symptomRecord ? {
          _id: symptomRecord._id,
          symptoms: symptomRecord.symptoms || [],
          symptom_names: symptomRecord.symptom_names || [],
          risk_level: symptomRecord.risk_level,
          description: symptomRecord.description || '',
          created_at: symptomRecord.created_at
        } : null
      }
    };

  } catch (error) {
    console.error('[getFollowupDetail] fail:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询失败', data: {} };
  }
};
