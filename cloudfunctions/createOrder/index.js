// 创建订单云函数 - 模拟支付模式
// ⚠️ TODO: 上线前必须完成以下安全措施：
//   1. 将 MOCK_PAY 改为 false
//   2. 实现 payCallback 中的微信支付签名验证（验证 notify 参数签名）
//   3. 在 payCallback 中校验订单金额与实际支付金额一致
//   4. 在 payCallback 中实现幂等性检查（避免重复处理）
//   5. 配置微信支付商户号、密钥到环境变量
// 参考文档: https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pages/index.shtml
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  ORDER_STATUS,
  ORDER_TYPES,
  PRICES,
  PAYMENT_TIMEOUT,
  MEMBER_CREDITS,
  MEMBER_STATUS
, warmupConfig} = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { checkRateLimit } = require('./common/rate-limiter');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MOCK_PAY = true; // 模拟支付模式，商户号到位后改为 false

/**
 * 创建报告订单
 * 模拟支付模式下直接标记为已支付，真实支付模式下返回支付参数
 *
 * @param {string} recordId - 自查记录ID
 * @returns {object} 订单信息
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const { recordId, token } = event;

  // Token 验证（财务操作需验证身份）
  if (!verifyToken(token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败，请重新登录', data: {} };
  }

  // 速率限制（写操作故障时拒绝）
  if (!await checkRateLimit(db, openid, 'createOrder', 5, 60000, false)) {
    return { code: RESPONSE_CODE.ERROR, msg: '操作过于频繁，请稍后再试', data: {} };
  }

  // 1. 参数校验
  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (!recordId) {
    return { code: RESPONSE_CODE.ERROR, msg: '记录ID不能为空', data: {} };
  }

  try {
    // 2. 查询自查记录，验证归属
    const recordResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS).doc(recordId).get();
    const record = recordResult.data;

    if (!record || record.user_id !== openid) {
      return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '无权操作此记录', data: {} };
    }

    // 3. 检查是否已生成报告（已有报告时返回成功，让前端直接查看）
    if (record.has_ai_report && record.ai_report_id) {
      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '该记录已有AI报告',
        data: {
          orderId: 'existing',
          existingReportId: record.ai_report_id,
          status: ORDER_STATUS.PAID,
          quotaSource: 'existing'
        }
      };
    }

    // 4. 查询报告额度
    const quotaInfo = await resolveQuota(openid);

    // 5. 检查是否有未支付的重复订单
    const existingOrder = await db.collection(COLLECTIONS.ORDERS)
      .where({
        user_id: openid,
        type: ORDER_TYPES.REPORT,
        'metadata.record_id': recordId,
        status: db.command.in([ORDER_STATUS.PENDING, ORDER_STATUS.PAID])
      })
      .limit(1)
      .get();

    if (existingOrder.data && existingOrder.data.length > 0) {
      const dup = existingOrder.data[0];
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '该记录已有进行中的订单',
        data: {
          orderId: dup._id,
          outTradeNo: dup.out_trade_no,
          status: dup.status
        }
      };
    }

    // 6. 生成订单号
    const outTradeNo = 'WELL_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const now = new Date();

    // 7. 先扣减额度（原子性条件更新，防止并发重复扣减）
    const deductOk = await deductQuota(openid, quotaInfo);
    if (!deductOk) {
      return { code: RESPONSE_CODE.ERROR, msg: '额度扣减失败，请重试', data: {} };
    }

    // 8. 创建订单（包裹在 try-catch 中，失败时回滚额度）
    let orderId;
    try {
      const orderData = {
        user_id: openid,
        type: ORDER_TYPES.REPORT,
        status: ORDER_STATUS.PAID,
        amount: quotaInfo.price,
        out_trade_no: outTradeNo,
        transaction_id: MOCK_PAY ? 'MOCK_' + outTradeNo : '',
        description: buildDescription(quotaInfo),
        metadata: {
          record_id: recordId,
          pet_id: record.pet_id,
          quota_source: quotaInfo.quota_source,
          is_first_report: quotaInfo.quota_source === 'first_report',
          mock_pay: MOCK_PAY
        },
        paid_at: now,
        created_at: now,
        updated_at: now
      };

      const orderResult = await db.collection(COLLECTIONS.ORDERS).add({ data: orderData });
      orderId = orderResult._id;
    } catch (orderCreateError) {
      // 订单创建失败，回滚额度
      console.error('[createOrder] 订单创建失败，回滚额度:', orderCreateError.message);
      await rollbackQuota(openid, quotaInfo);
      return { code: RESPONSE_CODE.SERVER_ERROR, msg: '订单创建失败，额度已回退', data: {} };
    }

    // 9. 二次去重检查：防止并发请求创建了重复订单
    const dupCheck = await db.collection(COLLECTIONS.ORDERS)
      .where({
        user_id: openid,
        type: ORDER_TYPES.REPORT,
        'metadata.record_id': recordId,
        status: db.command.in([ORDER_STATUS.PENDING, ORDER_STATUS.PAID]),
        _id: db.command.neq(orderId)
      })
      .limit(1)
      .get();

    if (dupCheck.data && dupCheck.data.length > 0) {
      // 发现并发重复订单，回滚额度并删除新创建的订单
      await rollbackQuota(openid, quotaInfo);
      await db.collection(COLLECTIONS.ORDERS).doc(orderId).remove();
      const dup = dupCheck.data[0];
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '该记录已有进行中的订单',
        data: { orderId: dup._id, outTradeNo: dup.out_trade_no, status: dup.status }
      };
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '订单创建成功',
      data: {
        orderId: orderId,
        outTradeNo: outTradeNo,
        status: ORDER_STATUS.PAID,
        amount: quotaInfo.price,
        amountDisplay: (quotaInfo.price / 100).toFixed(2),
        quotaSource: quotaInfo.quota_source
      }
    };

  } catch (error) {
    console.error('创建订单失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '创建订单失败', data: {} };
  }
};

/**
 * 解析用户可用的报告额度
 * 优先级: 首份优惠 > 邀请奖励 > 会员额度 > 付费
 * 如果用户记录不存在，自动创建一条并标记首份已使用
 */
