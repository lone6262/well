/**
 * getPetDiary — 查询用户宠物日记列表
 *
 * - onlyToday=true：只返回今天的日记（首页陪伴卡用，过滤非今天避免串日）
 * - 关联宠物名（pet_name）
 * - 非会员仅返回最近 7 天
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, warmupConfig } = require('./common/constants');
const { cnDateStr } = require('./common/date-cn');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const { page = 1, pageSize = 10, onlyToday = false } = event;

  if (!OPENID) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  // 会员判定
  const memberRes = await db
    .collection(COLLECTIONS.MEMBERS)
    .where({ user_id: OPENID, status: 'active' })
    .limit(1)
    .get();
  const isMember = memberRes.data && memberRes.data.length > 0;

  // 合并成单个 where（避免链式 where 覆盖语义歧义）
  const where = { user_id: OPENID };
  if (!isMember) {
    where.created_at = _.gte(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  }

  const skip = (page - 1) * pageSize;
  const total = (await db.collection(COLLECTIONS.PET_MOMENTS).where(where).count()).total;
  const res = await db
    .collection(COLLECTIONS.PET_MOMENTS)
    .where(where)
    .orderBy('date', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  // 关联宠物名
  const petIds = [];
  const seen = {};
  res.data.forEach(function (d) {
    if (d.pet_id && !seen[d.pet_id]) {
      seen[d.pet_id] = 1;
      petIds.push(d.pet_id);
    }
  });
  const petsMap = {};
  if (petIds.length) {
    const pets = await db
      .collection(COLLECTIONS.PETS)
      .where({ _id: _.in(petIds) })
      .field({ name: true })
      .get();
    pets.data.forEach(function (p) {
      petsMap[p._id] = p.name;
    });
  }

  let diaries = res.data.map(function (d) {
    return {
      _id: d._id,
      date: d.date,
      content: d.content,
      mood: d.mood,
      is_first: d.is_first,
      pet_name: petsMap[d.pet_id] || '毛孩子',
      created_at: d.created_at
    };
  });

  // onlyToday：首页陪伴卡只接受今天的日记，否则返回空让前端不展示卡
  if (onlyToday) {
    const today = cnDateStr();
    diaries = diaries.filter(function (d) {
      return d.date === today;
    });
  }

  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '获取成功',
    data: { diaries: diaries, total: total, page: page, pageSize: pageSize, hasMore: skip + pageSize < total, isMember: isMember }
  };
};
