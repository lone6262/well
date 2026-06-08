/**
 * 获取订单列表云函数（管理端）
 * 支持分页、状态过滤、时间范围查询
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  ORDER_STATUS,
  ORDER_TYPES,
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
 * 获取订单列表
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  console.log('[adminGetOrders] 获取订单列表请求');

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
    status = 'all', // all/pending/paid/refunded/failed/closed
    type = 'all', // all/report/member
    startDate = '',
    endDate = ''
  } = event;

  try {
    // 限制分页大小
    const actualPageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const skip = (page - 1) * actualPageSize;

    // 构建查询条件
    let whereCondition = {};

    // 订单状态过滤
    if (status && status !== 'all') {
      whereCondition.status = status;
    }

    // 订单类型过滤
    if (type && type !== 'all') {
      if (type === 'member') {
        whereCondition.type = _.in([ORDER_TYPES.MEMBER_MONTHLY, ORDER_TYPES.MEMBER_YEARLY]);
      } else {
        whereCondition.type = type;
      }
    }

    // 时间范围过滤
    if (startDate || endDate) {
      const timeCondition = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        timeCondition.created_at = _.gte(start);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (timeCondition.created_at) {
          timeCondition.created_at = _.and(
            timeCondition.created_at,
            _.lte(end)
          );
        } else {
          timeCondition.created_at = _.lte(end);
        }
      }
      Object.assign(whereCondition, timeCondition);
    }

    console.log('[adminGetOrders] 查询条件:', JSON.stringify(whereCondition));

    // 查询订单列表
    const ordersResult = await db.collection(COLLECTIONS.ORDERS)
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(actualPageSize)
      .get();

    // 查询总数
    const countResult = await db.collection(COLLECTIONS.ORDERS)
      .where(whereCondition)
      .count();

    // 获取关联用户信息（批量查询）
    const uniqueUserIds = [...new Set(ordersResult.data.map(o => o.user_id))];
    let userMap = {};
    if (uniqueUserIds.length > 0) {
      const usersResult = await db.collection(COLLECTIONS.USERS)
        .where({ user_id: _.in(uniqueUserIds) })
        .field({ user_id: true, nickName: true, avatarUrl: true })
        .get();

      userMap = {};
      for (const user of usersResult.data) {
        userMap[user.user_id] = user;
      }
    }

    // 组装订单数据（包含用户信息）
    const ordersWithUserInfo = ordersResult.data.map(order => ({
      ...order,
      userInfo: userMap[order.user_id] || null,
      amountDisplay: (order.amount / 100).toFixed(2)
    }));

    // 计算总页数
    const total = countResult.total || 0;
    const totalPages = Math.ceil(total / actualPageSize);

    console.log(`[adminGetOrders] 返回 ${ordersWithUserInfo.length} 条订单记录，总计 ${total} 条`);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        orders: ordersWithUserInfo,
        pagination: {
          page: page,
          pageSize: actualPageSize,
          total: total,
          totalPages: totalPages
        }
      }
    };

  } catch (error) {
    console.error('[adminGetOrders] 查询失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '查询失败，请稍后重试',
      data: {}
    };
  }
};
