/**
 * 获取数据统计云函数（管理端）
 * 提供用户、订单、收入、症状等多维度统计数据
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  ORDER_STATUS,
  ORDER_TYPES,
  MEMBER_STATUS,
  warmupConfig
} = require('./common/constants');
const { validateAdminRequest } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 获取日期范围
 */
function getDateRange(days) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  start.setHours(0, 0, 0, 0);
  now.setHours(23, 59, 59, 999);
  return { start, end: now };
}

/**
 * 获取今天开始时间
 */
function getTodayStart() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * 获取本月开始时间
 */
function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * 获取统计数据
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  console.log('[adminGetStats] 获取统计数据请求');

  // 验证管理员权限
  const auth = validateAdminRequest(event);
  if (!auth.valid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: auth.error,
      data: {}
    };
  }

  const { range = 'overview' } = event; // overview/today/week/month/custom
  const { startDate, endDate } = event;

  try {
    let timeRange;
    let rangeLabel;

    // 确定时间范围
    if (range === 'custom' && startDate && endDate) {
      timeRange = {
        start: new Date(startDate),
        end: new Date(endDate)
      };
      rangeLabel = '自定义';
    } else if (range === 'today') {
      timeRange = { start: getTodayStart(), end: new Date() };
      rangeLabel = '今日';
    } else if (range === 'week') {
      timeRange = getDateRange(7);
      rangeLabel = '近7天';
    } else if (range === 'month') {
      timeRange = getDateRange(30);
      rangeLabel = '近30天';
    } else {
      // overview: 返回今日和总计
      timeRange = null;
      rangeLabel = '总览';
    }

    // 并行查询各项数据
    const [
      totalUsers,
      todayUsers,
      totalOrders,
      paidOrders,
      todayOrders,
      totalRevenue,
      todayRevenue,
      totalMembers,
      activeMembers,
      totalRecords,
      totalReports
    ] = await Promise.all([
      // 总用户数
      db.collection(COLLECTIONS.USERS).count().then(r => r.total || 0),

      // 今日新增用户
      db.collection(COLLECTIONS.USERS)
        .where({ created_at: _.gte(getTodayStart()) })
        .count()
        .then(r => r.total || 0),

      // 总订单数
      db.collection(COLLECTIONS.ORDERS).count().then(r => r.total || 0),

      // 已支付订单数
      db.collection(COLLECTIONS.ORDERS)
        .where({ status: ORDER_STATUS.PAID })
        .count()
        .then(r => r.total || 0),

      // 今日订单数
      timeRange
        ? db.collection(COLLECTIONS.ORDERS)
          .where({
            created_at: _.and(_.gte(timeRange.start), _.lte(timeRange.end))
          })
          .count()
          .then(r => r.total || 0)
        : Promise.resolve(0),

      // 总收入（分）
      db.collection(COLLECTIONS.ORDERS)
        .where({ status: ORDER_STATUS.PAID })
        .field({ amount: true })
        .get()
        .then(r => r.data.reduce((sum, order) => sum + (order.amount || 0), 0)),

      // 今日收入
      timeRange
        ? db.collection(COLLECTIONS.ORDERS)
          .where({
            status: ORDER_STATUS.PAID,
            created_at: _.and(_.gte(timeRange.start), _.lte(timeRange.end))
          })
          .field({ amount: true })
          .get()
          .then(r => r.data.reduce((sum, order) => sum + (order.amount || 0), 0))
        : Promise.resolve(0),

      // 总会员数
      db.collection(COLLECTIONS.MEMBERS).count().then(r => r.total || 0),

      // 有效会员数
      db.collection(COLLECTIONS.MEMBERS)
        .where({ status: MEMBER_STATUS.ACTIVE })
        .count()
        .then(r => r.total || 0),

      // 总症状记录数
      db.collection(COLLECTIONS.SYMPTOM_RECORDS).count().then(r => r.total || 0),

      // 已生成AI报告数
      db.collection(COLLECTIONS.SYMPTOM_RECORDS)
        .where({ has_ai_report: true })
        .count()
        .then(r => r.total || 0)
    ]);

    // 如果指定了时间范围，获取该时间范围内的详细数据
    let rangeOrders = [];
    let rangeRevenue = 0;

    if (timeRange) {
      const rangeOrdersResult = await db.collection(COLLECTIONS.ORDERS)
        .where({
          created_at: _.and(_.gte(timeRange.start), _.lte(timeRange.end))
        })
        .orderBy('created_at', 'asc')
        .get();

      rangeOrders = rangeOrdersResult.data;
      rangeRevenue = rangeOrders
        .filter(o => o.status === ORDER_STATUS.PAID)
        .reduce((sum, o) => sum + (o.amount || 0), 0);
    }

    // 构建统计数据
    const stats = {
      overview: {
        users: {
          total: totalUsers,
          today: todayUsers,
          growthRate: totalUsers > 0 ? ((todayUsers / totalUsers) * 100).toFixed(2) : 0
        },
        orders: {
          total: totalOrders,
          paid: paidOrders,
          today: todayOrders || (timeRange ? rangeOrders.length : 0),
          conversionRate: totalUsers > 0 ? ((paidOrders / totalUsers) * 100).toFixed(2) : 0
        },
        revenue: {
          total: totalRevenue,
          today: todayRevenue || (timeRange ? rangeRevenue : 0),
          averageOrder: paidOrders > 0 ? Math.round(totalRevenue / paidOrders) : 0
        },
        members: {
          total: totalMembers,
          active: activeMembers,
          activeRate: totalMembers > 0 ? ((activeMembers / totalMembers) * 100).toFixed(2) : 0
        },
        records: {
          total: totalRecords,
          withReport: totalReports,
          reportRate: totalRecords > 0 ? ((totalReports / totalRecords) * 100).toFixed(2) : 0
        }
      },
      range: rangeLabel ? {
        label: rangeLabel,
        start: timeRange?.start,
        end: timeRange?.end,
        orders: {
          total: rangeOrders.length,
          paid: rangeOrders.filter(o => o.status === ORDER_STATUS.PAID).length,
          revenue: rangeRevenue,
          byType: {
            report: rangeOrders.filter(o => o.type === ORDER_TYPES.REPORT).length,
            member: rangeOrders.filter(o =>
              o.type === ORDER_TYPES.MEMBER_MONTHLY ||
              o.type === ORDER_TYPES.MEMBER_YEARLY
            ).length
          }
        }
      } : null
    };

    console.log(`[adminGetStats] 统计数据获取成功: ${rangeLabel}`);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: stats
    };

  } catch (error) {
    console.error('[adminGetStats] 查询失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '查询失败，请稍后重试',
      data: {}
    };
  }
};
