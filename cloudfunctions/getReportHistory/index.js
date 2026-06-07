// AI报告历史列表云函数
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE , warmupConfig} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 获取用户AI报告历史
 * 查询已生成AI报告的symptom_records
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  let OPENID_OBJ = cloud.getWXContext();
  let openid = OPENID_OBJ.OPENID;
  let page = event.page || 1;
  let pageSize = Math.min(event.pageSize || 10, 50);
  let skip = (page - 1) * pageSize;

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    // 查询总数
    let countResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS)
      .where({
        user_id: openid,
        has_ai_report: true
      })
      .count();

    let total = countResult.total;

    // 分页查询
    let recordsResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS)
      .where({
        user_id: openid,
        has_ai_report: true
      })
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    let records = recordsResult.data || [];

    // 批量关联宠物信息
    if (records.length > 0) {
      let petIds = [];
      records.forEach(function(r) {
        if (r.pet_id && petIds.indexOf(r.pet_id) === -1) {
          petIds.push(r.pet_id);
        }
      });

      if (petIds.length > 0) {
        let petsResult = await db.collection(COLLECTIONS.PETS)
          .where({ _id: _.in(petIds) })
          .get();

        let petsMap = {};
        (petsResult.data || []).forEach(function(p) {
          petsMap[p._id] = p;
        });

        records = records.map(function(r) {
          let pet = petsMap[r.pet_id] || {};
          return {
            _id: r._id,
            pet_id: r.pet_id,
            pet_name: pet.name || '未知宠物',
            pet_type: pet.type || '',
            symptoms: r.symptoms || [],
            symptom_names: r.symptom_names || [],
            risk_level: r.risk_level,
            description: r.description || '',
            ai_report_id: r.ai_report_id || '',
            created_at: r.created_at
          };
        });
      }
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '查询成功',
      data: {
        records: records,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: (skip + records.length) < total
      }
    };

  } catch (error) {
    console.error('[getReportHistory] fail:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询失败', data: {} };
  }
};
