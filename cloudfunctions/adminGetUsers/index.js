/**
 * 获取用户列表云函数（管理端）
 * 支持分页、搜索、会员状态过滤
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  MEMBER_STATUS,
  warmupConfig
} = require('./common/constants');
const { validateAdminRequest } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 默认分页参数
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * 获取用户列表
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  console.log('[adminGetUsers] 获取用户列表请求');

  // 验证管理员权限
  const auth = validateAdminRequest(event);
  if (!auth.valid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: auth.error,
      data: {}
    };
  }

  const {
    page = DEFAULT_PAGE,
    pageSize = DEFAULT_PAGE_SIZE,
    searchKey = '',
    memberStatus = 'all' // all/member/non-member
  } = event;

  try {
    // 限制分页大小
    const actualPageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const skip = (page - 1) * actualPageSize;

    // 构建查询条件
    let whereCondition = {};

    // 搜索条件（昵称或 openid）
    if (searchKey && searchKey.trim()) {
      whereCondition = _.or({
        nickName: db.RegExp({
          regexp: searchKey.trim(),
          options: 'i'
        })
      }, {
        user_id: db.RegExp({
          regexp: searchKey.trim(),
          options: 'i'
        })
      });
    }

    // 会员状态过滤
    let memberFilter = {};
    if (memberStatus === 'member') {
      memberFilter = { isMember: true };
    } else if (memberStatus === 'non-member') {
      memberFilter = { isMember: false };
    }

    // 组合查询条件
    let finalCondition = {};
    if (Object.keys(whereCondition).length > 0) {
      finalCondition = whereCondition;
    }
    if (Object.keys(memberFilter).length > 0) {
      if (Object.keys(finalCondition).length > 0) {
        finalCondition = _.and(finalCondition, memberFilter);
      } else {
        finalCondition = memberFilter;
      }
    }

    console.log('[adminGetUsers] 查询条件:', JSON.stringify(finalCondition));

    // 查询用户列表
    const usersResult = await db.collection(COLLECTIONS.USERS)
      .where(finalCondition)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(actualPageSize)
      .get();

    // 查询总数
    const countResult = await db.collection(COLLECTIONS.USERS)
      .where(finalCondition)
      .count();

    // 为每个用户添加统计信息
    const usersWithStats = await Promise.all(
      usersResult.data.map(async (user) => {
        // 并行查询用户的统计数据
        const [
          petsCount,
          recordsCount,
          ordersCount
        ] = await Promise.all([
          // 宠物数量
          db.collection(COLLECTIONS.PETS)
            .where({ user_id: user.user_id })
            .count()
            .then(r => r.total || 0),
          // 症状记录数量
          db.collection(COLLECTIONS.SYMPTOM_RECORDS)
            .where({ user_id: user.user_id })
            .count()
            .then(r => r.total || 0),
          // 订单数量
          db.collection(COLLECTIONS.ORDERS)
            .where({ user_id: user.user_id, status: 'paid' })
            .count()
            .then(r => r.total || 0)
        ]);

        return {
          ...user,
          petsCount,
          recordsCount,
          ordersCount,
          isMember: user.isMember || false,
          memberExpire: user.memberExpire || null
        };
      })
    );

    // 计算总页数
    const total = countResult.total || 0;
    const totalPages = Math.ceil(total / actualPageSize);

    console.log(`[adminGetUsers] 返回 ${usersWithStats.length} 条用户记录，总计 ${total} 条`);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        users: usersWithStats,
        pagination: {
          page: page,
          pageSize: actualPageSize,
          total: total,
          totalPages: totalPages
        }
      }
    };

  } catch (error) {
    console.error('[adminGetUsers] 查询失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '查询失败，请稍后重试',
      data: {}
    };
  }
};
