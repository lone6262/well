// 云函数：获取用户自查记录列表
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE , warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { createLogger } = require('./common/logger');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const logger = createLogger('getRecordList');

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { page = 1, pageSize = 20, token } = event;
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  // Token 验证
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败，请重新登录', data: {} };
  }

  if (!openid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: '用户未登录',
      data: {}
    };
  }

  try {
    const skip = (page - 1) * pageSize;

    // 查询症状记录
    const recordsResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS)
      .where({
        user_id: openid
      })
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    const totalResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS)
      .where({
        user_id: openid
      })
      .count();

    // 获取所有关联的宠物ID
    const petIds = [];
    recordsResult.data.forEach(function(record) {
      if (record.pet_id && petIds.indexOf(record.pet_id) === -1) {
        petIds.push(record.pet_id);
      }
    });

    // 批量查询宠物信息
    let petMap = {};
    if (petIds.length > 0) {
      let petsResult = await db.collection(COLLECTIONS.PETS)
        .where({
          _id: db.command.in(petIds)
        })
        .get();

      petsResult.data.forEach(function(pet) {
        petMap[pet._id] = {
          name: pet.name,
          type: pet.type,
          avatar: pet.avatar || ''
        };
      });
    }

    // 组装返回数据
    let records = recordsResult.data.map(function(record) {
      let petInfo = petMap[record.pet_id] || { name: '未知宠物', type: 'cat' };
      return {
        _id: record._id,
        petId: record.pet_id,
        petName: petInfo.name,
        petType: petInfo.type,
        petAvatar: petInfo.avatar,
        symptoms: record.symptom_names || record.symptoms || [],
        riskLevel: record.risk_level || 'low',
        description: record.description || '',
        matchedRule: record.matched_rule || '',
        hasAiReport: record.has_ai_report || false,
        aiReportId: record.ai_report_id || '',
        createdAt: record.created_at,
        action: record.action || ''
      };
    });

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        records: records,
        total: totalResult.total,
        page: page,
        pageSize: pageSize,
        hasMore: (skip + pageSize) < totalResult.total
      }
    };

  } catch (error) {
    logger.error('获取记录列表失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '获取记录列表失败',
      data: {}
    };
  }
};
