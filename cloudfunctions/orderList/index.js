// 订单列表云函数
// 查询当前用户的订单记录，按创建时间倒序排列
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE , warmupConfig} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

/**
 * 获取用户订单列表
 *
 * @param {number} page - 页码，从1开始
 * @param {number} pageSize - 每页条数，默认10，最大50
 * @returns {object} { code, msg, data: { list, total, page, pageSize } }
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  try {
    const page = Math.max(DEFAULT_PAGE, parseInt(event.page, 10) || DEFAULT_PAGE);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(event.pageSize, 10) || DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * pageSize;

    // 查询总数
    const countResult = await db.collection(COLLECTIONS.ORDERS)
      .where({ user_id: openid })
      .count();

    const total = countResult.total;

    // 查询分页数据
    const ordersResult = await db.collection(COLLECTIONS.ORDERS)
      .where({ user_id: openid })
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    const list = (ordersResult.data || []).map(mapOrder);

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '查询成功',
      data: {
        list: list,
        total: total,
        page: page,
        pageSize: pageSize
      }
    };

  } catch (error) {
    console.error('查询订单列表失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '查询订单列表失败', data: {} };
  }
};

/**
 * 映射订单数据为前端展示格式
 */
function mapOrder(order) {
  return {
    _id: order._id,
    type: order.type,
    status: order.status,
    amount: order.amount,
    origin_amount: order.origin_amount,
    coupon_discount: order.coupon_discount,
    amountDisplay: ((order.amount || 0) / 100).toFixed(2),
    description: order.description,
    out_trade_no: order.out_trade_no,
    metadata: order.metadata || {},
    created_at: order.created_at
  };
}
