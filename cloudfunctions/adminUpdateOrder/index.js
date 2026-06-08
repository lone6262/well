/**
 * 更新订单云函数（管理端）
 * 支持更新订单状态、添加备注等
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  ORDER_STATUS,
  warmupConfig
} = require('./common/constants');
const { validateAdminRequest } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 更新订单
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  console.log('[adminUpdateOrder] 更新订单请求');

  // 验证管理员权限
  const auth = validateAdminRequest(event);
  if (!auth.valid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: auth.error,
      data: {}
    };
  }

  const { orderId, status, remark } = event;

  if (!orderId) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '订单ID不能为空',
      data: {}
    };
  }

  try {
    // 查询订单是否存在
    const orderResult = await db.collection(COLLECTIONS.ORDERS)
      .doc(orderId)
      .get();

    if (!orderResult.data) {
      return {
        code: RESPONSE_CODE.NOT_FOUND,
        msg: '订单不存在',
        data: {}
      };
    }

    const order = orderResult.data;
    const updateData = {};
    const logActions = [];

    // 更新订单状态
    if (status && status !== order.status) {
      // 验证状态值
      const validStatuses = Object.values(ORDER_STATUS);
      if (!validStatuses.includes(status)) {
        return {
          code: RESPONSE_CODE.ERROR,
          msg: '无效的订单状态',
          data: {}
        };
      }

      updateData.status = status;
      logActions.push(`状态从 ${order.status} 变更为 ${status}`);

      // 如果是退款操作，记录退款时间
      if (status === ORDER_STATUS.REFUNDED && !order.refunded_at) {
        updateData.refunded_at = new Date();
        logActions.push('记录退款时间');
      }
    }

    // 添加备注
    if (remark !== undefined) {
      updateData.remark = remark;
      logActions.push('更新备注');
    }

    // 更新时间
    updateData.updated_at = new Date();

    // 执行更新
    if (Object.keys(updateData).length > 0) {
      await db.collection(COLLECTIONS.ORDERS)
        .doc(orderId)
        .update({ data: updateData });

      console.log(`[adminUpdateOrder] 订单 ${orderId} 更新成功:`, logActions.join(', '));
    }

    // 查询更新后的订单
    const updatedOrderResult = await db.collection(COLLECTIONS.ORDERS)
      .doc(orderId)
      .get();

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '更新成功',
      data: {
        order: {
          ...updatedOrderResult.data,
          amountDisplay: (updatedOrderResult.data.amount / 100).toFixed(2)
        },
        actions: logActions
      }
    };

  } catch (error) {
    console.error('[adminUpdateOrder] 更新失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '更新失败，请稍后重试',
      data: {}
    };
  }
};
