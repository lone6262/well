// 购买点数包
// 创建订单，支付回调后点数到账
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, ORDER_STATUS, ORDER_TYPES, PRICES, POINTS_PACKS , warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { checkRateLimit } = require('./common/rate-limiter');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MOCK_PAY = true;

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { packType, token } = event; // packType: 'PACK_3' | 'PACK_5'

  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败', data: {} };
  }
  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (!packType || !POINTS_PACKS[packType]) {
    return { code: RESPONSE_CODE.ERROR, msg: '无效的点数包类型', data: {} };
  }

  if (!await checkRateLimit(db, openid, 'purchasePoints', 5, 60000, false)) {
    return { code: RESPONSE_CODE.ERROR, msg: '操作过于频繁', data: {} };
  }

  try {
    const pack = POINTS_PACKS[packType];

    // 检查是否有重复 pending 订单
    const existing = await db.collection(COLLECTIONS.ORDERS)
      .where({ user_id: openid, type: ORDER_TYPES.POINTS || 'points', status: ORDER_STATUS.PENDING })
      .limit(1).get();

    if (existing.data && existing.data.length > 0) {
      return { code: RESPONSE_CODE.ERROR, msg: '您有待支付的点数包订单，请先完成支付或取消', data: { orderId: existing.data[0]._id } };
    }

    const outTradeNo = 'PTS' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();

    const order = {
      user_id: openid,
      type: 'points',
      status: ORDER_STATUS.PENDING,
      amount: pack.price,
      out_trade_no: outTradeNo,
      transaction_id: '',
      description: `${pack.count}次AI报告点数包`,
      metadata: {
        pack_type: packType,
        points_count: pack.count,
        expire_days: pack.expire_days,
        mock_pay: MOCK_PAY
      },
      created_at: new Date(),
      updated_at: new Date()
    };

    const addResult = await db.collection(COLLECTIONS.ORDERS).add({ data: order });

    if (MOCK_PAY) {
      // Mock 模式：直接完成支付，点数到账
      await db.collection(COLLECTIONS.ORDERS).doc(addResult._id).update({
        data: { status: ORDER_STATUS.PAID, paid_at: new Date(), updated_at: new Date() }
      });
      await creditPoints(openid, pack.count, pack.expire_days, addResult._id);
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: MOCK_PAY ? '购买成功' : '订单创建成功',
      data: {
        orderId: addResult._id,
        outTradeNo: outTradeNo,
        amount: pack.price,
        amountDisplay: (pack.price / 100).toFixed(2),
        pointsCount: pack.count,
        mockPay: MOCK_PAY
      }
    };
  } catch (error) {
    console.error('[purchasePoints] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '购买失败，请稍后重试', data: {} };
  }
};

// 点数到账
async function creditPoints(openid, count, expireDays, orderId) {
  const expireAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);

  // 查找或创建用户点数记录
  const existing = await db.collection('user_points')
    .where({ user_id: openid }).limit(1).get();

  if (existing.data && existing.data.length > 0) {
    const record = existing.data[0];
    const newExpire = record.expire_at && record.expire_at > new Date() ? record.expire_at : expireAt;
    await db.collection('user_points').doc(record._id).update({
      data: {
        balance: _.inc(count),
        total_purchased: _.inc(count),
        expire_at: newExpire,
        updated_at: new Date()
      }
    });
  } else {
    await db.collection('user_points').add({
      data: {
        user_id: openid, balance: count, total_purchased: count,
        total_used: 0, expire_at: expireAt, created_at: new Date(), updated_at: new Date()
      }
    });
  }

  // 记录交易
  await db.collection('point_transactions').add({
    data: {
      user_id: openid, type: 'purchase', amount: count,
      order_id: orderId, balance_after: (existing.data && existing.data[0] ? existing.data[0].balance + count : count),
      created_at: new Date()
    }
  });
}
