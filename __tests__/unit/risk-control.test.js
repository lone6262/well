/**
 * 风控检查模块 (checkRiskControl) 单元测试
 * TDD: RED → GREEN → REFACTOR
 * 测试风控检查逻辑（Mock 数据库和 wx-server-sdk）
 */

// ===== 测试框架 =====
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
    const msg = `${message} - 期望: ${JSON.stringify(expected)}, 实际: ${JSON.stringify(actual)}`;
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
    errors.forEach(e => console.error(`  ${e}`));
  }
  return { passed, failed, total };
}

// ===== 常量定义（从 constants.js 提取） =====
const RISK_LIMITS = {
  DAILY_REPORT_ORDERS: 20,
  DAILY_MEMBER_ORDERS: 5,
  DAILY_TOTAL_ORDERS: 30,
  MANUAL_REVIEW_THRESHOLD: 9900,
  INVITE_BURST_THRESHOLD: 10,
  INVITE_BURST_WINDOW_MS: 60 * 60 * 1000,
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

const RESPONSE_CODE = {
  SUCCESS: 0,
  ERROR: -1
};

const COLLECTIONS = {
  ORDERS: 'orders',
  INVITE_RECORDS: 'invite_records'
};

// ===== Mock 数据库工厂 =====
function createMockDb(config = {}) {
  const orders = config.orders || [];
  const inviteRecords = config.inviteRecords || [];

  return {
    collection: (name) => {
      if (name === COLLECTIONS.ORDERS) {
        return {
          where: (query) => {
            // 处理 get() 调用（支付刷量检测）
            const filteredOrders = orders.filter(order => {
              if (query.user_id && order.user_id !== query.user_id) return false;
              if (query.status && order.status !== query.status) return false;
              if (query.type && order.type !== query.type) return false;
              if (query.created_at) {
                const orderDate = new Date(order.created_at);
                const cutoffDate = query.created_at.$gte || query.created_at;
                if (orderDate < cutoffDate) return false;
              }
              return true;
            });

            return {
              count: async () => {
                // 根据查询类型返回不同的计数
                if (config.totalCount !== undefined && !query.type) {
                  return { total: config.totalCount };
                }
                if (config.reportCount !== undefined && query.type === ORDER_TYPES.REPORT) {
                  return { total: config.reportCount };
                }
                if (config.memberCount !== undefined && query.type?.$in) {
                  return { total: config.memberCount };
                }
                return { total: config.countResult ?? filteredOrders.length };
              },
              limit: (limit) => ({
                get: async () => ({ data: filteredOrders.slice(0, limit) })
              }),
              get: async () => ({ data: filteredOrders })
            };
          }
        };
      }

      if (name === COLLECTIONS.INVITE_RECORDS) {
        return {
          where: (query) => ({
            count: async () => {
              if (config.inviteCount !== undefined) {
                return { total: config.inviteCount };
              }
              return {
                total: inviteRecords.filter(record => {
                  if (query.inviter_id && record.inviter_id !== query.inviter_id) return false;
                  if (query.created_at) {
                    const recordDate = new Date(record.created_at);
                    const cutoffDate = query.created_at.$gte;
                    if (recordDate < cutoffDate) return false;
                  }
                  return true;
                }).length
              };
            }
          })
        };
      }

      return {
        where: () => ({ count: async () => ({ total: 0 }) })
      };
    },
    command: {
      gte: (date) => ({ $gte: date }),
      in: (values) => ({ $in: values })
    }
  };
}

// ===== Mock wx-server-sdk =====
function createMockCloud(openid = 'test_openid') {
  return {
    init: () => {},
    getWXContext: () => ({ OPENID: openid }),
    database: () => createMockDb(),
    DYNAMIC_CURRENT_ENV: 'mock-env'
  };
}

// ===== 被测代码（从 checkRiskControl/index.js 提取逻辑） =====

/**
 * 频率限制检查
 */
async function checkFrequency(db, userId, orderType, todayStart) {
  const baseQuery = {
    user_id: userId,
    created_at: db.command.gte(todayStart),
    status: db.command.in(['pending', 'paid'])
  };

  // 统计今日总订单数
  const totalResult = await db.collection(COLLECTIONS.ORDERS)
    .where(baseQuery)
    .count();

  if (totalResult.total >= RISK_LIMITS.DAILY_TOTAL_ORDERS) {
    return { passed: false, reason: '今日下单次数已达上限，请明天再试' };
  }

  // 按类型检查
  const isReportOrder = [ORDER_TYPES.REPORT].includes(orderType);
  const isMemberOrPointsOrder = [
    ORDER_TYPES.MEMBER,
    ORDER_TYPES.MEMBER_MONTHLY,
    ORDER_TYPES.MEMBER_YEARLY,
    ORDER_TYPES.MEMBER_FAMILY_MONTHLY,
    ORDER_TYPES.MEMBER_FAMILY_YEARLY,
    ORDER_TYPES.POINTS,
    ORDER_TYPES.BUNDLE
  ].includes(orderType);

  if (isReportOrder) {
    const reportResult = await db.collection(COLLECTIONS.ORDERS)
      .where({
        ...baseQuery,
        type: ORDER_TYPES.REPORT
      })
      .count();

    if (reportResult.total >= RISK_LIMITS.DAILY_REPORT_ORDERS) {
      return { passed: false, reason: '今日报告下单次数已达上限' };
    }
  }

  if (isMemberOrPointsOrder) {
    const memberResult = await db.collection(COLLECTIONS.ORDERS)
      .where({
        ...baseQuery,
        type: db.command.in([
          ORDER_TYPES.MEMBER,
          ORDER_TYPES.MEMBER_MONTHLY,
          ORDER_TYPES.MEMBER_YEARLY,
          ORDER_TYPES.MEMBER_FAMILY_MONTHLY,
          ORDER_TYPES.MEMBER_FAMILY_YEARLY,
          ORDER_TYPES.POINTS,
          ORDER_TYPES.BUNDLE
        ])
      })
      .count();

    if (memberResult.total >= RISK_LIMITS.DAILY_MEMBER_ORDERS) {
      return { passed: false, reason: '今日购买次数已达上限' };
    }
  }

  return { passed: true };
}

/**
 * 支付刷量检测
 */
async function checkPaymentFraud(db, userId, todayStart) {
  const paidOrders = await db.collection(COLLECTIONS.ORDERS)
    .where({
      user_id: userId,
      status: 'paid',
      created_at: db.command.gte(todayStart)
    })
    .limit(50)
    .get();

  if (!paidOrders.data || paidOrders.data.length === 0) {
    return { passed: true };
  }

  // 检测低价刷量：大量 ¥1 订单
  const lowPriceOrders = paidOrders.data.filter(o => (o.amount || 0) <= 100);
  if (lowPriceOrders.length >= 5) {
    return { passed: false, reason: 'payment_fraud_low_price' };
  }

  // 检测密集下单：5 分钟内 ≥10 笔
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentOrders = paidOrders.data.filter(o => new Date(o.created_at) >= fiveMinutesAgo);
  if (recentOrders.length >= 10) {
    return { passed: false, reason: 'payment_fraud_burst' };
  }

  return { passed: true };
}

/**
 * 邀请刷量检测
 */
async function checkInviteFraud(db, userId) {
  const oneHourAgo = new Date(Date.now() - RISK_LIMITS.INVITE_BURST_WINDOW_MS);

  const inviteResult = await db.collection(COLLECTIONS.INVITE_RECORDS)
    .where({
      inviter_id: userId,
      created_at: db.command.gte(oneHourAgo)
    })
    .count();

  if (inviteResult.total >= RISK_LIMITS.INVITE_BURST_THRESHOLD) {
    return { passed: false, reason: 'invite_fraud_burst' };
  }

  return { passed: true };
}

/**
 * 风控检查入口（简化版，用于测试）
 */
async function checkRiskControl(event, db) {
  const { userId, orderType, amount } = event;

  if (!userId || !orderType) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '参数不完整',
      data: { passed: false, reason: 'missing_params' }
    };
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. 频率限制检查
    const frequencyCheck = await checkFrequency(db, userId, orderType, todayStart);
    if (!frequencyCheck.passed) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: frequencyCheck.reason,
        data: { passed: false, reason: frequencyCheck.reason }
      };
    }

    // 2. 大额订单审核
    let needManualReview = false;
    if (amount && amount >= RISK_LIMITS.MANUAL_REVIEW_THRESHOLD) {
      needManualReview = true;
    }

    // 3. 支付刷量检测
    const fraudCheck = await checkPaymentFraud(db, userId, todayStart);
    if (!fraudCheck.passed) {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '触发风控限制，请联系客服',
        data: { passed: false, reason: fraudCheck.reason }
      };
    }

    // 4. 邀请刷量检测
    if (event.checkInviteFraud) {
      const inviteCheck = await checkInviteFraud(db, userId);
      if (!inviteCheck.passed) {
        return {
          code: RESPONSE_CODE.ERROR,
          msg: '邀请行为异常，已冻结奖励待人工审核',
          data: { passed: false, reason: inviteCheck.reason }
        };
      }
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '风控检查通过',
      data: {
        passed: true,
        need_manual_review: needManualReview
      }
    };
  } catch (error) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '风控服务暂时不可用，请稍后重试',
      data: { passed: false, reason: 'risk_control_error', error: error.message }
    };
  }
}

