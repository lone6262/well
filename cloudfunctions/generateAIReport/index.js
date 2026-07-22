/**
 * 生成AI健康报告云函数
 *
 * 输入: { recordId }
 * 流程:
 *   1. 校验 recordId
 *   2. 查询 symptom_records 并验证归属
 *   3. 查询关联宠物信息
 *   4. 调用 report-engine 生成报告（含缓存逻辑）
 *   5. 更新 symptom_record 标记 has_ai_report
 *   6. 创建 24h 回访记录
 *   7. 返回报告内容
 */

const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  FOLLOWUP_STATUS,
  MEMBER_STATUS,
  ORDER_TYPES,
  ORDER_STATUS,
  warmupConfig,
  loadPrices,
} = require('./common/constants');
const reportEngine = require('./common/report-engine');
const { verifyToken } = require('./common/auth');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

/**
 * 查询症状记录并验证归属
 *
 * @param {string} recordId - 症状记录ID
 * @param {string} openid - 当前用户openid
 * @returns {object} 记录数据
 * @throws {Error} 记录不存在或不属于当前用户时抛出
 */
async function getVerifiedRecord(recordId, openid) {
  const recordResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS).doc(recordId).get();

  if (!recordResult.data || Object.keys(recordResult.data).length === 0) {
    const error = new Error('评估记录不存在');
    error.code = RESPONSE_CODE.NOT_FOUND;
    throw error;
  }

  const record = recordResult.data;

  if (record.user_id !== openid) {
    const error = new Error('无权操作此评估记录');
    error.code = RESPONSE_CODE.UNAUTHORIZED;
    throw error;
  }

  // 合规：高风险症状禁止生成报告，引导就医
  if (record.risk_level === 'high' || record.riskLevel === 'high') {
    const error = new Error('检测到高风险症状，请立即就医');
    error.code = RESPONSE_CODE.ERROR;
    throw error;
  }

  // V1.5.1: 优先读 record 级落库的报告正文 → 「查看历史报告」免扣费。
  //   ai_cache 是症状级共享缓存（跨用户），带描述的报告会被 report-engine 跳过（ai_report_id=null），
  //   原导致查看历史时误走「重新生成 + 扣费」。改为以 record 自身落库正文为准，命中即免扣费返回。
  if (record.ai_report_content && record.ai_report_content.risk_summary) {
    return {
      alreadyExists: true,
      content: record.ai_report_content,
      source: 'cache',
      cacheId: recordId,
      risk_level: record.risk_level,
    };
  }

  if (record.has_ai_report && record.ai_report_id) {
    // 已有报告，从缓存读取
    const cacheResult = await db.collection(COLLECTIONS.AI_CACHE).doc(record.ai_report_id).get();

    if (cacheResult.data && cacheResult.data.report_content) {
      const content = cacheResult.data.report_content;
      // 校验缓存内容是否有效（必须包含 risk_summary 字段）
      if (
        content.risk_summary &&
        typeof content.risk_summary === 'string' &&
        content.risk_summary.length > 0
      ) {
        const existing = cacheResult.data;
        return {
          alreadyExists: true,
          content: existing.report_content,
          source: existing.source || 'cache',
          cacheId: existing._id,
          risk_level: record.risk_level,
        };
      }
      // 缓存内容无效，清除标记以便重新生成
      console.warn(
        '[generateAIReport] 缓存内容无效，将重新生成报告, cacheId=' + record.ai_report_id
      );
      await db
        .collection(COLLECTIONS.SYMPTOM_RECORDS)
        .doc(recordId)
        .update({
          data: { has_ai_report: false, ai_report_id: '' },
        });
    }
  }

  return record;
}

/**
 * 查询关联的宠物信息
 *
 * @param {string} petId - 宠物ID
 * @param {string} openid - 当前用户openid
 * @returns {object} 宠物信息 { type, age, name, ... }
 * @throws {Error} 宠物不存在或不属于当前用户时抛出
 */
