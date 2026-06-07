// 回访记录列表查询云函数
// 批量关联查询 symptom_records 和 pets 获取完整信息
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  FOLLOWUP_STATUS
, warmupConfig} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
let _ = db.command;

let DEFAULT_PAGE_SIZE = 10;

/**
 * 获取回访记录列表
 *
 * @param {string} status - 可选，按状态过滤 'pending' | 'improved' | 'no_change' | 'worsened'
 * @param {number} page - 页码（默认1）
 * @param {number} pageSize - 每页数量（默认10）
 * @returns {object} { list, total, hasMore }
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  let OPENID_OBJ = cloud.getWXContext();
  let openid = OPENID_OBJ.OPENID;
  let status = event.status;
  let page = event.page || 1;
  let pageSize = event.pageSize || DEFAULT_PAGE_SIZE;

  // 1. 参数校验
  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (page < 1) { page = 1; }
  if (pageSize < 1 || pageSize > 50) { pageSize = DEFAULT_PAGE_SIZE; }

  try {
    // 2. 构建查询条件
    let query = { user_id: openid };
    if (status) {
      query.status = status;
    }

    // 3. 查询总数
    let countResult = await db.collection(COLLECTIONS.FOLLOWUP_RECORDS)
      .where(query)
      .count();
    let total = countResult.total || 0;

    if (total === 0) {
      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '获取成功',
        data: { list: [], total: 0, hasMore: false }
      };
    }

    // 4. 分页查询回访记录
    let skip = (page - 1) * pageSize;
    let followupResult = await db.collection(COLLECTIONS.FOLLOWUP_RECORDS)
      .where(query)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    let followups = followupResult.data || [];

    if (followups.length === 0) {
      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '获取成功',
        data: { list: [], total: total, hasMore: false }
      };
    }

    // 5. 批量关联查询 symptom_records 和 pets
    // 收集所有 record_id 和 pet_id
    let recordIds = [];
    let petIds = [];
    let i;
    for (i = 0; i < followups.length; i++) {
      if (followups[i].record_id) {
        recordIds.push(followups[i].record_id);
      }
      if (followups[i].pet_id) {
        petIds.push(followups[i].pet_id);
      }
    }

    // 批量查询 symptom_records
    let symptomMap = {};
    if (recordIds.length > 0) {
      // 云数据库 where in 最多支持 200 条
      let symptomResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS)
        .where({ _id: _.in(recordIds) })
        .limit(200)
        .get();
      let symptoms = symptomResult.data || [];
      for (i = 0; i < symptoms.length; i++) {
        symptomMap[symptoms[i]._id] = symptoms[i];
      }
    }

    // 批量查询 pets
    let petMap = {};
    if (petIds.length > 0) {
      let petResult = await db.collection(COLLECTIONS.PETS)
        .where({ _id: _.in(petIds) })
        .limit(200)
        .get();
      let pets = petResult.data || [];
      for (i = 0; i < pets.length; i++) {
        petMap[pets[i]._id] = pets[i];
      }
    }

    // 6. 合并数据
    let enrichedFollowups = [];
    for (i = 0; i < followups.length; i++) {
      let f = followups[i];
      let symptomRecord = f.record_id ? symptomMap[f.record_id] : null;
      let petInfo = f.pet_id ? petMap[f.pet_id] : null;

      enrichedFollowups.push({
        _id: f._id,
        record_id: f.record_id,
        pet_id: f.pet_id,
        pet_name: petInfo ? petInfo.name : (f.pet_name || ''),
        pet_type: petInfo ? petInfo.type : '',
        symptom_list: symptomRecord
          ? (symptomRecord.symptom_names || symptomRecord.symptoms || []).join('、')
          : (f.symptom_list || ''),
        status: f.status,
        visited_vet: f.visited_vet || false,
        notes: f.notes || '',
        followup_at: f.followup_at || f.created_at,
        reminded_at: f.reminded_at || null,
        completed_at: f.completed_at || null,
        created_at: f.created_at
      });
    }

    // 7. 返回结果
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        list: enrichedFollowups,
        total: total,
        hasMore: skip + followups.length < total
      }
    };

  } catch (error) {
    console.error('查询回访列表失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询失败', data: {} };
  }
};
