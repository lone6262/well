/**
 * 管理后台 API 网关
 * 单一入口，内部转发到各个 admin 云函数或直接处理
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  warmupConfig,
} = require('./common/constants');
const { verifyAdminToken } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 允许的路由映射（转发到独立云函数）
const ROUTES = {
  adminLogin:       'adminLogin',
  adminGetUsers:    'adminGetUsers',
  adminGetOrders:   'adminGetOrders',
  adminUpdateOrder: 'adminUpdateOrder',
  adminGetArticles: 'adminGetArticles',
  adminSaveArticle: 'adminSaveArticle',
  adminDeleteArticle: 'adminDeleteArticle',
  adminGetStats:    'adminGetStats',
  adminGetConfig:   'adminGetConfig',
  adminUpdateConfig:'adminUpdateConfig',
};

// 直接处理的 action（无需独立云函数）
const DIRECT_ACTIONS = new Set([
  'getRefunds', 'processRefund',
  'getCoupons', 'getCouponDetail', 'createCoupon', 'updateCoupon', 'toggleCoupon',
  'getMembers', 'getMemberDetail', 'cancelMember',
  'getBills', 'getBillDetail',
  'getRiskStats', 'getRiskReviewOrders', 'reviewOrder',
]);

exports.main = async (event, context) => {
  await warmupConfig(db);

  // HTTP 触发器：body 是 JSON 字符串，需要解析
  let body = event;
  if (typeof event.body === 'string') {
    try { body = JSON.parse(event.body); } catch (e) { body = event; }
  }

  // 从请求 path 或 action 字段获取目标函数名
  const path = (event.path || '').replace(/^\//, '');
  const action = body.action || path || 'adminLogin';

  // 无需鉴权的公开接口
  const PUBLIC_ACTIONS = new Set(['getCoupons']);

  // 验证 adminToken（非登录请求且非公开接口）
  if (action !== 'adminLogin' && !PUBLIC_ACTIONS.has(action)) {
    if (!body.adminToken || !verifyAdminToken(body.adminToken)) {
      return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '未登录或 Token 无效', data: {} };
    }
  }

  // 转发到独立云函数
  const targetFunction = ROUTES[action];
  if (targetFunction) {
    try {
      const result = await cloud.callFunction({ name: targetFunction, data: body });
      return result.result;
    } catch (err) {
      console.error('[adminGateway] 调用失败:', targetFunction, err);
      return { code: RESPONSE_CODE.SERVER_ERROR, msg: '内部错误: ' + (err.message || 'unknown'), data: {} };
    }
  }

  // 直接处理 V1.5 新增 action
  if (DIRECT_ACTIONS.has(action)) {
    try {
      return await handleDirectAction(action, body);
    } catch (err) {
      console.error('[adminGateway] 处理失败:', action, err);
      return { code: RESPONSE_CODE.SERVER_ERROR, msg: '处理失败: ' + err.message, data: {} };
    }
  }

  return { code: 404, msg: 'Unknown action: ' + action, data: {} };
};

// ============================================
// 直接处理函数
// ============================================

async function handleDirectAction(action, body) {
  switch (action) {
    // === 退款管理 ===
    case 'getRefunds': return handleGetRefunds(body);
    case 'processRefund': return handleProcessRefund(body);

    // === 优惠券管理 ===
    case 'getCoupons': return handleGetCoupons(body);
    case 'getCouponDetail': return handleGetCouponDetail(body);
    case 'createCoupon': return handleCreateCoupon(body);
    case 'updateCoupon': return handleUpdateCoupon(body);
    case 'toggleCoupon': return handleToggleCoupon(body);

    // === 会员管理 ===
    case 'getMembers': return handleGetMembers(body);
    case 'getMemberDetail': return handleGetMemberDetail(body);
    case 'cancelMember': return handleCancelMember(body);

    // === 对账记录 ===
    case 'getBills': return handleGetBills(body);
    case 'getBillDetail': return handleGetBillDetail(body);

    // === 风控面板 ===
    case 'getRiskStats': return handleGetRiskStats(body);
    case 'getRiskReviewOrders': return handleGetRiskReviewOrders(body);
    case 'reviewOrder': return handleReviewOrder(body);

    default:
      return { code: RESPONSE_CODE.ERROR, msg: '未实现的 action', data: {} };
  }
}

// === 退款管理 ===

async function handleGetRefunds(body) {
  const { page = 1, pageSize = 20, status } = body;
  const skip = (page - 1) * pageSize;

  const query = {};
  if (status) query.status = status;

  const [countResult, dataResult] = await Promise.all([
    db.collection(COLLECTIONS.REFUND_RECORDS).where(query).count(),
    db.collection(COLLECTIONS.REFUND_RECORDS).where(query)
      .orderBy('created_at', 'desc')
      .skip(skip).limit(pageSize)
      .get(),
  ]);

  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '查询成功',
    data: {
      refunds: dataResult.data || [],
      pagination: {
        page, pageSize,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / pageSize),
      },
    },
  };
}

async function handleProcessRefund(body) {
  const { refundId, approved, rejectReason } = body;
  if (!refundId) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少 refundId', data: {} };
  }

  const refundResult = await db.collection(COLLECTIONS.REFUND_RECORDS).doc(refundId).get();
  const refund = refundResult.data;

  if (!refund || refund.status !== 'pending') {
    return { code: RESPONSE_CODE.ERROR, msg: '退款记录不存在或状态不符', data: {} };
  }

  if (approved) {
    // 批准退款 → 调用 processRefund 云函数
    try {
      const result = await cloud.callFunction({
        name: 'processRefund',
        data: {
          refundId: refundId,
          adminToken: body.adminToken,
        },
      });
      return result.result;
    } catch (err) {
      return { code: RESPONSE_CODE.SERVER_ERROR, msg: '退款处理失败: ' + err.message, data: {} };
    }
  } else {
    // 拒绝退款
    await db.collection(COLLECTIONS.REFUND_RECORDS).doc(refundId).update({
      data: {
        status: 'rejected',
        reviewer: 'admin',
        review_remark: rejectReason || '管理员拒绝',
        reviewed_at: new Date(),
      },
    });

    return { code: RESPONSE_CODE.SUCCESS, msg: '已拒绝退款', data: {} };
  }
}

// === 优惠券管理 ===

async function handleGetCoupons(body) {
  const { page = 1, pageSize = 20, isActive, scene } = body;
  const skip = (page - 1) * pageSize;

  const query = {};
  if (isActive !== undefined) query.is_active = isActive;
  if (scene) query.scene = scene;

  const [countResult, dataResult] = await Promise.all([
    db.collection(COLLECTIONS.COUPONS).where(query).count(),
    db.collection(COLLECTIONS.COUPONS).where(query)
      .orderBy('created_at', 'desc')
      .skip(skip).limit(pageSize)
      .get(),
  ]);

  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '查询成功',
    data: {
      coupons: dataResult.data || [],
      pagination: {
        page, pageSize,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / pageSize),
      },
    },
  };
}

async function handleGetCouponDetail(body) {
  const { couponId } = body;
  if (!couponId) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少 couponId', data: {} };
  }

  const result = await db.collection(COLLECTIONS.COUPONS).doc(couponId).get();
  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '查询成功',
    data: result.data,
  };
}

async function handleCreateCoupon(body) {
  const coupon = {
    name: body.name,
    type: body.type || 'report',
    discount_type: body.discount_type || 'fixed',
    discount_value: body.discount_value || 0,
    min_amount: body.min_amount || 0,
    validity_days: body.validity_days || 30,
    scene: body.scene || 'new_user',
    total_limit: body.total_limit || null,
    per_user_limit: body.per_user_limit || 1,
    total_issued: 0,
    is_active: true,
    created_at: new Date(),
  };

  const result = await db.collection(COLLECTIONS.COUPONS).add({ data: coupon });
  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '创建成功',
    data: { couponId: result._id },
  };
}

async function handleUpdateCoupon(body) {
  const { couponId } = body;
  if (!couponId) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少 couponId', data: {} };
  }

  const updates = {};
  const fields = ['name', 'type', 'discount_type', 'discount_value', 'min_amount', 'validity_days', 'scene', 'total_limit', 'per_user_limit'];
  for (const f of fields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  await db.collection(COLLECTIONS.COUPONS).doc(couponId).update({ data: updates });
  return { code: RESPONSE_CODE.SUCCESS, msg: '更新成功', data: {} };
}

async function handleToggleCoupon(body) {
  const { couponId, isActive } = body;
  if (!couponId) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少 couponId', data: {} };
  }

  await db.collection(COLLECTIONS.COUPONS).doc(couponId).update({
    data: { is_active: !!isActive },
  });

  return { code: RESPONSE_CODE.SUCCESS, msg: isActive ? '已上架' : '已下架', data: {} };
}

// === 会员管理 ===

async function handleGetMembers(body) {
  const { page = 1, pageSize = 20, memberType, status, keyword } = body;
  const skip = (page - 1) * pageSize;

  const query = {};
  if (memberType) query.type = memberType;
  if (status) query.status = status;

  const [countResult, dataResult] = await Promise.all([
    db.collection(COLLECTIONS.MEMBERS).where(query).count(),
    db.collection(COLLECTIONS.MEMBERS).where(query)
      .orderBy('created_at', 'desc')
      .skip(skip).limit(pageSize)
      .get(),
  ]);

  // 附加用户信息
  const members = dataResult.data || [];
  if (members.length > 0) {
    const userIds = members.map(m => m.user_id).filter(Boolean);
    if (userIds.length > 0) {
      const usersResult = await db.collection(COLLECTIONS.USERS)
        .where({ user_id: _.in(userIds) })
        .limit(50)
        .get();

      const userMap = {};
      (usersResult.data || []).forEach(u => { userMap[u.user_id] = u; });
      members.forEach(m => { m.userInfo = userMap[m.user_id] || null; });
    }
  }

  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '查询成功',
    data: {
      members,
      pagination: {
        page, pageSize,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / pageSize),
      },
    },
  };
}

async function handleGetMemberDetail(body) {
  const { memberId } = body;
  if (!memberId) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少 memberId', data: {} };
  }

  const result = await db.collection(COLLECTIONS.MEMBERS).doc(memberId).get();
  const member = result.data;

  // 附加续费记录
  if (member && member.user_id) {
    const renewLogs = await db.collection(COLLECTIONS.MEMBER_RENEW_LOG)
      .where({ user_id: member.user_id })
      .orderBy('created_at', 'desc')
      .limit(20)
      .get();
    member.renewLogs = renewLogs.data || [];
  }

  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '查询成功',
    data: member,
  };
}

async function handleCancelMember(body) {
  const { memberId } = body;
  if (!memberId) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少 memberId', data: {} };
  }

  await db.collection(COLLECTIONS.MEMBERS).doc(memberId).update({
    data: {
      status: 'cancelled',
      auto_renew: false,
      updated_at: new Date(),
    },
  });

  return { code: RESPONSE_CODE.SUCCESS, msg: '会员已取消', data: {} };
}

// === 对账记录 ===

async function handleGetBills(body) {
  const { page = 1, pageSize = 20, billDate } = body;
  const skip = (page - 1) * pageSize;

  const query = {};
  if (billDate) query.bill_date = billDate;

  const [countResult, dataResult] = await Promise.all([
    db.collection(COLLECTIONS.BILL_CHECK_LOGS).where(query).count(),
    db.collection(COLLECTIONS.BILL_CHECK_LOGS).where(query)
      .orderBy('created_at', 'desc')
      .skip(skip).limit(pageSize)
      .get(),
  ]);

  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '查询成功',
    data: {
      bills: dataResult.data || [],
      pagination: {
        page, pageSize,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / pageSize),
      },
    },
  };
}

async function handleGetBillDetail(body) {
  const { billId } = body;
  if (!billId) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少 billId', data: {} };
  }

  const result = await db.collection(COLLECTIONS.BILL_CHECK_LOGS).doc(billId).get();
  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '查询成功',
    data: result.data,
  };
}

// === 风控面板 ===

async function handleGetRiskStats() {
  // 待审核大额订单数
  const reviewCount = await db.collection(COLLECTIONS.ORDERS)
    .where({ need_manual_review: true, is_reviewed: _.neq(true) })
    .count();

  // 风控告警数（简化：近 7 天被风控拦截的记录）
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const alertCount = await db.collection(COLLECTIONS.ANALYTICS_EVENTS)
    .where({
      event_name: 'pay_fail',
      properties: { reason: 'risk_control' },
      created_at: _.gte(sevenDaysAgo),
    })
    .count();

  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '查询成功',
    data: {
      alertCount: alertCount.total,
      banCount: 0, // 封禁功能待实现
      reviewCount: reviewCount.total,
    },
  };
}

async function handleGetRiskReviewOrders() {
  const result = await db.collection(COLLECTIONS.ORDERS)
    .where({
      need_manual_review: true,
      is_reviewed: _.neq(true),
    })
    .orderBy('created_at', 'desc')
    .limit(50)
    .get();

  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '查询成功',
    data: { orders: result.data || [] },
  };
}

async function handleReviewOrder(body) {
  const { orderId, approved, reason } = body;
  if (!orderId) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少 orderId', data: {} };
  }

  if (approved) {
    // 放行：标记已审核
    await db.collection(COLLECTIONS.ORDERS).doc(orderId).update({
      data: {
        is_reviewed: true,
        review_result: 'approved',
        reviewed_at: new Date(),
      },
    });
    return { code: RESPONSE_CODE.SUCCESS, msg: '订单已放行', data: {} };
  } else {
    // 冻结：标记并关闭订单
    await db.collection(COLLECTIONS.ORDERS).doc(orderId).update({
      data: {
        is_reviewed: true,
        review_result: 'blocked',
        review_reason: reason || '管理员冻结',
        reviewed_at: new Date(),
        status: 'closed',
      },
    });
    return { code: RESPONSE_CODE.SUCCESS, msg: '订单已冻结', data: {} };
  }
}