/**
 * 计算下一个额度重置日期（按起始日对齐）
 */
function calcNextReset(startDate, currentReset) {
  var startDay = startDate.getDate();
  var year = currentReset.getFullYear();
  var month = currentReset.getMonth();
  month += 1;
  if (month > 11) { month = 0; year += 1; }
  var maxDay = new Date(year, month + 1, 0).getDate();
  var targetDay = Math.min(startDay, maxDay);
  return new Date(year, month, targetDay, startDate.getHours(), startDate.getMinutes(), startDate.getSeconds());
}

async function resolveQuota(openid) {
  const userResult = await db.collection(COLLECTIONS.USERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  const user = userResult.data && userResult.data[0];

  // 首份报告优惠（无用户记录 或 有记录但未使用首份）
  // 追加 ORDERS 交叉验证：防止用户删除账号重新注册绕过首份优惠
  if (!user || !user.first_report_used) {
    const prevFirstOrder = await db.collection(COLLECTIONS.ORDERS)
      .where({
        user_id: openid,
        type: ORDER_TYPES.REPORT,
        'metadata.is_first_report': true,
        status: ORDER_STATUS.PAID
      })
      .limit(1)
      .get();

    if (prevFirstOrder.data && prevFirstOrder.data.length > 0) {
      // 用户曾使用过首份优惠但 first_report_used 标记可能丢失
      // 修复标记并跳过首份优惠
      if (user && user._id) {
        await db.collection(COLLECTIONS.USERS).doc(user._id).update({
          data: { first_report_used: true, updated_at: new Date() }
        });
      }
      // 继续检查其他额度来源
    } else {
      return {
        has_free_quota: true,
        quota_source: 'first_report',
        price: PRICES.FIRST_REPORT,
        user: user,
        userExists: !!user
      };
    }
  }

  // 邀请奖励额度
  if (user.invite_reward_credits && user.invite_reward_credits > 0) {
    return {
      has_free_quota: true,
      quota_source: 'invite',
      price: 0,
      user: user,
      userExists: true
    };
  }

  // 会员额度
  const memberResult = await db.collection(COLLECTIONS.MEMBERS)
    .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE })
    .limit(1)
    .get();

  if (memberResult.data && memberResult.data.length > 0) {
    const member = memberResult.data[0];
    const now = new Date();
    const nextResetAt = member.report_credits_reset_at ? new Date(member.report_credits_reset_at) : null;

    // 月度重置：到期自动清零
    let used = member.report_credits_used || 0;
    if (nextResetAt && now >= nextResetAt) {
      used = 0;
      const startDate = member.start_date ? new Date(member.start_date) : now;
      const newResetAt = calcNextReset(startDate, nextResetAt);
      await db.collection(COLLECTIONS.MEMBERS).doc(member._id).update({
        data: {
          report_credits_used: 0,
          report_credits_reset_at: newResetAt,
          updated_at: now
        }
      });
      member.report_credits_used = 0;
      member.report_credits_reset_at = newResetAt;
    }

    const expectedTotal = member.type === 'yearly' ? MEMBER_CREDITS.YEARLY_REPORTS : MEMBER_CREDITS.MONTHLY_REPORTS;
    let total = member.report_credits_total || expectedTotal;
    // 旧会员迁移：如果库里的 total 低于当前配置，使用新值
    if (total < expectedTotal) total = expectedTotal;
    const remaining = Math.max(0, total - used);

    if (remaining > 0) {
      return {
        has_free_quota: true,
        quota_source: 'member',
        price: 0,
        user: user,
        userExists: true,
        member: member
      };
    }
  }

  // 无免费额度，需要付费
  return {
    has_free_quota: false,
    quota_source: 'paid',
    price: PRICES.STANDARD_REPORT,
    user: user,
    userExists: !!user
  };
}

