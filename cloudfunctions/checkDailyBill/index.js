// 每日自动对账 — 拉取微信支付账单与本地 orders 集合比对
// 触发方式：定时（每日凌晨 2:00）
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  ORDER_STATUS,
  warmupConfig,
} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 每日对账流程：
 * 1. 确定对账日期（默认昨日）
 * 2. 查询本地 orders 集合中该日期的已支付/已退款订单
 * 3. 尝试拉取微信支付对账单（cloud.cloudPay.downloadBill）
 * 4. 比对金额和状态
 * 5. 记录差异到 bill_check_logs
 *
 * 注意：微信对账单拉取需要商户号配置完成后才能使用，
 * 当前 MOCK 模式下仅做本地数据自检。
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  // 对账日期：默认昨日
  const billDate = event.billDate || getYesterdayStr();

  try {
    console.log(`[checkDailyBill] 开始对账: ${billDate}`);

    // === 1. 查询本地订单 ===
    const dateRange = getDateRange(billDate);

    const localOrders = await db.collection(COLLECTIONS.ORDERS)
      .where({
        created_at: _.gte(dateRange.start).and(_.lt(dateRange.end)),
        status: _.in([ORDER_STATUS.PAID, ORDER_STATUS.REFUNDED]),
      })
      .limit(1000)
      .get();

    const orders = localOrders.data || [];
    console.log(`[checkDailyBill] 本地订单数: ${orders.length}`);

    // === 2. 本地数据自检 ===
    const diffOrders = [];
    let totalAmount = 0;

    for (const order of orders) {
      totalAmount += order.amount || 0;

      // 检查：已支付但无 transaction_id
      if (order.status === ORDER_STATUS.PAID && !order.transaction_id) {
        diffOrders.push({
          order_id: order._id,
          local_status: order.status,
          wx_status: 'missing_transaction',
          local_amount: order.amount,
          wx_amount: null,
          diff_type: 'missing_transaction_id',
        });
      }

      // 检查：金额异常（<= 0）
      if ((order.amount || 0) <= 0 && order.status === ORDER_STATUS.PAID) {
        diffOrders.push({
          order_id: order._id,
          local_status: order.status,
          wx_status: null,
          local_amount: order.amount,
          wx_amount: null,
          diff_type: 'invalid_amount',
        });
      }
    }

    // === 3. 尝试拉取微信对账单（需要真实商户号） ===
    let wxBillData = null;
    let billFetchStatus = 'skipped';

    try {
      // 微信支付对账单下载（需要真实商户号配置后才能调用）
      // const billResult = await cloud.cloudPay.downloadBill({
      //   billDate: billDate,
      //   billType: 'ALL',
      // });
      // wxBillData = parseBillResult(billResult);
      // billFetchStatus = 'success';
      billFetchStatus = 'mock_mode';
      console.log('[checkDailyBill] Mock 模式，跳过微信对账单拉取');
    } catch (billError) {
      billFetchStatus = 'failed';
      console.error('[checkDailyBill] 微信对账单拉取失败:', billError.message);
    }

    // === 4. 微信账单与本地比对（有微信数据时） ===
    if (wxBillData && wxBillData.length > 0) {
      const wxOrderMap = new Map(wxBillData.map(wx => [wx.out_trade_no, wx]));

      for (const order of orders) {
        const wxOrder = wxOrderMap.get(order.out_trade_no);

        if (!wxOrder) {
          // 本地有但微信没有
          diffOrders.push({
            order_id: order._id,
            local_status: order.status,
            wx_status: 'not_found',
            local_amount: order.amount,
            wx_amount: null,
            diff_type: 'local_only',
          });
        } else {
          // 金额不一致
          if (order.amount !== wxOrder.total_fee) {
            diffOrders.push({
              order_id: order._id,
              local_status: order.status,
              wx_status: wxOrder.trade_state,
              local_amount: order.amount,
              wx_amount: wxOrder.total_fee,
              diff_type: 'amount_mismatch',
            });
          }

          // 状态不一致（微信已回调但本地未更新）
          if (wxOrder.trade_state === 'SUCCESS' && order.status === ORDER_STATUS.PENDING) {
            // 自动修复：更新本地状态
            try {
              await db.collection(COLLECTIONS.ORDERS).doc(order._id).update({
                data: {
                  status: ORDER_STATUS.PAID,
                  transaction_id: wxOrder.transaction_id,
                  paid_at: new Date(wxOrder.time_end),
                  updated_at: new Date(),
                },
              });
              diffOrders.push({
                order_id: order._id,
                local_status: order.status,
                wx_status: wxOrder.trade_state,
                local_amount: order.amount,
                wx_amount: wxOrder.total_fee,
                diff_type: 'status_fixed',
              });
            } catch (fixError) {
              diffOrders.push({
                order_id: order._id,
                diff_type: 'status_fix_failed',
                error: fixError.message,
              });
            }
          }
        }
      }
    }

    // === 5. 写入对账日志 ===
    const billLog = {
      bill_date: billDate,
      total_order_count: orders.length,
      total_amount: totalAmount,
      diff_orders: diffOrders,
      bill_fetch_status: billFetchStatus,
      created_at: new Date(),
    };

    await db.collection(COLLECTIONS.BILL_CHECK_LOGS).add({ data: billLog });

    const result = {
      billDate,
      totalOrders: orders.length,
      totalAmount,
      diffCount: diffOrders.length,
      billFetchStatus,
    };

    console.log(`[checkDailyBill] 对账完成:`, JSON.stringify(result));

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '对账完成',
      data: result,
    };
  } catch (error) {
    console.error('[checkDailyBill] 对账失败:', error.message);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '对账失败: ' + error.message,
      data: {},
    };
  }
};

// === 辅助函数 ===

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(dateStr) {
  const parts = dateStr.split('-');
  const start = new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1,
    parseInt(parts[2]),
    0, 0, 0
  );
  const end = new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1,
    parseInt(parts[2]) + 1,
    0, 0, 0
  );
  return { start, end };
}
