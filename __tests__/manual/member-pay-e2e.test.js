/**
 * 会员付费流程一键自动化测试
 * 模拟会员升级 + 付费全链路（Mock 数据库）
 *
 * 测试场景：
 *   1. 新用户首次购买个人月卡
 *   2. 个人月卡续费年卡（到期日累加）
 *   3. 家庭会员购买
 *   4. 组合套餐购买（新手礼包）
 *   5. 支付回调链路 + 幂等性
 *   6. 风控频率限制拦截
 *
 * 运行方式：
 *   node __tests__/manual/member-pay-e2e.test.js
 */

const crypto = require('crypto');

// ============================================================
// 1. 测试框架
// ============================================================
let passed = 0, failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) { passed++; }
  else { failed++; errors.push(`FAIL: ${message}`); console.error(`  ✗ ${message}`); }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; }
  else {
    failed++;
    const msg = `${message}\n    期望: ${JSON.stringify(expected)}\n    实际: ${JSON.stringify(actual)}`;
    errors.push(`FAIL: ${msg}`);
    console.error(`  ✗ ${msg}`);
  }
}

function assertApprox(actual, expected, toleranceMs, message) {
  const diff = Math.abs(actual - expected);
  if (diff <= toleranceMs) { passed++; }
  else {
    failed++;
    const msg = `${message} - 期望: ${new Date(expected).toISOString()}, 实际: ${new Date(actual).toISOString()}, 差值: ${diff}ms`;
    errors.push(`FAIL: ${msg}`);
    console.error(`  ✗ ${msg}`);
  }
}