/**
 * 构建订单描述文案
 */
function buildDescription(quotaInfo) {
  if (quotaInfo.quota_source === 'first_report') {
    return '新用户首份AI报告';
  }
  if (quotaInfo.has_free_quota && quotaInfo.price === 0) {
    return '免费AI报告';
  }
  return '标准AI健康报告';
}

/**
 * 扣减对应的额度（在创建订单之前调用，使用条件更新确保原子性）
 * 处理新用户无记录的情况：自动创建用户记录并标记 first_report_used
 * @returns {boolean} 扣减是否成功
 */
async function deductQuota(openid, quotaInfo) {
  const now = new Date();

  // 首份报告标记（条件更新：只有未标记时才能成功）
  if (quotaInfo.quota_source === 'first_report') {
    if (!quotaInfo.userExists) {
      // 新用户无记录 — 尝试创建并标记 first_report_used
      try {
        await db.collection(COLLECTIONS.USERS).add({
          data: {
            user_id: openid,
            first_report_used: true,
            invite_reward_credits: 0,
            isMember: false,
            created_at: now,
            updated_at: now
          }
        });
      } catch (e) {
        // 并发创建冲突，说明已存在记录，尝试条件更新
        let retryResult = await db.collection(COLLECTIONS.USERS)
          .where({ user_id: openid, first_report_used: _.neq(true) })
          .update({ data: { first_report_used: true, updated_at: now } });
        if (!retryResult.stats || retryResult.stats.updated === 0) {
          return false;
        }
      }
    } else if (quotaInfo.user) {
      // 已有用户记录 — 条件更新确保只标记一次
      let updateResult = await db.collection(COLLECTIONS.USERS)
        .where({ _id: quotaInfo.user._id, first_report_used: _.neq(true) })
        .update({ data: { first_report_used: true, updated_at: now } });
      if (!updateResult.stats || updateResult.stats.updated === 0) {
        return false;
      }
    }
  }

  // 邀请奖励扣减（条件更新：余额 > 0 才能扣减）
  if (quotaInfo.quota_source === 'invite' && quotaInfo.user) {
    let inviteResult = await db.collection(COLLECTIONS.USERS)
      .where({ _id: quotaInfo.user._id, invite_reward_credits: _.gt(0) })
      .update({ data: { invite_reward_credits: _.inc(-1), updated_at: now } });
    if (!inviteResult.stats || inviteResult.stats.updated === 0) {
      return false;
    }
  }

  // 会员额度扣减（条件更新：剩余额度 > 0 才能扣减）
  if (quotaInfo.quota_source === 'member' && quotaInfo.member) {
    let total = quotaInfo.member.report_credits_total || MEMBER_CREDITS.MONTHLY_REPORTS;
    let used = quotaInfo.member.report_credits_used || 0;
    let memberResult = await db.collection(COLLECTIONS.MEMBERS)
      .where({
        _id: quotaInfo.member._id,
        report_credits_used: _.lt(total)
      })
      .update({ data: { report_credits_used: _.inc(1), updated_at: now } });
    if (!memberResult.stats || memberResult.stats.updated === 0) {
      return false;
    }
  }

  return true;
}

/**
 * 回滚额度扣减（订单创建失败或并发去重时调用）
 * 与 deductQuota 执行相反操作
 * @param {string} openid - 用户 openid
 * @param {object} quotaInfo - 额度信息
 */
async function rollbackQuota(openid, quotaInfo) {
  const now = new Date();
  try {
    if (quotaInfo.quota_source === 'first_report') {
      // 回滚首份标记
      await db.collection(COLLECTIONS.USERS)
        .where({ user_id: openid })
        .update({ data: { first_report_used: false, updated_at: now } });
    } else if (quotaInfo.quota_source === 'invite' && quotaInfo.user) {
      // 回滚邀请奖励额度
      await db.collection(COLLECTIONS.USERS)
        .where({ _id: quotaInfo.user._id })
        .update({ data: { invite_reward_credits: _.inc(1), updated_at: now } });
    } else if (quotaInfo.quota_source === 'member' && quotaInfo.member) {
      // 回滚会员额度
      await db.collection(COLLECTIONS.MEMBERS)
        .where({ _id: quotaInfo.member._id, report_credits_used: _.gt(0) })
        .update({ data: { report_credits_used: _.inc(-1), updated_at: now } });
    }
  } catch (e) {
    console.error('[createOrder] 额度回滚失败:', e.message);
  }
}