async function getVerifiedPet(petId, openid) {
  const petResult = await db.collection(COLLECTIONS.PETS).doc(petId).get();

  if (!petResult.data || Object.keys(petResult.data).length === 0) {
    const error = new Error('宠物信息不存在');
    error.code = RESPONSE_CODE.NOT_FOUND;
    throw error;
  }

  const pet = petResult.data;

  if (pet.user_id !== openid) {
    const error = new Error('宠物不属于当前用户');
    error.code = RESPONSE_CODE.UNAUTHORIZED;
    throw error;
  }

  return {
    type: pet.type,
    age: pet.age,
    name: pet.name,
    breed: pet.breed || '',
    gender: pet.gender || '',
  };
}

/**
 * 创建24小时后的回访记录
 *
 * @param {string} recordId - 症状记录ID
 * @param {string} openid - 用户openid
 * @param {string} petId - 宠物ID
 * @returns {string} 新建的回访记录ID
 */
async function createFollowupRecord(recordId, openid, petId) {
  const now = new Date();
  const followupAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const followupData = {
    record_id: recordId,
    user_id: openid,
    pet_id: petId,
    status: FOLLOWUP_STATUS.PENDING,
    followup_at: followupAt,
    created_at: now,
  };

  const result = await db.collection(COLLECTIONS.FOLLOWUP_RECORDS).add({
    data: followupData,
  });

  return result._id;
}

/**
 * 解析报告订单与额度（在生成报告之前调用）
 *
 * 统一支付改造后的策略：
 *   - 优先复用 createOrder 已为该 recordId 创建的订单（避免双重扣额度）；
 *   - 已有 PAID 单 → 直接复用；
 *   - 已有 PENDING 单且金额 0（免费） → 标记 PAID 后复用；
 *   - 已有 PENDING 单且金额 >0（未支付） → 拒绝，提示前端先支付；
 *   - 无既有订单：仅允许免费来源（首份/邀请/会员额度）直接建 PAID 单并扣额度；
 *     付费来源一律拒绝，要求前端先 createOrder 下单支付（堵住「付费报告白送」）。
 *
 * @param {object} db - 数据库实例
 * @param {string} openid
 * @param {string} recordId - 症状记录ID
 * @param {object} dbPrices - 价格配置
 * @param {object} dbCredits - 额度配置
 * @returns {Promise<{ok:boolean, orderId:string|null, msg:string, data:object}>}
 */