// ========== 测试套件 ==========

async function runTests() {
  console.log('\n=== 风控检查模块单元测试 ===\n');

  console.log('--- 1. RISK_LIMITS 阈值常量验证 ---');

  assertEqual(RISK_LIMITS.DAILY_REPORT_ORDERS, 20, 'DAILY_REPORT_ORDERS = 20');
  assertEqual(RISK_LIMITS.DAILY_MEMBER_ORDERS, 5, 'DAILY_MEMBER_ORDERS = 5');
  assertEqual(RISK_LIMITS.DAILY_TOTAL_ORDERS, 30, 'DAILY_TOTAL_ORDERS = 30');
  assertEqual(RISK_LIMITS.MANUAL_REVIEW_THRESHOLD, 9900, 'MANUAL_REVIEW_THRESHOLD = 9900');
  assertEqual(RISK_LIMITS.INVITE_BURST_THRESHOLD, 10, 'INVITE_BURST_THRESHOLD = 10');
  assertEqual(RISK_LIMITS.INVITE_BURST_WINDOW_MS, 3600000, 'INVITE_BURST_WINDOW_MS = 3600000 (1小时)');

  console.log('\n--- 2. checkFrequency 逻辑测试 ---');

  // 2.1 总订单数检查
  let db = createMockDb({ totalCount: 25 });
  let result = await checkFrequency(db, 'user1', ORDER_TYPES.REPORT, new Date());
  assert(result.passed === true, '总订单数 25 < 30 → 通过');

  db = createMockDb({ totalCount: 30 });
  result = await checkFrequency(db, 'user2', ORDER_TYPES.REPORT, new Date());
  assert(result.passed === false, '总订单数 30 >= 30 → 拒绝');
  assert(result.reason === '今日下单次数已达上限，请明天再试', '拒绝原因正确');

  db = createMockDb({ totalCount: 35 });
  result = await checkFrequency(db, 'user3', ORDER_TYPES.REPORT, new Date());
  assert(result.passed === false, '总订单数 35 > 30 → 拒绝');

  // 2.2 报告订单检查
  db = createMockDb({ totalCount: 15, reportCount: 15 }); // 总订单数通过，报告订单通过
  result = await checkFrequency(db, 'user4', ORDER_TYPES.REPORT, new Date());
  assert(result.passed === true, '报告订单 15 < 20 → 通过');

  db = createMockDb({ totalCount: 15, reportCount: 20 });
  result = await checkFrequency(db, 'user4_2', ORDER_TYPES.REPORT, new Date());
  assert(result.passed === false, '报告订单 20 >= 20 → 拒绝');

  // 2.3 会员/点数包订单检查
  db = createMockDb({ totalCount: 3, memberCount: 3 });
  result = await checkFrequency(db, 'user5', ORDER_TYPES.MEMBER, new Date());
  assert(result.passed === true, '会员订单数 3 < 5 → 通过');

  db = createMockDb({ totalCount: 5, memberCount: 5 });
  result = await checkFrequency(db, 'user6', ORDER_TYPES.POINTS, new Date());
  assert(result.passed === false, '会员订单数 5 >= 5 → 拒绝');

  // 2.4 组合套餐检查 (BUNDLE 属于会员类型，需要检查 memberCount)
  db = createMockDb({ totalCount: 10, memberCount: 3 });
  result = await checkFrequency(db, 'user7', ORDER_TYPES.BUNDLE, new Date());
  assert(result.passed === true, '组合套餐订单 3 < 5 → 通过');

  console.log('\n--- 3. checkPaymentFraud 逻辑测试 ---');

  // 3.1 无已支付订单
  db = createMockDb({ orders: [] });
  result = await checkPaymentFraud(db, 'user8', new Date());
  assert(result.passed === true, '无已支付订单 → 通过');

  // 3.2 低价订单检查
  const now = new Date();
  const lowPriceOrders = Array(4).fill(null).map((_, i) => ({
    user_id: 'user9',
    status: 'paid',
    amount: 50,
    created_at: now
  }));
  db = createMockDb({ orders: lowPriceOrders });
  result = await checkPaymentFraud(db, 'user9', new Date());
  assert(result.passed === true, '低价订单 4 笔 < 5 → 通过');

  const lowPriceOrdersExceed = Array(5).fill(null).map((_, i) => ({
    user_id: 'user10',
    status: 'paid',
    amount: 100,
    created_at: now
  }));
  db = createMockDb({ orders: lowPriceOrdersExceed });
  result = await checkPaymentFraud(db, 'user10', new Date());
  assert(result.passed === false, '低价订单 5 笔 >= 5 → 拒绝');
  assert(result.reason === 'payment_fraud_low_price', '拒绝原因为 payment_fraud_low_price');

  // 3.3 密集下单检查（5分钟内）
  const recentTime = new Date();
  const burstOrders = Array(10).fill(null).map((_, i) => ({
    user_id: 'user11',
    status: 'paid',
    amount: 1000,
    created_at: recentTime
  }));
  db = createMockDb({ orders: burstOrders });
  result = await checkPaymentFraud(db, 'user11', new Date());
  assert(result.passed === false, '5分钟内 10 笔 >= 10 → 拒绝');
  assert(result.reason === 'payment_fraud_burst', '拒绝原因为 payment_fraud_burst');

  const normalOrders = Array(9).fill(null).map((_, i) => ({
    user_id: 'user12',
    status: 'paid',
    amount: 1000,
    created_at: recentTime
  }));
  db = createMockDb({ orders: normalOrders });
  result = await checkPaymentFraud(db, 'user12', new Date());
  assert(result.passed === true, '5分钟内 9 笔 < 10 → 通过');

  console.log('\n--- 4. checkInviteFraud 逻辑测试 ---');

  // 4.1 正常邀请数量
  const recentInvites = Array(5).fill(null).map((_, i) => ({
    inviter_id: 'user13',
    created_at: new Date()
  }));
  db = createMockDb({ inviteRecords: recentInvites });
  result = await checkInviteFraud(db, 'user13');
  assert(result.passed === true, '1小时内邀请 5 人 < 10 → 通过');

  // 4.2 邀请刷量检测
  const burstInvites = Array(10).fill(null).map((_, i) => ({
    inviter_id: 'user14',
    created_at: new Date()
  }));
  db = createMockDb({ inviteRecords: burstInvites });
  result = await checkInviteFraud(db, 'user14');
  assert(result.passed === false, '1小时内邀请 10 人 >= 10 → 拒绝');
  assert(result.reason === 'invite_fraud_burst', '拒绝原因为 invite_fraud_burst');

  // 4.3 超过1小时的邀请不应计入
  const oldInvites = Array(15).fill(null).map((_, i) => ({
    inviter_id: 'user15',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2小时前
  }));
  db = createMockDb({ inviteRecords: oldInvites });
  result = await checkInviteFraud(db, 'user15');
  assert(result.passed === true, '超过1小时的邀请不计入 → 通过');

  console.log('\n--- 5. 大额订单审核标记测试 ---');

  db = createMockDb({ totalCount: 0, orders: [] });
  result = await checkRiskControl({
    userId: 'user16',
    orderType: ORDER_TYPES.MEMBER_YEARLY,
    amount: 8900
  }, db);
  assert(result.code === RESPONSE_CODE.SUCCESS, '金额 8900 < 9900 → 风控通过');
  assert(result.data.need_manual_review === false, '8900 分不需要人工审核');

  result = await checkRiskControl({
    userId: 'user17',
    orderType: ORDER_TYPES.MEMBER_YEARLY,
    amount: 9900
  }, db);
  assert(result.code === RESPONSE_CODE.SUCCESS, '金额 9900 >= 9900 → 风控通过但需要审核');
  assert(result.data.need_manual_review === true, '9900 分需要人工审核');

  result = await checkRiskControl({
    userId: 'user18',
    orderType: ORDER_TYPES.BUNDLE,
    amount: 15000
  }, db);
  assert(result.data.need_manual_review === true, '15000 分需要人工审核');

  console.log('\n--- 6. 参数校验测试 ---');

  db = createMockDb({ totalCount: 0 });
  result = await checkRiskControl({
    orderType: ORDER_TYPES.REPORT,
    amount: 100
  }, db);
  assert(result.code === RESPONSE_CODE.ERROR, '缺少 userId → 返回错误');
  assert(result.data.reason === 'missing_params', '错误原因为 missing_params');

  result = await checkRiskControl({
    userId: 'user19',
    amount: 100
  }, db);
  assert(result.code === RESPONSE_CODE.ERROR, '缺少 orderType → 返回错误');

  result = await checkRiskControl({
    userId: '',
    orderType: ''
  }, db);
  assert(result.code === RESPONSE_CODE.ERROR, '空参数 → 返回错误');

  console.log('\n--- 7. 完整流程集成测试 ---');

  // 7.1 正常流程通过
  db = createMockDb({ totalCount: 5, orders: [] });
  result = await checkRiskControl({
    userId: 'user20',
    orderType: ORDER_TYPES.REPORT,
    amount: 990
  }, db);
  assert(result.code === RESPONSE_CODE.SUCCESS, '正常报告订单 → 通过');
  assert(result.data.passed === true, 'passed = true');
  assert(result.data.need_manual_review === false, '不需要人工审核');

  // 7.2 邀请刷量检测
  db = createMockDb({
    totalCount: 5,
    orders: [],
    inviteCount: 10
  });
  result = await checkRiskControl({
    userId: 'user21',
    orderType: ORDER_TYPES.REPORT,
    amount: 990,
    checkInviteFraud: true
  }, db);
  assert(result.code === RESPONSE_CODE.ERROR, '触发邀请刷量 → 拒绝');
  assert(result.data.reason === 'invite_fraud_burst', '拒绝原因为 invite_fraud_burst');

  // 7.3 支付刷量检测
  const fraudOrders = Array(5).fill(null).map((_, i) => ({
    user_id: 'user22',
    status: 'paid',
    amount: 50,
    created_at: new Date()
  }));
  db = createMockDb({ totalCount: 5, orders: fraudOrders });
  result = await checkRiskControl({
    userId: 'user22',
    orderType: ORDER_TYPES.REPORT,
    amount: 990
  }, db);
  assert(result.code === RESPONSE_CODE.ERROR, '触发支付刷量 → 拒绝');
  assert(result.data.reason === 'payment_fraud_low_price', '拒绝原因为 payment_fraud_low_price');

  // 7.4 频率限制检测
  db = createMockDb({ totalCount: 30, orders: [] });
  result = await checkRiskControl({
    userId: 'user23',
    orderType: ORDER_TYPES.REPORT,
    amount: 990
  }, db);
  assert(result.code === RESPONSE_CODE.ERROR, '触发频率限制 → 拒绝');
  assert(result.data.reason === '今日下单次数已达上限，请明天再试', '拒绝原因为频率限制');

  console.log('\n--- 8. 边界值测试 ---');

  // 8.1 临界订单数
  db = createMockDb({ totalCount: 29, orders: [] });
  result = await checkRiskControl({
    userId: 'user24',
    orderType: ORDER_TYPES.REPORT,
    amount: 990
  }, db);
  assert(result.code === RESPONSE_CODE.SUCCESS, '订单数 29 (临界值) → 通过');

  // 8.2 临界金额
  db = createMockDb({ totalCount: 0, orders: [] });
  result = await checkRiskControl({
    userId: 'user25',
    orderType: ORDER_TYPES.MEMBER_YEARLY,
    amount: 9899
  }, db);
  assert(result.data.need_manual_review === false, '金额 9899 (临界值-1) → 不需要审核');

  result = await checkRiskControl({
    userId: 'user26',
    orderType: ORDER_TYPES.MEMBER_YEARLY,
    amount: 9900
  }, db);
  assert(result.data.need_manual_review === true, '金额 9900 (临界值) → 需要审核');

  // 8.3 临界低价订单数
  const lowPriceCritical = Array(4).fill(null).map((_, i) => ({
    user_id: 'user27',
    status: 'paid',
    amount: 100,
    created_at: new Date()
  }));
  db = createMockDb({ totalCount: 0, orders: lowPriceCritical });
  result = await checkRiskControl({
    userId: 'user27',
    orderType: ORDER_TYPES.REPORT,
    amount: 990
  }, db);
  assert(result.code === RESPONSE_CODE.SUCCESS, '低价订单 4 笔 (临界值-1) → 通过');

  // 8.4 临界密集订单数
  const burstCritical = Array(9).fill(null).map((_, i) => ({
    user_id: 'user28',
    status: 'paid',
    amount: 1000,
    created_at: new Date()
  }));
  db = createMockDb({ totalCount: 0, orders: burstCritical });
  result = await checkRiskControl({
    userId: 'user28',
    orderType: ORDER_TYPES.REPORT,
    amount: 990
  }, db);
  assert(result.code === RESPONSE_CODE.SUCCESS, '5分钟内 9 笔 (临界值-1) → 通过');

  // 8.5 临界邀请数
  db = createMockDb({
    totalCount: 0,
    orders: [],
    inviteCount: 9
  });
  result = await checkRiskControl({
    userId: 'user29',
    orderType: ORDER_TYPES.REPORT,
    amount: 990,
    checkInviteFraud: true
  }, db);
  assert(result.code === RESPONSE_CODE.SUCCESS, '1小时内邀请 9 人 (临界值-1) → 通过');

  console.log('\n--- 9. 错误处理测试 ---');

  // 9.1 数据库异常处理（模拟 where 抛异常）
  const brokenDb = {
    collection: () => ({
      where: () => { throw new Error('Database connection lost'); }
    }),
    command: {
      gte: () => ({ $gte: new Date() }),
      in: () => ({ $in: [] })
    }
  };

  result = await checkRiskControl({
    userId: 'user30',
    orderType: ORDER_TYPES.REPORT,
    amount: 990
  }, brokenDb);
  assert(result.code === RESPONSE_CODE.ERROR, '数据库异常 → 返回错误');
  assert(result.data.reason === 'risk_control_error', '错误原因为 risk_control_error');

  console.log('\n--- 10. 不同订单类型测试 ---');

  db = createMockDb({ totalCount: 10, orders: [] });

  // 10.1 个人会员订单
  result = await checkRiskControl({
    userId: 'user31',
    orderType: ORDER_TYPES.MEMBER_MONTHLY,
    amount: 1990
  }, db);
  assert(result.code === RESPONSE_CODE.SUCCESS, '个人月卡订单 → 通过');

  // 10.2 家庭会员订单
  result = await checkRiskControl({
    userId: 'user32',
    orderType: ORDER_TYPES.MEMBER_FAMILY_YEARLY,
    amount: 19900
  }, db);
  assert(result.code === RESPONSE_CODE.SUCCESS, '家庭年卡订单 → 通过');
  assert(result.data.need_manual_review === true, '家庭年卡 19900 分需要人工审核');

  // 10.3 点数包订单
  result = await checkRiskControl({
    userId: 'user33',
    orderType: ORDER_TYPES.POINTS,
    amount: 1990
  }, db);
  assert(result.code === RESPONSE_CODE.SUCCESS, '点数包订单 → 通过');

  // 10.4 组合套餐订单
  result = await checkRiskControl({
    userId: 'user34',
    orderType: ORDER_TYPES.BUNDLE,
    amount: 3990
  }, db);
  assert(result.code === RESPONSE_CODE.SUCCESS, '组合套餐订单 → 通过');

  // 汇总
  const { total, failed: failCount } = summary('risk-control.test.js');
  console.log(`\n预期: ~55 tests`);

  if (failCount > 0) {
    process.exit(1);
  }
}

// 运行测试
runTests().catch(err => {
  console.error('测试运行异常:', err);
  process.exit(1);
});