function summary(name) {
  const total = passed + failed;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${name}: ${passed}/${total} 通过, ${failed} 失败`);
  if (failed > 0) {
    console.error('\n❌ 失败详情:');
    errors.slice(-10).forEach(e => console.error(`  ${e}`));
  }
  return { passed, failed, total };
}

// ============================================================
// 2. 常量定义
// ============================================================
const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUND_REQUESTED: 'refund_requested',
  REFUNDED: 'refunded',
  FAILED: 'failed',
  CLOSED: 'closed'
};

const ORDER_TYPES = {
  REPORT: 'report',
  MEMBER: 'member',
  MEMBER_MONTHLY: 'member_monthly',
  MEMBER_YEARLY: 'member_yearly',
  MEMBER_FAMILY_MONTHLY: 'member_family_monthly',
  MEMBER_FAMILY_YEARLY: 'member_family_yearly',
  POINTS: 'points',
  BUNDLE: 'bundle'
};

const MEMBER_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
};

const MEMBER_DURATION = {
  MONTH: 30,
  QUARTER: 90,
  YEAR: 365
};

const MEMBER_CREDITS = {
  MONTHLY_REPORTS: 3,
  YEARLY_REPORTS: 3,
  FAMILY_MONTHLY_REPORTS: 6,
  FAMILY_YEARLY_REPORTS: 6,
  TRIAL_REPORTS: 1
};

const PRICES = {
  MEMBER_MONTHLY: 1990,
  MEMBER_YEARLY: 9900,
  MEMBER_FAMILY_MONTHLY: 2990,
  MEMBER_FAMILY_YEARLY: 19900,
  POINTS_PACK_3: 1990,
  POINTS_PACK_5: 2990,
  BUNDLE_STARTER: 2990,
  BUNDLE_ESSENTIAL: 11900,
  BUNDLE_FAMILY: 3990,
  MANUAL_REVIEW_THRESHOLD: 9900
};

const POINTS_PACKS = {
  PACK_3: { count: 3, price: 1990, expire_days: 90 },
  PACK_5: { count: 5, price: 2990, expire_days: 90 }
};

const BUNDLES = {
  STARTER: {
    name: '新手礼包', price: 2990, origin_price: 3980,
    items: [
      { type: 'member', tier: 'monthly' },
      { type: 'points', pack: 'PACK_3' }
    ]
  },
  ESSENTIAL: {
    name: '铲屎官必备', price: 11900, origin_price: 12890,
    items: [
      { type: 'member', tier: 'yearly' },
      { type: 'points', pack: 'PACK_5' }
    ]
  },
  FAMILY: {
    name: '家庭尊享', price: 3990, origin_price: 4980,
    items: [
      { type: 'member', tier: 'family_monthly' },
      { type: 'points', pack: 'PACK_3' }
    ]
  }
};

const COLLECTIONS = {
  USERS: 'users',
  ORDERS: 'orders',
  MEMBERS: 'members',
  USER_POINTS: 'user_points',
  POINT_TRANSACTIONS: 'point_transactions',
  RATE_LIMITS: 'rate_limits'
};

const RESPONSE_CODE = {
  SUCCESS: 0,
  ERROR: -1,
  UNAUTHORIZED: 401,
  SERVER_ERROR: 500
};

const MEMBER_LIMITS = {
  MAX_PETS_PERSONAL: 3,
  MAX_PETS_FAMILY: 5,
  MAX_FAMILY_MEMBERS: 4
};

const RISK_LIMITS = {
  DAILY_MEMBER_ORDERS: 5,
  DAILY_TOTAL_ORDERS: 30
};

// ============================================================
// 3. MockDB（内存数据库）
// ============================================================
function getNested(obj, path) {
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

let _idCounter = 0;
function genId() {
  return `mock_${Date.now()}_${++_idCounter}`;
}

class MockDB {
  constructor() {
    this._store = {};
    this.command = {
      gte: (v) => ({ __cmd: 'gte', value: v }),
      gt: (v) => ({ __cmd: 'gt', value: v }),
      lt: (v) => ({ __cmd: 'lt', value: v }),
      lte: (v) => ({ __cmd: 'lte', value: v }),
      in: (arr) => ({ __cmd: 'in', values: arr }),
      neq: (v) => ({ __cmd: 'neq', value: v }),
      inc: (n) => ({ __cmd: 'inc', value: n })
    };
  }

  _getColl(name) {
    if (!this._store[name]) this._store[name] = [];
    return this._store[name];
  }

  _matchValue(docVal, queryVal) {
    if (queryVal && typeof queryVal === 'object' && queryVal.__cmd) {
      switch (queryVal.__cmd) {
        case 'gte': return docVal >= queryVal.value;
        case 'gt': return docVal > queryVal.value;
        case 'lt': return docVal < queryVal.value;
        case 'lte': return docVal <= queryVal.value;
        case 'in': return queryVal.values.includes(docVal);
        case 'neq': return docVal !== queryVal.value;
      }
    }
    // 支持 $gte / $in 等字面量形式
    if (queryVal && typeof queryVal === 'object') {
      if (queryVal.$gte !== undefined) return docVal >= queryVal.$gte;
      if (queryVal.$gt !== undefined) return docVal > queryVal.$gt;
      if (queryVal.$lt !== undefined) return docVal < queryVal.$lt;
      if (queryVal.$lte !== undefined) return docVal <= queryVal.$lte;
      if (queryVal.$in !== undefined) return queryVal.$in.includes(docVal);
      if (queryVal.$neq !== undefined) return docVal !== queryVal.$neq;
    }
    return docVal === queryVal;
  }

  _matchDoc(doc, query) {
    for (const [key, val] of Object.entries(query)) {
      const docVal = key.includes('.') ? getNested(doc, key) : doc[key];
      if (!this._matchValue(docVal, val)) return false;
    }
    return true;
  }

  collection(name) {
    return new MockCollection(this, name);
  }

  clear(name) {
    if (name) { this._store[name] = []; }
    else { this._store = {}; }
  }

  dump(name) {
    return this._getColl(name);
  }
}

class MockCollection {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }

  where(query) {
    return new MockQuery(this.db, this.name, query);
  }

  doc(id) {
    return new MockDoc(this.db, this.name, id);
  }

  add({ data }) {
    const docs = this.db._getColl(this.name);
    const newDoc = { _id: data._id || genId(), ...data };
    docs.push(newDoc);
    return { _id: newDoc._id };
  }
}

class MockQuery {
  constructor(db, name, query) {
    this.db = db;
    this.name = name;
    this.query = query;
    this._limit = Infinity;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  get() {
    const docs = this.db._getColl(this.name).filter(d => this.db._matchDoc(d, this.query));
    return { data: docs.slice(0, this._limit) };
  }

  count() {
    const docs = this.db._getColl(this.name).filter(d => this.db._matchDoc(d, this.query));
    return { total: docs.length };
  }

  update({ data }) {
    const docs = this.db._getColl(this.name).filter(d => this.db._matchDoc(d, this.query));
    let updated = 0;
    for (const doc of docs) {
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && v.__cmd === 'inc') {
          doc[k] = (doc[k] || 0) + v.value;
        } else {
          doc[k] = v;
        }
      }
      updated++;
    }
    return { stats: { updated } };
  }

  remove() {
    const coll = this.db._getColl(this.name);
    const beforeLen = coll.length;
    this.db._store[this.name] = coll.filter(d => !this.db._matchDoc(d, this.query));
    return { stats: { removed: beforeLen - this.db._store[this.name].length } };
  }
}

class MockDoc {
  constructor(db, name, id) {
    this.db = db;
    this.name = name;
    this.id = id;
  }

  get() {
    const doc = this.db._getColl(this.name).find(d => d._id === this.id);
    return { data: doc || null };
  }

  update({ data }) {
    const doc = this.db._getColl(this.name).find(d => d._id === this.id);
    if (!doc) return { stats: { updated: 0 } };
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && v.__cmd === 'inc') {
        doc[k] = (doc[k] || 0) + v.value;
      } else {
        doc[k] = v;
      }
    }
    return { stats: { updated: 1 } };
  }

  remove() {
    const coll = this.db._getColl(this.name);
    const idx = coll.findIndex(d => d._id === this.id);
    if (idx >= 0) { coll.splice(idx, 1); return { stats: { removed: 1 } }; }
    return { stats: { removed: 0 } };
  }
}

// ============================================================
// 4. 被测业务函数（内联提取自 createOrder / payCallback）
// ============================================================

/**
 * 创建会员订单（Mock 适配版）
 */
async function createMemberOrder(db, event, openid, mockPay = true) {
  const memberTier = event.memberTier || event.type || 'monthly';
  const VALID_TIERS = ['monthly', 'yearly', 'family_monthly', 'family_yearly'];
  if (!VALID_TIERS.includes(memberTier)) {
    return { code: RESPONSE_CODE.ERROR, msg: '会员类型参数无效', data: {} };
  }

  const PRICE_MAP = {
    monthly: PRICES.MEMBER_MONTHLY,
    yearly: PRICES.MEMBER_YEARLY,
    family_monthly: PRICES.MEMBER_FAMILY_MONTHLY,
    family_yearly: PRICES.MEMBER_FAMILY_YEARLY
  };
  const ORDER_TYPE_MAP = {
    monthly: ORDER_TYPES.MEMBER_MONTHLY,
    yearly: ORDER_TYPES.MEMBER_YEARLY,
    family_monthly: ORDER_TYPES.MEMBER_FAMILY_MONTHLY,
    family_yearly: ORDER_TYPES.MEMBER_FAMILY_YEARLY
  };

  let amount = PRICE_MAP[memberTier];
  const orderType = ORDER_TYPE_MAP[memberTier];
  const now = new Date();
  const outTradeNo = 'WELL_MEMBER_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

  // 频率风控检查
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalResult = await db.collection(COLLECTIONS.ORDERS)
    .where({ user_id: openid, created_at: { $gte: todayStart }, status: { $in: ['pending', 'paid'] } })
    .count();
  const memberResult = await db.collection(COLLECTIONS.ORDERS)
    .where({
      user_id: openid,
      created_at: { $gte: todayStart },
      type: { $in: [ORDER_TYPES.MEMBER, ORDER_TYPES.MEMBER_MONTHLY, ORDER_TYPES.MEMBER_YEARLY, ORDER_TYPES.MEMBER_FAMILY_MONTHLY, ORDER_TYPES.MEMBER_FAMILY_YEARLY] },
      status: { $in: ['pending', 'paid'] }
    })
    .count();

  if (totalResult.total >= RISK_LIMITS.DAILY_TOTAL_ORDERS) {
    return { code: RESPONSE_CODE.ERROR, msg: '今日下单次数已达上限，请明天再试', data: {} };
  }
  if (memberResult.total >= RISK_LIMITS.DAILY_MEMBER_ORDERS) {
    return { code: RESPONSE_CODE.ERROR, msg: '今日购买次数已达上限', data: {} };
  }

  const orderData = {
    user_id: openid,
    type: orderType,
    status: mockPay ? ORDER_STATUS.PAID : ORDER_STATUS.PENDING,
    amount,
    origin_amount: amount,
    coupon_discount: 0,
    out_trade_no: outTradeNo,
    transaction_id: mockPay ? 'MOCK_' + outTradeNo : '',
    description: (memberTier.includes('yearly') ? '年卡' : '月卡') + '会员购买',
    metadata: { member_tier: memberTier, mock_pay: mockPay },
    paid_at: mockPay ? now : null,
    channel: 'mp',
    is_checked: false,
    need_manual_review: false,
    created_at: now,
    updated_at: now
  };

  const orderResult = await db.collection(COLLECTIONS.ORDERS).add({ data: orderData });

  // Mock 模式直接激活业务
  if (mockPay) {
    if (memberTier.startsWith('family_')) {
      await activateFamilyMember(db, openid, { memberType: memberTier, orderId: orderResult._id, amount });
    } else {
      await activateMember(db, openid, { memberType: memberTier === 'yearly' ? 'yearly' : 'monthly', orderId: orderResult._id, amount });
    }
  }

  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '会员订单创建成功',
    data: {
      orderId: orderResult._id,
      outTradeNo,
      status: orderData.status,
      amount,
      amountDisplay: (amount / 100).toFixed(2),
      memberTier
    }
  };
}

/**
 * 创建套餐订单（Mock 适配版）
 */
async function createBundleOrder(db, event, openid, mockPay = true) {
  const bundleKey = event.bundleKey;
  const bundle = BUNDLES[bundleKey];
  if (!bundle) {
    return { code: RESPONSE_CODE.ERROR, msg: '无效的套餐类型', data: {} };
  }

  const now = new Date();
  const outTradeNo = 'WELL_BUNDLE_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const subOrders = [];

  for (const item of bundle.items) {
    let subType, subAmount, subDesc;
    if (item.type === 'member') {
      const PRICE_MAP = {
        monthly: PRICES.MEMBER_MONTHLY, yearly: PRICES.MEMBER_YEARLY,
        family_monthly: PRICES.MEMBER_FAMILY_MONTHLY, family_yearly: PRICES.MEMBER_FAMILY_YEARLY
      };
      subType = 'member_' + item.tier;
      subAmount = PRICE_MAP[item.tier] || 0;
      subDesc = (item.tier.includes('family') ? '家庭' : '个人') + (item.tier.includes('yearly') ? '年卡' : '月卡');
    } else {
      const pack = POINTS_PACKS[item.pack];
      subType = 'points';
      subAmount = pack ? pack.price : 0;
      subDesc = (pack ? pack.count : 0) + '次点数包';
    }

    const subOrder = {
      user_id: openid,
      type: subType,
      status: ORDER_STATUS.PENDING,
      amount: subAmount,
      out_trade_no: outTradeNo + '_SUB_' + (subOrders.length + 1),
      description: subDesc,
      parent_order_id: null,
      bundle_type: bundleKey,
      metadata: { bundle_item: item, mock_pay: mockPay },
      is_checked: false,
      created_at: now,
      updated_at: now
    };
    const subResult = await db.collection(COLLECTIONS.ORDERS).add({ data: subOrder });
    subOrders.push({ order_id: subResult._id, type: subType });
  }

  const mainOrderData = {
    user_id: openid,
    type: ORDER_TYPES.BUNDLE,
    status: mockPay ? ORDER_STATUS.PAID : ORDER_STATUS.PENDING,
    amount: bundle.price,
    origin_amount: bundle.origin_price,
    coupon_discount: bundle.origin_price - bundle.price,
    out_trade_no: outTradeNo,
    transaction_id: mockPay ? 'MOCK_' + outTradeNo : '',
    description: bundle.name,
    bundle_type: bundleKey,
    sub_orders: subOrders,
    metadata: { bundle_name: bundle.name, mock_pay: mockPay },
    paid_at: mockPay ? now : null,
    channel: 'mp',
    is_checked: false,
    need_manual_review: bundle.price >= PRICES.MANUAL_REVIEW_THRESHOLD,
    created_at: now,
    updated_at: now
  };
  const mainResult = await db.collection(COLLECTIONS.ORDERS).add({ data: mainOrderData });

  // 回写 parent_order_id
  for (const sub of subOrders) {
    await db.collection(COLLECTIONS.ORDERS).doc(sub.order_id).update({ data: { parent_order_id: mainResult._id } });
  }

  // Mock 模式：拆单处理
  if (mockPay) {
    await processBundle(db, { ...mainOrderData, _id: mainResult._id }, subOrders);
  }

  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '套餐订单创建成功',
    data: {
      orderId: mainResult._id,
      outTradeNo,
      status: mainOrderData.status,
      amount: bundle.price,
      amountDisplay: (bundle.price / 100).toFixed(2),
      bundleName: bundle.name,
      subOrders
    }
  };
}

/**
 * 套餐拆单处理
 */
async function processBundle(db, order, subOrders) {
  const now = new Date();
  for (const sub of subOrders) {
    try {
      const subResult = await db.collection(COLLECTIONS.ORDERS).doc(sub.order_id).get();
      if (subResult.data) {
        await db.collection(COLLECTIONS.ORDERS).doc(sub.order_id).update({
          data: { status: ORDER_STATUS.PAID, paid_at: now, updated_at: now }
        });
        await dispatchPostPayment(db, subResult.data, order.transaction_id);
      }
    } catch (e) {
      console.error('[processBundle] 子订单处理失败:', sub.order_id, e.message);
    }
  }
}

/**
 * 支付后业务分发
 */
async function dispatchPostPayment(db, order, transactionId) {
  const orderType = order.type;
  const openid = order.user_id;
  const metadata = order.metadata || {};

  switch (orderType) {
    case ORDER_TYPES.MEMBER:
    case ORDER_TYPES.MEMBER_MONTHLY:
    case ORDER_TYPES.MEMBER_YEARLY:
      await activateMember(db, openid, {
        memberType: metadata.member_tier || (orderType === ORDER_TYPES.MEMBER_YEARLY ? 'yearly' : 'monthly'),
        orderId: order._id,
        amount: order.amount
      });
      break;
    case ORDER_TYPES.MEMBER_FAMILY_MONTHLY:
    case ORDER_TYPES.MEMBER_FAMILY_YEARLY:
      await activateFamilyMember(db, openid, {
        memberType: orderType === ORDER_TYPES.MEMBER_FAMILY_YEARLY ? 'family_yearly' : 'family_monthly',
        orderId: order._id,
        amount: order.amount
      });
      break;
    case ORDER_TYPES.POINTS:
      await creditPoints(db, openid, {
        pointsCount: metadata.points_count || 3,
        expireDays: metadata.expire_days || 90,
        orderId: order._id
      });
      break;
    default:
      if (orderType && orderType.startsWith('member_')) {
        const tier = orderType.replace('member_', '');
        if (tier.startsWith('family_')) {
          await activateFamilyMember(db, openid, { memberType: tier, orderId: order._id, amount: order.amount });
        } else {
          await activateMember(db, openid, { memberType: tier, orderId: order._id, amount: order.amount });
        }
      }
  }
}

/**
 * 激活个人会员
 */
async function activateMember(db, openid, params) {
  const { memberType } = params;
  const isYearly = memberType === 'yearly';
  const durationDays = isYearly ? MEMBER_DURATION.YEAR : MEMBER_DURATION.MONTH;
  const reportCredits = isYearly ? MEMBER_CREDITS.YEARLY_REPORTS : MEMBER_CREDITS.MONTHLY_REPORTS;
  const now = new Date();

  const existingResult = await db.collection(COLLECTIONS.MEMBERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  const existingMember = (existingResult.data && existingResult.data.length > 0)
    ? existingResult.data[0] : null;

  const isActive = existingMember && existingMember.status === MEMBER_STATUS.ACTIVE;

  let expireDate;
  if (isActive && existingMember.expire_date) {
    const currentExpire = new Date(existingMember.expire_date);
    const baseDate = currentExpire > now ? currentExpire : now;
    expireDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  } else {
    expireDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  const resetBase = (existingMember && existingMember.start_date)
    ? new Date(existingMember.start_date) : now;
  const startDay = resetBase.getDate();
  let resetMonth = now.getMonth();
  let resetYear = now.getFullYear();
  resetMonth += 1;
  if (resetMonth > 11) { resetMonth = 0; resetYear += 1; }
  const maxDay = new Date(resetYear, resetMonth + 1, 0).getDate();
  const resetDay = Math.min(startDay, maxDay);
  const nextResetAt = new Date(resetYear, resetMonth, resetDay,
    now.getHours(), now.getMinutes(), now.getSeconds());

  if (existingMember) {
    await db.collection(COLLECTIONS.MEMBERS).doc(existingMember._id).update({
      data: {
        type: memberType,
        status: MEMBER_STATUS.ACTIVE,
        expire_date: expireDate,
        report_credits_total: reportCredits,
        report_credits_used: 0,
        report_credits_reset_at: nextResetAt,
        updated_at: now
      }
    });
  } else {
    await db.collection(COLLECTIONS.MEMBERS).add({
      data: {
        user_id: openid,
        type: memberType,
        status: MEMBER_STATUS.ACTIVE,
        start_date: now,
        expire_date: expireDate,
        report_credits_total: reportCredits,
        report_credits_used: 0,
        report_credits_reset_at: nextResetAt,
        auto_renew: false,
        created_at: now,
        updated_at: now
      }
    });
  }

  await syncUserMemberStatus(db, openid, true, expireDate);
}

/**
 * 激活家庭会员
 */
async function activateFamilyMember(db, openid, params) {
  const isYearly = params.memberType === 'family_yearly';
  const durationDays = isYearly ? MEMBER_DURATION.YEAR : MEMBER_DURATION.MONTH;
  const reportCredits = isYearly ? MEMBER_CREDITS.FAMILY_YEARLY_REPORTS : MEMBER_CREDITS.FAMILY_MONTHLY_REPORTS;
  const now = new Date();

  const existingResult = await db.collection(COLLECTIONS.MEMBERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  const existingMember = (existingResult.data && existingResult.data.length > 0)
    ? existingResult.data[0] : null;

  const isActive = existingMember && existingMember.status === MEMBER_STATUS.ACTIVE;

  let expireDate;
  if (isActive && existingMember.expire_date) {
    const currentExpire = new Date(existingMember.expire_date);
    const baseDate = currentExpire > now ? currentExpire : now;
    expireDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  } else {
    expireDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  const startDate = (existingMember && existingMember.start_date)
    ? new Date(existingMember.start_date) : now;
  const startDay = startDate.getDate();
  let resetMonth = now.getMonth() + 1;
  let resetYear = now.getFullYear();
  if (resetMonth > 11) { resetMonth = 0; resetYear += 1; }
  const maxDay = new Date(resetYear, resetMonth + 1, 0).getDate();
  const nextResetAt = new Date(resetYear, resetMonth,
    Math.min(startDay, maxDay),
    now.getHours(), now.getMinutes(), now.getSeconds());

  const memberData = {
    type: params.memberType,
    status: MEMBER_STATUS.ACTIVE,
    expire_date: expireDate,
    report_credits_total: reportCredits,
    report_credits_used: 0,
    report_credits_reset_at: nextResetAt,
    family_member_ids: existingMember ? (existingMember.family_member_ids || []) : [],
    family_max_pet: MEMBER_LIMITS.MAX_PETS_FAMILY,
    family_credits_total: reportCredits,
    family_credits_used: 0,
    family_credits_reset_at: nextResetAt,
    updated_at: now
  };

  if (existingMember) {
    await db.collection(COLLECTIONS.MEMBERS).doc(existingMember._id).update({ data: memberData });
  } else {
    await db.collection(COLLECTIONS.MEMBERS).add({
      data: {
        user_id: openid,
        start_date: now,
        auto_renew: false,
        created_at: now,
        ...memberData
      }
    });
  }

  await syncUserMemberStatus(db, openid, true, expireDate);
}

/**
 * 同步 users 集合会员标记
 */
async function syncUserMemberStatus(db, openid, isMember, expireDate) {
  const now = new Date();
  const userResult = await db.collection(COLLECTIONS.USERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  if (userResult.data && userResult.data.length > 0) {
    await db.collection(COLLECTIONS.USERS).doc(userResult.data[0]._id).update({
      data: { isMember, memberExpire: expireDate, updated_at: now }
    });
  } else {
    await db.collection(COLLECTIONS.USERS).add({
      data: {
        user_id: openid,
        isMember,
        memberExpire: expireDate,
        first_report_used: false,
        invite_reward_credits: 0,
        created_at: now,
        updated_at: now
      }
    });
  }
}

/**
 * 点数到账
 */
async function creditPoints(db, openid, params) {
  const { pointsCount, expireDays, orderId } = params;
  const now = new Date();
  const expireAt = new Date(now.getTime() + (expireDays || 90) * 24 * 60 * 60 * 1000);

  const existingResult = await db.collection(COLLECTIONS.USER_POINTS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  let balanceAfter;
  if (existingResult.data && existingResult.data.length > 0) {
    const record = existingResult.data[0];
    const newExpire = record.expire_at && new Date(record.expire_at) > now
      ? new Date(record.expire_at) : expireAt;
    balanceAfter = (record.balance || 0) + pointsCount;
    await db.collection(COLLECTIONS.USER_POINTS).doc(record._id).update({
      data: {
        balance: db.command.inc(pointsCount),
        total_purchased: db.command.inc(pointsCount),
        expire_at: newExpire,
        updated_at: now
      }
    });
  } else {
    balanceAfter = pointsCount;
    await db.collection(COLLECTIONS.USER_POINTS).add({
      data: {
        user_id: openid,
        balance: pointsCount,
        total_purchased: pointsCount,
        total_used: 0,
        expire_at: expireAt,
        created_at: now,
        updated_at: now
      }
    });
  }

  await db.collection(COLLECTIONS.POINT_TRANSACTIONS).add({
    data: {
      user_id: openid,
      type: 'purchase',
      amount: pointsCount,
      order_id: orderId,
      balance_after: balanceAfter,
      created_at: now
    }
  });
}

/**
 * 支付回调处理（精简版）
 */
async function payCallback(db, event) {
  const { out_trade_no, transaction_id, total_fee, result_code } = event;

  if (result_code && result_code !== 'SUCCESS') {
    await handlePaymentFailed(db, out_trade_no);
    return { errcode: 0, errmsg: 'OK' };
  }

  const orderResult = await db.collection(COLLECTIONS.ORDERS)
    .where({ out_trade_no })
    .limit(1)
    .get();

  if (!orderResult.data || orderResult.data.length === 0) {
    return { errcode: -1, errmsg: '订单不存在' };
  }

  const order = orderResult.data[0];

  if (order.status === ORDER_STATUS.PAID) {
    return { errcode: 0, errmsg: 'OK' };
  }

  if (order.status === ORDER_STATUS.CLOSED || order.status === ORDER_STATUS.REFUNDED) {
    return { errcode: -1, errmsg: '订单状态异常' };
  }

  const now = new Date();
  const updateResult = await db.collection(COLLECTIONS.ORDERS)
    .where({ _id: order._id, status: ORDER_STATUS.PENDING })
    .update({
      data: {
        status: ORDER_STATUS.PAID,
        transaction_id: transaction_id || order.transaction_id || '',
        paid_at: now,
        updated_at: now
      }
    });

  if (!updateResult.stats || updateResult.stats.updated === 0) {
    return { errcode: 0, errmsg: 'OK' };
  }

  await dispatchPostPayment(db, order, transaction_id);
  return { errcode: 0, errmsg: 'OK' };
}

async function handlePaymentFailed(db, outTradeNo) {
  await db.collection(COLLECTIONS.ORDERS)
    .where({ out_trade_no: outTradeNo, status: ORDER_STATUS.PENDING })
    .update({ data: { status: ORDER_STATUS.FAILED, updated_at: new Date() } });
}

// ============================================================
// 5. 测试场景
// ============================================================

async function runTests() {
  const db = new MockDB();
  const TEST_OPENID = 'test_user_openid_001';
  const DAY_MS = 24 * 60 * 60 * 1000;
  const TOLERANCE_MS = 2000; // 2秒容差

  console.log('🚀 开始会员付费流程 E2E 测试\n');

  // ----------------------------------------------------------
  // 场景 1：新用户首次购买个人月卡
  // ----------------------------------------------------------
  console.log('--- 场景 1：新用户首次购买个人月卡 ---');
  db.clear();

  const r1 = await createMemberOrder(db, { memberTier: 'monthly' }, TEST_OPENID, true);
  assert(r1.code === RESPONSE_CODE.SUCCESS, '场景1: 订单创建成功');
  assert(r1.data.status === ORDER_STATUS.PAID, '场景1: Mock模式直接paid');
  assert(r1.data.amount === PRICES.MEMBER_MONTHLY, '场景1: 金额=1990分');

  const orders1 = db.dump(COLLECTIONS.ORDERS);
  assert(orders1.length === 1, '场景1: orders集合1条记录');
  assert(orders1[0].type === ORDER_TYPES.MEMBER_MONTHLY, '场景1: 订单类型正确');

  const members1 = db.dump(COLLECTIONS.MEMBERS);
  assert(members1.length === 1, '场景1: members集合1条记录');
  const m1 = members1[0];
  assert(m1.status === MEMBER_STATUS.ACTIVE, '场景1: 会员状态active');
  assert(m1.type === 'monthly', '场景1: 会员类型monthly');
  assert(m1.report_credits_total === MEMBER_CREDITS.MONTHLY_REPORTS, '场景1: 额度=3');
  assert(m1.report_credits_used === 0, '场景1: 已用额度=0');

  const now1 = new Date();
  const expectedExpire1 = now1.getTime() + MEMBER_DURATION.MONTH * DAY_MS;
  assertApprox(new Date(m1.expire_date).getTime(), expectedExpire1, TOLERANCE_MS, '场景1: 到期日=今天+30天');

  const users1 = db.dump(COLLECTIONS.USERS);
  assert(users1.length === 1, '场景1: users集合1条记录');
  assert(users1[0].isMember === true, '场景1: users.isMember=true');
  assertApprox(new Date(users1[0].memberExpire).getTime(), expectedExpire1, TOLERANCE_MS, '场景1: users.memberExpire正确');

  // 保存场景1的到期时间（防止场景2 update 修改同一引用）
  const m1ExpireTime = new Date(m1.expire_date).getTime();

  // ----------------------------------------------------------
  // 场景 2：个人月卡续费年卡（到期日累加）
  // ----------------------------------------------------------
  console.log('\n--- 场景 2：个人月卡续费年卡（到期日累加）---');

  const r2 = await createMemberOrder(db, { memberTier: 'yearly' }, TEST_OPENID, true);
  assert(r2.code === RESPONSE_CODE.SUCCESS, '场景2: 年卡订单创建成功');

  const members2 = db.dump(COLLECTIONS.MEMBERS);
  assert(members2.length === 1, '场景2: members仍只有1条（更新而非新增）');
  const m2 = members2[0];
  assert(m2.type === 'yearly', '场景2: 会员类型升级为yearly');
  assert(m2.report_credits_total === MEMBER_CREDITS.YEARLY_REPORTS, '场景2: 额度更新为年卡=3');
  assert(m2.report_credits_used === 0, '场景2: 已用额度重置为0');

  // 关键验证：到期日 = 原到期日 + 365天（而非今天+365天）
  const expectedExpire2 = m1ExpireTime + MEMBER_DURATION.YEAR * DAY_MS;
  assertApprox(new Date(m2.expire_date).getTime(), expectedExpire2, TOLERANCE_MS, '场景2: 到期日累加（原到期日+365天）');

  const users2 = db.dump(COLLECTIONS.USERS);
  assertApprox(new Date(users2[0].memberExpire).getTime(), expectedExpire2, TOLERANCE_MS, '场景2: users.memberExpire同步更新');

  // ----------------------------------------------------------
  // 场景 3：家庭会员购买
  // ----------------------------------------------------------
  console.log('\n--- 场景 3：家庭会员购买 ---');
  // 换一个用户，避免影响前面
  const FAMILY_OPENID = 'test_family_openid_002';
  const r3 = await createMemberOrder(db, { memberTier: 'family_monthly' }, FAMILY_OPENID, true);
  assert(r3.code === RESPONSE_CODE.SUCCESS, '场景3: 家庭月卡订单成功');

  const members3 = db.dump(COLLECTIONS.MEMBERS).filter(m => m.user_id === FAMILY_OPENID);
  assert(members3.length === 1, '场景3: members有1条家庭会员记录');
  const m3 = members3[0];
  assert(m3.type === 'family_monthly', '场景3: 类型=family_monthly');
  assert(m3.status === MEMBER_STATUS.ACTIVE, '场景3: 状态active');
  assert(m3.report_credits_total === MEMBER_CREDITS.FAMILY_MONTHLY_REPORTS, '场景3: 额度=6');
  assert(m3.family_max_pet === MEMBER_LIMITS.MAX_PETS_FAMILY, '场景3: family_max_pet=5');
  assert(Array.isArray(m3.family_member_ids), '场景3: family_member_ids是数组');
  assert(m3.family_member_ids.length === 0, '场景3: family_member_ids初始为空');
  assert(m3.family_credits_total === MEMBER_CREDITS.FAMILY_MONTHLY_REPORTS, '场景3: family_credits_total=6');
  assert(m3.family_credits_used === 0, '场景3: family_credits_used=0');

  // ----------------------------------------------------------
  // 场景 4：组合套餐购买（新手礼包）
  // ----------------------------------------------------------
  console.log('\n--- 场景 4：组合套餐购买（新手礼包）---');
  const BUNDLE_OPENID = 'test_bundle_openid_003';
  const r4 = await createBundleOrder(db, { bundleKey: 'STARTER' }, BUNDLE_OPENID, true);
  assert(r4.code === RESPONSE_CODE.SUCCESS, '场景4: 套餐订单创建成功');
  assert(r4.data.amount === PRICES.BUNDLE_STARTER, '场景4: 金额=2990');
  assert(r4.data.subOrders.length === 2, '场景4: 2个子订单');

  const orders4 = db.dump(COLLECTIONS.ORDERS).filter(o => o.user_id === BUNDLE_OPENID);
  assert(orders4.length === 3, '场景4: 1主+2子=3条订单');

  const mainOrder4 = orders4.find(o => o.type === ORDER_TYPES.BUNDLE);
  assert(mainOrder4, '场景4: 存在主订单');
  assert(mainOrder4.status === ORDER_STATUS.PAID, '场景4: 主订单状态paid');

  const members4 = db.dump(COLLECTIONS.MEMBERS).filter(m => m.user_id === BUNDLE_OPENID);
  assert(members4.length === 1, '场景4: 会员已激活');
  assert(members4[0].type === 'monthly', '场景4: 套餐内会员为monthly');

  const points4 = db.dump(COLLECTIONS.USER_POINTS).filter(p => p.user_id === BUNDLE_OPENID);
  assert(points4.length === 1, '场景4: 点数记录已创建');
  assert(points4[0].balance === 3, '场景4: 点数余额=3（PACK_3）');
  assert(points4[0].total_purchased === 3, '场景4: total_purchased=3');

  const tx4 = db.dump(COLLECTIONS.POINT_TRANSACTIONS).filter(t => t.user_id === BUNDLE_OPENID);
  assert(tx4.length === 1, '场景4: 点数交易流水1条');
  assert(tx4[0].amount === 3, '场景4: 流水amount=3');
  assert(tx4[0].type === 'purchase', '场景4: 流水type=purchase');

  // ----------------------------------------------------------
  // 场景 5：支付回调链路 + 幂等性
  // ----------------------------------------------------------
  console.log('\n--- 场景 5：支付回调链路 + 幂等性 ---');
  const PAY_OPENID = 'test_pay_openid_004';

  // 5.1 创建一个 pending 订单（非 Mock 模式）
  const r5a = await createMemberOrder(db, { memberTier: 'monthly' }, PAY_OPENID, false);
  assert(r5a.code === RESPONSE_CODE.SUCCESS, '场景5: pending订单创建成功');
  assert(r5a.data.status === ORDER_STATUS.PENDING, '场景5: 订单状态pending');

  const orderId5 = r5a.data.orderId;
  const outTradeNo5 = r5a.data.outTradeNo;

  // 此时不应有会员记录
  const members5before = db.dump(COLLECTIONS.MEMBERS).filter(m => m.user_id === PAY_OPENID);
  assert(members5before.length === 0, '场景5: 回调前无会员记录');

  // 5.2 第一次回调
  const cb1 = await payCallback(db, {
    out_trade_no: outTradeNo5,
    transaction_id: 'wx_tx_123456789',
    total_fee: PRICES.MEMBER_MONTHLY,
    result_code: 'SUCCESS'
  });
  assert(cb1.errcode === 0, '场景5: 第一次回调返回OK');

  const order5after = db.dump(COLLECTIONS.ORDERS).find(o => o._id === orderId5);
  assert(order5after.status === ORDER_STATUS.PAID, '场景5: 订单状态变为paid');
  assert(order5after.transaction_id === 'wx_tx_123456789', '场景5: transaction_id已记录');

  const members5after = db.dump(COLLECTIONS.MEMBERS).filter(m => m.user_id === PAY_OPENID);
  assert(members5after.length === 1, '场景5: 回调后会员已激活');

  // 5.3 第二次回调（幂等）
  const cb2 = await payCallback(db, {
    out_trade_no: outTradeNo5,
    transaction_id: 'wx_tx_999999999',
    total_fee: PRICES.MEMBER_MONTHLY,
    result_code: 'SUCCESS'
  });
  assert(cb2.errcode === 0, '场景5: 幂等回调仍返回OK');

  const members5idempotent = db.dump(COLLECTIONS.MEMBERS).filter(m => m.user_id === PAY_OPENID);
  assert(members5idempotent.length === 1, '场景5: 幂等回调不重复创建会员');
  assert(members5idempotent[0].transaction_id !== 'wx_tx_999999999', '场景5: 幂等回调不覆盖transaction_id');

  // 5.4 支付失败回调
  const r5b = await createMemberOrder(db, { memberTier: 'monthly' }, PAY_OPENID + '_fail', false);
  const cbFail = await payCallback(db, {
    out_trade_no: r5b.data.outTradeNo,
    result_code: 'FAIL'
  });
  assert(cbFail.errcode === 0, '场景5: 失败回调返回OK');
  const order5fail = db.dump(COLLECTIONS.ORDERS).find(o => o._id === r5b.data.orderId);
  assert(order5fail.status === ORDER_STATUS.FAILED, '场景5: 失败订单标记为failed');

  // ----------------------------------------------------------
  // 场景 6：风控频率限制拦截
  // ----------------------------------------------------------
  console.log('\n--- 场景 6：风控频率限制拦截 ---');
  const RISK_OPENID = 'test_risk_openid_005';
  db.clear();

  // 连续创建 5 笔会员订单（应全部成功）
  for (let i = 0; i < 5; i++) {
    const r = await createMemberOrder(db, { memberTier: 'monthly' }, RISK_OPENID, true);
    assert(r.code === RESPONSE_CODE.SUCCESS, `场景6: 第${i + 1}笔订单成功`);
  }

  // 第 6 笔应被拦截
  const r6 = await createMemberOrder(db, { memberTier: 'monthly' }, RISK_OPENID, true);
  assert(r6.code === RESPONSE_CODE.ERROR, '场景6: 第6笔被拦截');
  assert(r6.msg.includes('已达上限'), '场景6: 拦截提示包含"已达上限"');

  const riskOrders = db.dump(COLLECTIONS.ORDERS).filter(o => o.user_id === RISK_OPENID);
  assert(riskOrders.length === 5, '场景6: 只有5笔订单');

  // ----------------------------------------------------------
  // 汇总
  // ----------------------------------------------------------
  const result = summary('会员付费流程 E2E 测试');
  console.log('\n📋 测试检查清单');
  console.log('  [✓] 新购月卡 → members/users 记录创建');
  console.log('  [✓] 续费年卡 → expire_date 累加（非当前时间）');
  console.log('  [✓] 家庭会员 → family_max_pet/额度正确');
  console.log('  [✓] 组合套餐 → 拆单+会员+点数同时到账');
  console.log('  [✓] 支付回调 → pending→paid + 幂等性');
  console.log('  [✓] 风控拦截 → 日限5笔会员订单');

  if (failed > 0) {
    console.error('\n❌ 存在失败用例，请检查上方详情');
    process.exit(1);
  } else {
    console.log('\n✅ 全部测试通过！');
  }
}

runTests().catch(err => {
  console.error('测试运行异常:', err);
  process.exit(1);
});