async function resolveReportOrder(db, openid, recordId, dbPrices, dbCredits) {
  const now = new Date();

  // 1. 查找该记录已有的报告订单（createOrder 建单时写入 metadata.record_id）
  let existingOrder = null;
  try {
    const ordRes = await db
      .collection(COLLECTIONS.ORDERS)
      .where({ type: ORDER_TYPES.REPORT, 'metadata.record_id': recordId })
      .limit(10)
      .get();
    const candidates = (ordRes.data || []).filter((o) =>
      [ORDER_STATUS.PENDING, ORDER_STATUS.PAID].includes(o.status)
    );
    if (candidates.length > 0) {
      existingOrder = candidates[0];
    }
  } catch (e) {
    console.warn('[resolveReportOrder] 查询既有订单失败，降级额度解析:', e.message);
  }

  if (existingOrder) {
    if (existingOrder.status === ORDER_STATUS.PAID) {
      return {
        ok: true,
        orderId: existingOrder._id,
        msg: '',
        data: {
          quota_source:
            (existingOrder.metadata && existingOrder.metadata.quota_source) || 'existing',
        },
      };
    }
    // PENDING
    const amt = existingOrder.amount || 0;
    if (amt === 0) {
      await db
        .collection(COLLECTIONS.ORDERS)
        .doc(existingOrder._id)
        .update({
          data: { status: ORDER_STATUS.PAID, paid_at: now, updated_at: now },
        });
      return {
        ok: true,
        orderId: existingOrder._id,
        msg: '',
        data: {
          quota_source:
            (existingOrder.metadata && existingOrder.metadata.quota_source) || 'existing',
        },
      };
    }
    return {
      ok: false,
      orderId: existingOrder._id,
      msg: '请先完成支付后再生成报告',
      data: {
        needPayment: true,
        orderId: existingOrder._id,
        outTradeNo: existingOrder.out_trade_no,
      },
    };
  }

  // 2. 无既有订单：解析免费额度。付费来源拒绝（必须先走 createOrder）
  const userResult = await db
    .collection(COLLECTIONS.USERS)
    .where({ user_id: openid })
    .limit(1)
    .get();
  const user = userResult.data && userResult.data[0];
  let quotaSource = 'paid';
  let quotaPrice = dbPrices.STANDARD_REPORT;

  // 优先级：邀请奖励 > 首份免费 > 点数包 > 会员额度
  let matched = false;

  // 1. 邀请奖励（优先消耗免费额度）
  if (user && user.invite_reward_credits && user.invite_reward_credits > 0) {
    quotaSource = 'invite';
    quotaPrice = 0;
    matched = true;
  }

  // 2. 首份免费
  if (!matched && (!user || !user.first_report_used)) {
    quotaSource = 'first_report';
    quotaPrice = 0;
    matched = true;
  }

  // 3. 点数包余额
  if (!matched) {
    const pointsResult = await db
      .collection(COLLECTIONS.USER_POINTS)
      .where({ user_id: openid })
      .limit(1)
      .get();
    const pts = pointsResult.data && pointsResult.data[0];
    if (pts && pts.balance > 0 && pts.expire_at && new Date(pts.expire_at) > now) {
      quotaSource = 'points';
      quotaPrice = 0;
      matched = true;
    }
  }

  // 4. 会员额度（最后才扣会员次数，保护付费会员权益）
  if (!matched) {
    const memberResult = await db
      .collection(COLLECTIONS.MEMBERS)
      .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE })
      .limit(1)
      .get();
    if (memberResult.data && memberResult.data.length > 0) {
      const m = memberResult.data[0];
      const isFamily = m.type === 'family_monthly' || m.type === 'family_yearly';
      const isYearly = m.type === 'yearly' || m.type === 'family_yearly';
      const expectedTotal = isFamily
        ? isYearly
          ? dbCredits.FAMILY_YEARLY_REPORTS
          : dbCredits.FAMILY_MONTHLY_REPORTS
        : isYearly
          ? dbCredits.YEARLY_REPORTS
          : dbCredits.MONTHLY_REPORTS;
      const total = Math.max(m.report_credits_total || expectedTotal, expectedTotal);
      const used = m.report_credits_used || 0;
      if (used < total) {
        quotaSource = 'member';
        quotaPrice = 0;
        matched = true;
      }
    }
  }

  // 付费且无订单：拒绝生成
  if (quotaPrice > 0) {
    return {
      ok: false,
      orderId: null,
      msg: '该报告需要购买，请先下单支付',
      data: { needCreateOrder: true, recordId },
    };
  }

  // 3. 免费来源：扣减额度（条件更新；并发失败则回退为拒绝，不再白送）
  let deductOk = true;
  try {
    if (quotaSource === 'first_report') {
      if (user && user._id) {
        // 条件守卫：仅当 first_report_used 未置 true 时扣减，防止并发请求重复薅免费额度
        const updateRes = await db
          .collection(COLLECTIONS.USERS)
          .where({ _id: user._id, first_report_used: db.command.neq(true) })
          .update({ data: { first_report_used: true, updated_at: now } });
        if (!updateRes.stats || updateRes.stats.updated === 0) deductOk = false;
      } else {
        try {
          await db.collection(COLLECTIONS.USERS).add({
            data: {
              user_id: openid,
              first_report_used: true,
              invite_reward_credits: 0,
              isMember: false,
              created_at: now,
              updated_at: now,
            },
          });
        } catch (addErr) {
          // 并发创建可能因唯一索引失败，尝试条件更新（守卫同上）
          const updateRes = await db
            .collection(COLLECTIONS.USERS)
            .where({ user_id: openid, first_report_used: db.command.neq(true) })
            .update({ data: { first_report_used: true, updated_at: now } });
          if (!updateRes.stats || updateRes.stats.updated === 0) deductOk = false;
        }
      }
    } else if (quotaSource === 'invite') {
      const inviteRes = await db
        .collection(COLLECTIONS.USERS)
        .where({ user_id: openid, invite_reward_credits: db.command.gt(0) })
        .update({ data: { invite_reward_credits: db.command.inc(-1), updated_at: now } });
      if (!inviteRes.stats || inviteRes.stats.updated === 0) deductOk = false;
    } else if (quotaSource === 'member') {
      const memberResult = await db
        .collection(COLLECTIONS.MEMBERS)
        .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE })
        .limit(1)
        .get();
      const m = memberResult.data && memberResult.data[0];
      if (m) {
        const isFamily = m.type === 'family_monthly' || m.type === 'family_yearly';
        const isYearly2 = m.type === 'yearly' || m.type === 'family_yearly';
        const expectedTotal = isFamily
          ? isYearly2
            ? dbCredits.FAMILY_YEARLY_REPORTS
            : dbCredits.FAMILY_MONTHLY_REPORTS
          : isYearly2
            ? dbCredits.YEARLY_REPORTS
            : dbCredits.MONTHLY_REPORTS;
        const total = Math.max(m.report_credits_total || expectedTotal, expectedTotal);
        // 并发守卫：仅当 report_credits_used < total 时才扣减（CAS 条件更新），
        // 与 quota-service.js 一致；并发请求中第二个会 updated=0 → deductOk=false → 拒绝生成
        const memberRes = await db
          .collection(COLLECTIONS.MEMBERS)
          .where({ _id: m._id, report_credits_used: db.command.lt(total) })
          .update({
            data: {
              report_credits_used: db.command.inc(1),
              report_credits_total: total,
              updated_at: now,
            },
          });
        if (!memberRes.stats || memberRes.stats.updated === 0) deductOk = false;
      } else {
        deductOk = false;
      }
    } else if (quotaSource === 'points') {
      // 点数包扣减（条件更新，并发安全）
      const ptsRes = await db
        .collection(COLLECTIONS.USER_POINTS)
        .where({ user_id: openid, balance: db.command.gt(0) })
        .update({ data: { balance: db.command.inc(-1), updated_at: now } });
      if (!ptsRes.stats || ptsRes.stats.updated === 0) deductOk = false;
    }
  } catch (quotaError) {
    console.error('[resolveReportOrder] 额度扣减异常:', quotaError.message);
    deductOk = false;
  }

  if (!deductOk) {
    // 并发导致额度失效：记录补偿日志，拒绝生成（用户可重试或购买）
    try {
      await db.collection(COLLECTIONS.ORDERS).add({
        data: {
          user_id: openid,
          type: ORDER_TYPES.REPORT,
          record_id: recordId,
          status: 'quota_pending',
          description: '额度扣减失败，待补偿',
          metadata: { quota_source: 'compensation_needed', record_id: recordId },
          created_at: now,
          updated_at: now,
        },
      });
    } catch (logErr) {
      console.error('[resolveReportOrder] 补偿日志写入失败:', logErr.message);
    }
    return {
      ok: false,
      orderId: null,
      msg: '免费额度扣减失败，请稍后重试或购买报告',
      data: { needCreateOrder: true, recordId },
    };
  }

  // 4. 创建免费 PAID 订单
  const outTradeNo = 'RPT_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const orderData = {
    user_id: openid,
    type: ORDER_TYPES.REPORT,
    record_id: recordId,
    out_trade_no: outTradeNo,
    transaction_id: 'MOCK_' + outTradeNo,
    amount: 0,
    status: ORDER_STATUS.PAID,
    description: quotaSource === 'first_report' ? '首份AI报告' : '免费AI报告',
    metadata: {
      quota_source: quotaSource,
      is_first_report: quotaSource === 'first_report',
      record_id: recordId,
    },
    mock_pay: true,
    created_at: now,
    updated_at: now,
  };
  const orderResult = await db.collection(COLLECTIONS.ORDERS).add({ data: orderData });
  return { ok: true, orderId: orderResult._id, msg: '', data: { quota_source: quotaSource } };
}

