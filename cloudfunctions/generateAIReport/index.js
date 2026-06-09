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
const { COLLECTIONS, RESPONSE_CODE, FOLLOWUP_STATUS, PRICES, MEMBER_CREDITS, MEMBER_STATUS, ORDER_TYPES, ORDER_STATUS , warmupConfig} = require('./common/constants');
const reportEngine = require('./common/report-engine');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
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
  const recordResult = await db.collection(COLLECTIONS.SYMPTOM_RECORDS)
    .doc(recordId)
    .get();

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

  if (record.has_ai_report && record.ai_report_id) {
    // 已有报告，从缓存读取
    const cacheResult = await db.collection(COLLECTIONS.AI_CACHE)
      .doc(record.ai_report_id).get();

    if (cacheResult.data && cacheResult.data.report_content) {
      const content = cacheResult.data.report_content;
      // 校验缓存内容是否有效（必须包含 risk_summary 字段）
      if (content.risk_summary && typeof content.risk_summary === 'string' && content.risk_summary.length > 0) {
        const existing = cacheResult.data;
        return {
          alreadyExists: true,
          content: existing.report_content,
          source: existing.source || 'cache',
          cacheId: existing._id,
          risk_level: record.risk_level
        };
      }
      // 缓存内容无效，清除标记以便重新生成
      console.warn('[generateAIReport] 缓存内容无效，将重新生成报告, cacheId=' + record.ai_report_id);
      await db.collection(COLLECTIONS.SYMPTOM_RECORDS).doc(recordId).update({
        data: { has_ai_report: false, ai_report_id: '' }
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
  const petResult = await db.collection(COLLECTIONS.PETS)
    .doc(petId)
    .get();

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
    gender: pet.gender || ''
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
    created_at: now
  };

  const result = await db.collection(COLLECTIONS.FOLLOWUP_RECORDS).add({
    data: followupData
  });

  return result._id;
}

// ========== 云函数入口 ==========

exports.main = async (event, context) => {
  await warmupConfig(db);
  const { recordId } = event;
  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;

  // 1. 用户身份校验
  if (!openid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: '用户未登录',
      data: {}
    };
  }

  // 2. 参数校验
  if (!recordId) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '记录ID不能为空',
      data: {}
    };
  }

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
          created_at: new Date().toLocaleString('zh-CN')
        }
      };
    }

    // 4. 查询并验证宠物信息
    const pet = await getVerifiedPet(record.pet_id, openid);

    // 5. 构造 report-engine 所需参数
    const symptomRecord = {
      symptoms: record.symptoms || [],
      symptom_names: record.symptom_names || [],
      risk_level: record.risk_level,
      description: record.description || ''
    };

    // 6. 调用报告引擎生成报告（内部处理缓存逻辑）
    const reportResult = await reportEngine.generateReport(db, symptomRecord, pet);

    // 7. 更新症状记录标记
    await db.collection(COLLECTIONS.SYMPTOM_RECORDS).doc(recordId).update({
      data: {
        has_ai_report: true,
        ai_report_id: reportResult.cacheId
      }
    });

    // V1.5: 报告生成埋点
    try {
      await cloud.callFunction({
        name: 'trackEvent',
        data: {
          eventName: 'report_generate',
          properties: { source: reportResult.source || 'llm' }
        }
      });
    } catch (trackErr) {
      console.warn('[generateAIReport] 埋点记录跳过:', trackErr.message);
    }

    // 7b. 报告生成成功后，扣减额度 + 创建订单
    //     策略：先扣额度，再返回报告。扣减失败时记录补偿日志，不阻塞用户。
    //     后续可通过补偿任务补扣。
    const now = new Date();
    const outTradeNo = 'RPT_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    let orderId = null;
    let quotaDeducted = false;

    try {
      // 解析用户额度
      const userResult = await db.collection(COLLECTIONS.USERS).where({ user_id: openid }).limit(1).get();
      const user = userResult.data && userResult.data[0];
      let quotaSource = 'paid';
      let quotaPrice = PRICES.STANDARD_REPORT;

      // 首份优惠
      if (!user || !user.first_report_used) {
        quotaSource = 'first_report';
        quotaPrice = PRICES.FIRST_REPORT;
      }
      // 邀请奖励
      else if (user.invite_reward_credits && user.invite_reward_credits > 0) {
        quotaSource = 'invite';
        quotaPrice = 0;
      }
      // 会员额度
      else {
        const memberResult = await db.collection(COLLECTIONS.MEMBERS)
          .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE }).limit(1).get();
        if (memberResult.data && memberResult.data.length > 0) {
          const m = memberResult.data[0];
          const expectedTotal = m.type === 'yearly' ? MEMBER_CREDITS.YEARLY_REPORTS : MEMBER_CREDITS.MONTHLY_REPORTS;
          const total = Math.max(m.report_credits_total || expectedTotal, expectedTotal);
          const used = m.report_credits_used || 0;
          if (used < total) {
            quotaSource = 'member';
            quotaPrice = 0;
          }
        }
      }

      // 扣减额度（原子操作）
      if (quotaSource === 'first_report') {
        if (user && user._id) {
          await db.collection(COLLECTIONS.USERS).doc(user._id).update({
            data: { first_report_used: true, updated_at: now }
          });
        } else {
          await db.collection(COLLECTIONS.USERS).add({
            data: { user_id: openid, first_report_used: true, invite_reward_credits: 0, isMember: false, created_at: now, updated_at: now }
          });
        }
      } else if (quotaSource === 'invite') {
        await db.collection(COLLECTIONS.USERS).where({ user_id: openid, invite_reward_credits: db.command.gt(0) })
          .update({ data: { invite_reward_credits: db.command.inc(-1), updated_at: now } });
      } else if (quotaSource === 'member') {
        const memberCond = await db.collection(COLLECTIONS.MEMBERS)
          .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE }).limit(1).get();
        if (memberCond.data && memberCond.data.length > 0) {
          await db.collection(COLLECTIONS.MEMBERS).doc(memberCond.data[0]._id).update({
            data: { report_credits_used: db.command.inc(1), updated_at: now }
          });
        }
      }

      // 创建订单
      const orderData = {
        user_id: openid,
        type: ORDER_TYPES.REPORT,
        record_id: recordId,
        out_trade_no: outTradeNo,
        transaction_id: 'MOCK_' + outTradeNo,
        amount: quotaPrice,
        status: ORDER_STATUS.PAID,
        description: quotaSource === 'first_report' ? '首份AI报告' : (quotaPrice === 0 ? '免费AI报告' : '标准AI报告'),
        metadata: { quota_source: quotaSource, is_first_report: quotaSource === 'first_report' },
        mock_pay: true,
        created_at: now,
        updated_at: now
      };
      const orderResult = await db.collection(COLLECTIONS.ORDERS).add({ data: orderData });
      orderId = orderResult._id;
      quotaDeducted = true;
    } catch (quotaError) {
      // 额度扣减失败 → 记录补偿日志，后续可通过定时任务补扣
      console.error('[generateAIReport] 额度扣减失败，已记录补偿日志:', quotaError.message);
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
            updated_at: now
          }
        });
      } catch (logErr) {
        console.error('[generateAIReport] 补偿日志写入也失败:', logErr.message);
      }
    }

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
            created_at: new Date()
          }
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
        followup_id: followupId,
        risk_level: record.risk_level,
        pet_name: pet.name || '',
        created_at: new Date().toLocaleString('zh-CN')
      }
    };

  } catch (error) {
    console.error('generateAIReport 云函数执行失败:', error);

    // V1.5: LLM 失败自动退款
    if (orderId) {
      try {
        const failedOrderResult = await db.collection(COLLECTIONS.ORDERS).doc(orderId).get();
        const failedOrder = failedOrderResult.data;
        const orderAmount = failedOrder ? (failedOrder.amount || 0) : 0;
        if (orderAmount > 0) {
          try {
            await cloud.callFunction({
              name: 'requestRefund',
              data: { orderId: orderId, reason: 'AI报告生成失败，自动退款', token: event.token }
            });
          } catch (refundErr) {
            console.error('[generateAIReport] 自动退款失败:', refundErr.message);
          }
        }
      } catch (fetchErr) {
        console.error('[generateAIReport] 查询订单失败，跳过退款:', fetchErr.message);
      }
    }

    // 处理业务逻辑错误（带自定义 code）
    if (error.code) {
      return {
        code: error.code,
        msg: error.message,
        data: error.existingReportId
          ? { existing_report_id: error.existingReportId }
          : {}
      };
    }

    // 通用服务器错误
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '报告生成失败，请稍后重试',
      data: {
        error: error.message
      }
    };
  }
};