// ========== 云函数入口 ==========

exports.main = async (event, context) => {
  await warmupConfig(db);
  const priceConfig = await loadPrices(db);
  const dbPrices = priceConfig.prices;
  const dbCredits = priceConfig.memberCredits;
  const { recordId } = event;
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  // 1. 用户身份校验
  if (!openid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: '用户未登录',
      data: {},
    };
  }

  // 1.5 Token 校验
  if (!verifyToken(event.token)) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: '登录已过期，请重新登录',
      data: {},
    };
  }

  // 2. 参数校验
  if (!recordId) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '记录ID不能为空',
      data: {},
    };
  }

  let orderId = null;
  let reportQuotaSource = 'unknown';
  try {
    // 3. 查询并验证症状记录
    const record = await getVerifiedRecord(recordId, openid);

    // 如果已有报告，直接返回
    if (record.alreadyExists) {
      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '报告获取成功',
        data: {
          report_id: record.cacheId,
          content: record.content,
          source: record.source,
          cache_hit: true,
          risk_level: record.risk_level,
          pet_name: '',
          created_at: new Date().toLocaleString('zh-CN'),
        },
      };
    }

    // 4. 查询并验证宠物信息
    const pet = await getVerifiedPet(record.pet_id, openid);

    // 4.5 解析订单与额度：仅「首次生成」扣费
    //     has_ai_report=true 表示该记录曾经生成过报告（用户已付过额度），查看/重生成一律免扣费；
    //     ai_report_content 命中已在 getVerifiedRecord 提前返回，到这里说明无正文需重生成（老记录兜底）。
    //     首次生成（has_ai_report=false）才走 resolveReportOrder：优先级 邀请 > 首份免费 > 点数包 > 会员。
    if (!record.has_ai_report) {
      const orderCtx = await resolveReportOrder(db, openid, recordId, dbPrices, dbCredits);
      if (!orderCtx.ok) {
        return {
          code: RESPONSE_CODE.ERROR,
          msg: orderCtx.msg,
          data: orderCtx.data || {},
        };
      }
      orderId = orderCtx.orderId;
      reportQuotaSource = (orderCtx.data && orderCtx.data.quota_source) || 'unknown';
    }

    // 5. 构造 report-engine 所需参数
    const symptomRecord = {
      symptoms: record.symptoms || [],
      symptom_names: record.symptom_names || [],
      risk_level: record.risk_level,
      description: record.description || '',
    };

    // 6. 调用报告引擎生成报告（内部处理缓存逻辑）
    const reportResult = await reportEngine.generateReport(db, symptomRecord, pet);

    // 7. 更新症状记录标记
    //    V1.5.1: 同时落库报告正文 ai_report_content，供「查看历史报告」免扣费回读
    //    （ai_cache 症状级共享缓存对带描述的报告会跳过，无法靠 ai_report_id 回读）。
    await db
      .collection(COLLECTIONS.SYMPTOM_RECORDS)
      .doc(recordId)
      .update({
        data: {
          has_ai_report: true,
          ai_report_id: reportResult.cacheId,
          ai_report_content: reportResult.content,
        },
      });

    // V1.5: 报告生成埋点
    try {
      await cloud.callFunction({
        name: 'trackEvent',
        data: {
          eventName: 'report_generate',
          properties: { source: reportResult.source || 'llm' },
        },
      });
    } catch (trackErr) {
      console.warn('[generateAIReport] 埋点记录跳过:', trackErr.message);
    }

    // 7b. 订单与额度已在 4.5 由 resolveReportOrder 处理（orderId 已就绪）。
    //     报告生成失败时，catch 中会按 orderId 触发自动退款。

    // 8. 创建回访记录（24h后提醒）
    let followupId = null;
    try {
      followupId = await createFollowupRecord(recordId, openid, record.pet_id);
    } catch (followupError) {
      // 回访记录创建失败不影响主流程，但写入监控日志
      console.error('[ALERT] 创建回访记录失败:', recordId, followupError);
      try {
        await db.collection('error_logs').add({
          data: {
            function: 'generateAIReport',
            operation: 'createFollowup',
            record_id: recordId,
            user_id: openid,
            error: followupError.message || String(followupError),
            created_at: new Date(),
          },
        });
      } catch (_) {
        // error_logs 写入失败，仅记录到控制台
      }
    }

    // 9. 返回结果
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '报告生成成功',
      data: {
        report_id: reportResult.cacheId,
        order_id: orderId,
        content: reportResult.content,
        source: reportResult.source,
        cache_hit: reportResult.cacheHit,
        quota_source: reportQuotaSource,
        followup_id: followupId,
        risk_level: record.risk_level,
        pet_name: pet.name || '',
        created_at: new Date().toLocaleString('zh-CN'),
      },
    };
  } catch (error) {
    console.error('generateAIReport 云函数执行失败:', error);

    // V1.5: LLM 失败自动退款
    if (orderId) {
      try {
        const failedOrderResult = await db.collection(COLLECTIONS.ORDERS).doc(orderId).get();
        const failedOrder = failedOrderResult.data;
        const orderAmount = failedOrder ? failedOrder.amount || 0 : 0;
        if (orderAmount > 0) {
          try {
            await cloud.callFunction({
              name: 'requestRefund',
              data: { orderId: orderId, reason: 'AI报告生成失败，自动退款', token: event.token },
            });
          } catch (refundErr) {
            console.error('[generateAIReport] 自动退款失败:', refundErr.message);
          }
        }
      } catch (fetchErr) {
        console.error('[generateAIReport] 查询订单失败，跳过退款:', fetchErr.message);
      }
    }

    // 免费报告（member/invite/first_report/points）生成失败：回滚已扣额度
    // 付费报告(amount>0)已通过上方 requestRefund 退款，此处仅处理免费额度
    if (orderId && ['member', 'invite', 'first_report', 'points'].includes(reportQuotaSource)) {
      try {
        const rollbackNow = new Date();
        if (reportQuotaSource === 'member') {
          const mRes = await db
            .collection(COLLECTIONS.MEMBERS)
            .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE })
            .limit(1)
            .get();
          if (mRes.data && mRes.data.length > 0) {
            // 条件守卫：仅当 report_credits_used > 0 时才回扣，防止并发/重试推到负数（与 quota-service 一致）
            const rbRes = await db
              .collection(COLLECTIONS.MEMBERS)
              .where({ _id: mRes.data[0]._id, report_credits_used: db.command.gt(0) })
              .update({
                data: { report_credits_used: db.command.inc(-1), updated_at: rollbackNow },
              });
            if (rbRes.stats && rbRes.stats.updated > 0) {
              console.log('[generateAIReport] 回滚会员额度:', openid);
            }
          }
        } else if (reportQuotaSource === 'first_report') {
          await db
            .collection(COLLECTIONS.USERS)
            .where({ user_id: openid })
            .update({ data: { first_report_used: false, updated_at: rollbackNow } });
          console.log('[generateAIReport] 回滚首份免费:', openid);
        } else if (reportQuotaSource === 'invite') {
          await db
            .collection(COLLECTIONS.USERS)
            .where({ user_id: openid })
            .update({
              data: { invite_reward_credits: db.command.inc(1), updated_at: rollbackNow },
            });
          console.log('[generateAIReport] 回滚邀请奖励:', openid);
        } else if (reportQuotaSource === 'points') {
          const pRes = await db
            .collection(COLLECTIONS.USER_POINTS)
            .where({ user_id: openid })
            .limit(1)
            .get();
          if (pRes.data && pRes.data.length > 0) {
            await db
              .collection(COLLECTIONS.USER_POINTS)
              .doc(pRes.data[0]._id)
              .update({
                data: { balance: db.command.inc(1), updated_at: rollbackNow },
              });
            console.log('[generateAIReport] 回滚点数包:', openid);
          }
        }
        // 标记失败订单为 closed（resolveReportOrder 创建的免费 PAID 单）
        try {
          await db
            .collection(COLLECTIONS.ORDERS)
            .doc(orderId)
            .update({
              data: {
                status: ORDER_STATUS.CLOSED,
                close_reason: 'report_generation_failed',
                updated_at: rollbackNow,
              },
            });
        } catch (closeErr) {
          /* 订单可能不存在，忽略 */
        }
      } catch (rollbackErr) {
        console.error('[generateAIReport] 免费额度回滚失败:', rollbackErr.message);
      }
    }

    // 处理业务逻辑错误（带自定义 code）
    if (error.code) {
      return {
        code: error.code,
        msg: error.message,
        data: error.existingReportId ? { existing_report_id: error.existingReportId } : {},
      };
    }

    // 通用服务器错误
    console.error('[generateAIReport] 生成失败:', error.message);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '报告生成失败，请稍后重试',
      data: {},
    };
  }
};
