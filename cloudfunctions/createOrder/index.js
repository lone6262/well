// 创建订单云函数 — 支持 report / member / points / bundle 多类型
// 模拟支付直接标记已支付，真实支付返回调起参数
// 参考文档: https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pages/index.shtml
//
// 配置方式（优先级从高到低）：
//   1. 数据库 system_config.wechat_pay_config 文档
//   2. 环境变量 MOCK_PAY
const cloud = require('wx-server-sdk');
const https = require('https');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  ORDER_STATUS,
  ORDER_TYPES,
  PRICES,
  PAYMENT_TIMEOUT,
  MEMBER_CREDITS,
  MEMBER_STATUS,
  POINTS_PACKS
, warmupConfig, loadPrices} = require('./common/constants');
const { verifyToken } = require('./common/auth');
const { checkRateLimit } = require('./common/rate-limiter');
const { resolveQuota, deductQuota, rollbackQuota } = require('./common/quota-service');
const { activateMembership } = require('./common/activation-service');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MOCK_PAY = process.env.MOCK_PAY === 'true'; // 从环境变量读取，部署时设为 false

/**
 * 从数据库加载微信支付配置
 * @returns {Promise<{mockPay: boolean}>}
 */
async function loadWechatPayConfig() {
  try {
    const result = await db.collection(COLLECTIONS.SYSTEM_CONFIG)
      .doc('wechat_pay_config')
      .get();

    if (result.data) {
      return {
        mockPay: result.data.mock_pay !== undefined ? result.data.mock_pay : MOCK_PAY
      };
    }
  } catch (e) {
    console.warn('[createOrder] 数据库配置读取失败，使用环境变量:', e.message);
  }

  return { mockPay: MOCK_PAY };
}

/**
 * 创建订单云函数 — 支持 report / member / points / bundle 多类型
 * 模拟支付模式下直接标记为已支付，真实支付模式下返回支付参数
 *
 * @param {string} event.type - 订单类型: 'report'(默认) | 'member' | 'points' | 'bundle'
 * @param {string} event.recordId - 报告订单必填：自查记录ID
 * @param {string} event.memberTier - 会员订单必填: 'monthly'|'yearly'|'family_monthly'|'family_yearly'
 * @param {string} event.packType - 点数包订单必填: 'PACK_3'|'PACK_5'
 * @param {string} event.bundleKey - 套餐订单必填: 'STARTER'|'ESSENTIAL'|'FAMILY'
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  // V2.0: 价格从 DB 动态加载，覆盖硬编码默认值
  const priceConfig = await loadPrices(db);
  const dbPrices = priceConfig.prices;
  const dbCredits = priceConfig.memberCredits;
  // 覆盖模块级 PRICES/MEMBER_CREDITS，确保子函数引用自动使用 DB 值
  Object.assign(PRICES, dbPrices);
  Object.assign(MEMBER_CREDITS, dbCredits);

  // 加载微信支付配置
  const wechatPayConfig = await loadWechatPayConfig();
  const mockPay = wechatPayConfig.mockPay; // 局部变量，供后续使用

  // 安全守卫：mock_pay 开启时所有订单跳过真实支付。生产环境若出现此日志须立即核查
  // system_config.wechat_pay_config.mock_pay 与 MOCK_PAY 环境变量。
  // （NODE_ENV 在微信云默认未设置、不可靠，故以 mockPay 本身作为信号）
  if (mockPay) {
    console.error('[createOrder] [MOCK_PAY] 警告：MOCK_PAY 已开启，订单跳过真实微信支付；生产环境请立即关闭。');
  }

  const { OPENID } = cloud.getWXContext();
  const openid = OPENID;
  const orderType = event.type || 'report';

  // Token 验证（财务操作需验证身份）
  if (!verifyToken(event.token)) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '身份验证失败，请重新登录', data: {} };
  }

  // 速率限制
  if (!await checkRateLimit(db, openid, 'createOrder', 5, 60000, false)) {
    return { code: RESPONSE_CODE.ERROR, msg: '操作过于频繁，请稍后再试', data: {} };
  }

  if (!openid) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }

  // 按订单类型路由
  switch (orderType) {
    case 'report':
      return await handleReportOrder(event, openid, mockPay);
    case 'member':
    case 'member_monthly':
    case 'member_yearly':
    case 'member_family_monthly':
    case 'member_family_yearly':
      return await handleMemberOrder(event, openid, mockPay);
    case 'points':
      return await handlePointsOrder(event, openid, mockPay);
    case 'bundle':
      return await handleBundleOrder(event, openid, mockPay);
    default:
      return { code: RESPONSE_CODE.ERROR, msg: `不支持的订单类型: ${orderType}`, data: {} };
  }
};

async function handleReportOrder(event, openid, mockPay) {
  const { recordId, token } = event;

  if (!recordId) {
    return { code: RESPONSE_CODE.ERROR, msg: '记录ID不能为空', data: {} };
  }

  try {
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

    // 3.5 合规：高风险症状禁止生成付费报告，引导就医
    if (record.risk_level === 'high' || record.riskLevel === 'high') {
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '检测到高风险症状，请立即就医，不建议生成报告',
        data: { riskLevel: 'high' }
      };
    }

    // 4. 查询报告额度
    const quotaInfo = await resolveQuota(db, openid);

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
      // 重新支付模式：已有 pending 订单时重新生成 out_trade_no 并统一下单
      // （避免复用旧订单号导致微信支付缓存/冲突问题）
      if (event.repay && dup.status === ORDER_STATUS.PENDING && !mockPay && dup.amount > 0) {
        try {
          const newOutTradeNo = 'WELL_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
          // 更新订单号（旧订单的资源如优惠券、额度仍保留）
          await db.collection(COLLECTIONS.ORDERS).doc(dup._id).update({
            data: {
              out_trade_no: newOutTradeNo,
              updated_at: new Date()
            }
          });
          const payParams = await createWechatPayment(newOutTradeNo, dup.amount, openid, dup.description);
          return {
            code: RESPONSE_CODE.SUCCESS,
            msg: '订单已更新，请完成支付',
            data: {
              orderId: dup._id,
              outTradeNo: newOutTradeNo,
              status: ORDER_STATUS.PENDING,
              amount: dup.amount,
              originAmount: dup.origin_amount || dup.amount,
              couponDiscount: dup.coupon_discount || 0,
              amountDisplay: (dup.amount / 100).toFixed(2),
              quotaSource: dup.metadata && dup.metadata.quota_source,
              payParams: payParams,
              isRepay: true
            }
          };
        } catch (payErr) {
          console.error('[createOrder] 重新支付统一下单失败:', payErr.message);
          return { code: RESPONSE_CODE.SERVER_ERROR, msg: '支付通道暂不可用，请稍后重试', data: {} };
        }
      }
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
    const deductOk = await deductQuota(db, openid, quotaInfo);
    if (!deductOk) {
      return { code: RESPONSE_CODE.ERROR, msg: '额度扣减失败，请重试', data: {} };
    }

    // 7.5. 风控检查（付费订单在创建前校验）
    if (quotaInfo.price > 0 && !mockPay) {
      try {
        const riskResult = await cloud.callFunction({
          name: 'checkRiskControl',
          data: { openid, orderType: ORDER_TYPES.REPORT, amount: quotaInfo.price }
        });
        if (riskResult.result && riskResult.result.blocked) {
          await rollbackQuota(db, openid, quotaInfo);
          return {
            code: RESPONSE_CODE.ERROR,
            msg: riskResult.result.reason || '订单触发风控限制，请稍后再试',
            data: { riskBlocked: true }
          };
        }
      } catch (riskErr) {
        // checkRiskControl 可能尚未部署，开发阶段放行
        console.warn('[createOrder] 风控检查跳过:', riskErr.message);
      }
    }

    // 7.6. 自动选取最优优惠券（仅付费订单且非套餐）
    let appliedCoupon = null;
    if (quotaInfo.price > 0 && quotaInfo.quota_source === 'paid') {
      try {
        appliedCoupon = await autoSelectCoupon(openid, quotaInfo.price, ORDER_TYPES.REPORT);
      } catch (couponErr) {
        console.warn('[createOrder] 优惠券查询跳过:', couponErr.message);
      }
    }

    // 计算实付金额
    const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
    const payAmount = Math.max(quotaInfo.price - couponDiscount, 0);

    // 8. 创建订单（Mock模式直接paid，真实模式创建pending + 返回支付参数）
    let orderId;
    try {
      const orderData = {
       user_id: openid,
       type: ORDER_TYPES.REPORT,
       status: (mockPay || payAmount === 0) ? ORDER_STATUS.PAID : ORDER_STATUS.PENDING,
       amount: payAmount,
       origin_amount: quotaInfo.price,
       coupon_discount: couponDiscount,
       out_trade_no: outTradeNo,
       transaction_id: (mockPay || payAmount === 0) ? 'MOCK_' + outTradeNo : '',
        description: buildDescription(quotaInfo),
        metadata: {
          record_id: recordId,
          pet_id: record.pet_id,
          quota_source: quotaInfo.quota_source,
          is_first_report: quotaInfo.quota_source === 'first_report',
          mock_pay: mockPay,
          coupon_user_id: appliedCoupon ? appliedCoupon.userCouponId : '',
          coupon_name: appliedCoupon ? appliedCoupon.couponName : '',
          origin_amount: quotaInfo.price,
          coupon_discount: couponDiscount
        },
        paid_at: mockPay ? now : null,
        channel: event.channel || 'mp',
        is_checked: false,
        need_manual_review: payAmount >= PRICES.MANUAL_REVIEW_THRESHOLD,
        created_at: now,
        updated_at: now
      };

      const orderResult = await db.collection(COLLECTIONS.ORDERS).add({ data: orderData });
      orderId = orderResult._id;

      // 标记优惠券已锁定（后续 payCallback 中标记 used）
      if (appliedCoupon && appliedCoupon.userCouponId) {
        try {
          await db.collection(COLLECTIONS.USER_COUPONS)
            .doc(appliedCoupon.userCouponId)
            .update({
              data: { status: 'locked', order_id: orderId, updated_at: now }
            });
        } catch (e) { /* 优惠券集合可能未创建 */ }
      }
    } catch (orderCreateError) {
      console.error('[createOrder] 订单创建失败，回滚额度:', orderCreateError.message);
      await rollbackQuota(db, openid, quotaInfo);
      // 释放已锁定的优惠券
      if (appliedCoupon && appliedCoupon.userCouponId) {
        try {
          await db.collection(COLLECTIONS.USER_COUPONS)
            .doc(appliedCoupon.userCouponId)
            .update({ data: { status: 'unused', order_id: '', updated_at: now } });
        } catch (e) { /* 静默 */ }
      }
      return { code: RESPONSE_CODE.SERVER_ERROR, msg: '订单创建失败，额度已回退', data: {} };
    }

    // 9. 二次去重检查
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
      await rollbackQuota(db, openid, quotaInfo);
      await db.collection(COLLECTIONS.ORDERS).doc(orderId).remove();
      if (appliedCoupon && appliedCoupon.userCouponId) {
        try {
          await db.collection(COLLECTIONS.USER_COUPONS)
            .doc(appliedCoupon.userCouponId)
            .update({ data: { status: 'unused', order_id: '', updated_at: now } });
        } catch (e) { /* 静默 */ }
      }
      const dup = dupCheck.data[0];
      return {
        code: RESPONSE_CODE.ERROR,
        msg: '该记录已有进行中的订单',
        data: { orderId: dup._id, outTradeNo: dup.out_trade_no, status: dup.status }
      };
    }

    // 10. 真实支付模式：调用微信统一下单，返回支付参数给前端
    if (!mockPay && payAmount > 0) {
      try {
        const payParams = await createWechatPayment(outTradeNo, payAmount, openid,
          buildDescription(quotaInfo));
        return {
          code: RESPONSE_CODE.SUCCESS,
          msg: '订单创建成功，请完成支付',
          data: {
            orderId: orderId,
            outTradeNo: outTradeNo,
            status: ORDER_STATUS.PENDING,
            amount: payAmount,
            originAmount: quotaInfo.price,
            couponDiscount: couponDiscount,
            amountDisplay: (payAmount / 100).toFixed(2),
            quotaSource: quotaInfo.quota_source,
            payParams: payParams  // 前端调起微信支付的参数
          }
        };
      } catch (payErr) {
        // 统一下单失败，回滚全部
        console.error('[createOrder] 统一下单失败:', payErr.message);
        await rollbackQuota(db, openid, quotaInfo);
        await db.collection(COLLECTIONS.ORDERS).doc(orderId).remove();
        if (appliedCoupon && appliedCoupon.userCouponId) {
          try {
            await db.collection(COLLECTIONS.USER_COUPONS)
              .doc(appliedCoupon.userCouponId)
              .update({ data: { status: 'unused', order_id: '', updated_at: now } });
          } catch (e) { /* 静默 */ }
        }
        return { code: RESPONSE_CODE.SERVER_ERROR, msg: '支付通道暂不可用，请稍后重试', data: {} };
      }
    }

    // 11. Mock 模式或免费订单：直接返回成功
    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '订单创建成功',
      data: {
       orderId: orderId,
       outTradeNo: outTradeNo,
       status: (mockPay || payAmount === 0) ? ORDER_STATUS.PAID : ORDER_STATUS.PENDING,
       amount: payAmount,
       originAmount: quotaInfo.price,
       couponDiscount: couponDiscount,
       amountDisplay: (payAmount / 100).toFixed(2),
       quotaSource: quotaInfo.quota_source,
       payParams: null
      }
    };

  } catch (error) {
    console.error('创建报告订单失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '创建订单失败', data: {} };
  }
}

/**
 * 会员订单处理
 */
async function handleMemberOrder(event, openid, mockPay) {
  const memberTier = event.memberTier || event.type || 'monthly';
  const VALID_TIERS = ['monthly', 'yearly', 'family_monthly', 'family_yearly'];
  if (!VALID_TIERS.includes(memberTier)) {
    return { code: RESPONSE_CODE.ERROR, msg: '会员类型参数无效', data: {} };
  }

  const PRICE_MAP = {
    monthly: PRICES.MEMBER_MONTHLY,
    yearly: PRICES.MEMBER_YEARLY,
    family_monthly: PRICES.MEMBER_FAMILY_MONTHLY,
    family_yearly: PRICES.MEMBER_FAMILY_YEARLY,
  };
  const ORDER_TYPE_MAP = {
    monthly: ORDER_TYPES.MEMBER_MONTHLY,
    yearly: ORDER_TYPES.MEMBER_YEARLY,
    family_monthly: ORDER_TYPES.MEMBER_FAMILY_MONTHLY,
    family_yearly: ORDER_TYPES.MEMBER_FAMILY_YEARLY,
  };

  // 测试模式：金额仅由服务端环境变量控制，禁止前端篡改（安全修复 F4）
  // 修复说明：微信云开发中 NODE_ENV 默认未设置，原 !== 'production' 判断恒为 true；
  //   且 event._testMode / event._testAmount 来自客户端，可被攻击者用 ¥0.01 购买年卡。
  //   现改为严格开发环境判定，且测试金额仅从服务端环境变量 TEST_ORDER_AMOUNT 读取。
  const isDevEnv = process.env.NODE_ENV === 'development';
  const TEST_AMOUNT = (isDevEnv && process.env.TEST_ORDER_AMOUNT)
    ? parseInt(process.env.TEST_ORDER_AMOUNT, 10)
    : null;
  const isTestMode = TEST_AMOUNT !== null && TEST_AMOUNT > 0;
  let amount = isTestMode ? TEST_AMOUNT : PRICE_MAP[memberTier];

  let upgradeInfo = null; // 升级补差价信息

  const orderType = ORDER_TYPE_MAP[memberTier];
  const now = new Date();
  const outTradeNo = 'WELL_MEMBER_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

  try {
    // 会员升级/续费规则（UPGRADE_MATRIX）
    if (!isTestMode) {
      // 允许的升级路径
      const UPGRADE_MATRIX = {
        monthly:        ['family_monthly', 'yearly', 'family_yearly'],
        family_monthly: ['family_yearly'],  // 家庭月卡不能退回个人年卡
        yearly:         ['family_yearly'],   // 个人年卡只能升级家庭年卡
        family_yearly:  []                     // 已是最高级
      };
      const TIER_TEXT = {
        monthly: '个人月卡', family_monthly: '家庭月卡',
        yearly: '个人年卡', family_yearly: '家庭年卡'
      };
      const activeRes = await db.collection(COLLECTIONS.MEMBERS)
        .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE })
        .limit(1)
        .get();
      const active = activeRes.data && activeRes.data[0];
      const notExpired = active && active.expire_date && new Date(active.expire_date) > now;
      if (active && notExpired) {
        // 同级会员重复提交 -> 提示充值点数
        if (active.type === memberTier) {
          return {
            code: RESPONSE_CODE.ERROR,
            msg: '您已是' + (TIER_TEXT[active.type] || '会员') + '，无需重复开通。如需更多报告次数，请购买点数包',
            data: {
              already_member: true,
              suggest_points: true,
              current_type: active.type
            }
          };
        }

        // 检查是否允许升级到目标类型
        const allowedUpgrades = UPGRADE_MATRIX[active.type] || [];
        if (!allowedUpgrades.includes(memberTier)) {
          return {
            code: RESPONSE_CODE.ERROR,
            msg: '您已是' + (TIER_TEXT[active.type] || '会员') +
              '，暂不支持开通' + (TIER_TEXT[memberTier] || '该会员') +
              '，请选择更高等级会员或续费当前会员',
            data: {
              upgrade_blocked: true,
              current_type: active.type,
              target_type: memberTier
            }
          };
        }

        // ===== 升级补差价 =====
        const DURATION_MAP = { monthly: 30, family_monthly: 30, yearly: 365, family_yearly: 365 };
        const remainingMs = new Date(active.expire_date).getTime() - now.getTime();
        const remainingDays = Math.max(0, remainingMs / (24 * 60 * 60 * 1000));
        const currentDuration = DURATION_MAP[active.type] || 30;
        const currentValue = PRICE_MAP[active.type];
        const targetValue = PRICE_MAP[memberTier];
        const remainingValue = Math.round(currentValue * (remainingDays / currentDuration));
        const upgradeAmount = Math.max(1, targetValue - remainingValue);
        amount = upgradeAmount;
        upgradeInfo = {
          is_upgrade: true,
          from_type: active.type,
          to_type: memberTier,
          remaining_days: Math.round(remainingDays),
          credit_amount: remainingValue,
          original_price: targetValue,
          upgrade_price: upgradeAmount
        };
        console.log('[createOrder] 升级补差价:', active.type, '→', memberTier,
          '剩余', Math.round(remainingDays), '天, 抵扣', remainingValue, '分, 补价', upgradeAmount, '分');
      }
    }

    // 检查重复 pending 订单（测试模式跳过此检查）
    if (!isTestMode) {
      const pendingResult = await db.collection(COLLECTIONS.ORDERS)
        .where({
          user_id: openid,
          type: _.in([ORDER_TYPES.MEMBER, ORDER_TYPES.MEMBER_MONTHLY, ORDER_TYPES.MEMBER_YEARLY,
            ORDER_TYPES.MEMBER_FAMILY_MONTHLY, ORDER_TYPES.MEMBER_FAMILY_YEARLY]),
          status: ORDER_STATUS.PENDING
        })
        .limit(1)
        .get();

      if (pendingResult.data && pendingResult.data.length > 0) {
        const dup = pendingResult.data[0];
        // 重新支付模式：生成新订单号并重新统一下单
        if (event.repay && !mockPay && dup.amount > 0) {
          try {
            const newOutTradeNo = 'WELL_MEMBER_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
            await db.collection(COLLECTIONS.ORDERS).doc(dup._id).update({
              data: {
                out_trade_no: newOutTradeNo,
                updated_at: new Date()
              }
            });
            const payParams = await createWechatPayment(newOutTradeNo, dup.amount, openid, dup.description);
            return {
              code: RESPONSE_CODE.SUCCESS,
              msg: '订单已更新，请完成支付',
              data: {
                orderId: dup._id,
                outTradeNo: newOutTradeNo,
                status: ORDER_STATUS.PENDING,
                amount: dup.amount,
                amountDisplay: (dup.amount / 100).toFixed(2),
                memberTier: dup.metadata && dup.metadata.member_tier,
                payParams: payParams,
                isRepay: true
              }
            };
          } catch (payErr) {
            console.error('[createOrder] 会员重新支付统一下单失败:', payErr.message);
            return { code: RESPONSE_CODE.SERVER_ERROR, msg: '支付通道暂不可用，请稍后重试', data: {} };
          }
        }
        return { code: RESPONSE_CODE.ERROR, msg: '已有进行中的会员订单', data: { orderId: dup._id } };
      }
    }

    // 自动选取最优优惠券（测试单跳过；金额>0 才选）。抵扣最终金额（新购价或升级补差价）。
    let appliedCoupon = null;
    let couponDiscount = 0;
    if (!isTestMode && amount > 0) {
      try {
        appliedCoupon = await autoSelectCoupon(openid, amount, ORDER_TYPES.MEMBER);
        if (appliedCoupon) {
          couponDiscount = appliedCoupon.discount || 0;
        }
      } catch (couponErr) {
        console.warn('[createOrder] 会员优惠券查询跳过:', couponErr.message);
      }
    }
    const payAmount = Math.max(amount - couponDiscount, 0);
    const isFreeOrder = payAmount === 0;          // 券全额抵扣 → 免单
    const instantPaid = mockPay || isFreeOrder;   // 立即付清（不走微信支付）
    const transactionId = instantPaid ? (mockPay ? 'MOCK_' : 'FREE_') + outTradeNo : '';

    const orderData = {
      user_id: openid,
      type: orderType,
      status: instantPaid ? ORDER_STATUS.PAID : ORDER_STATUS.PENDING,
      amount: payAmount,
      origin_amount: isTestMode ? PRICE_MAP[memberTier] : (upgradeInfo ? upgradeInfo.original_price : amount), // 升级时记录目标原价（券前）
      coupon_discount: couponDiscount,
      out_trade_no: outTradeNo,
      transaction_id: transactionId,
      description: upgradeInfo ? ('会员升级至' + (memberTier.includes('family') ? '家庭' : '个人') + (memberTier.includes('yearly') ? '年卡' : '月卡')) : ((memberTier.includes('yearly') ? '年卡' : '月卡') + '会员购买'),
      metadata: {
        member_tier: memberTier,
        mock_pay: mockPay,
        test_mode: isTestMode,
        test_amount: isTestMode ? amount : null,
        upgrade_info: upgradeInfo,  // 升级补差价信息（非升级时为 null）
        coupon_user_id: appliedCoupon ? appliedCoupon.userCouponId : '',
        coupon_name: appliedCoupon ? appliedCoupon.couponName : '',
        coupon_discount: couponDiscount
      },
      paid_at: instantPaid ? now : null,
      channel: event.channel || 'mp',
      is_checked: false,
      need_manual_review: false, // 测试订单不需要人工审核
      created_at: now,
      updated_at: now,
    };

    const orderResult = await db.collection(COLLECTIONS.ORDERS).add({ data: orderData });

    // 锁定优惠券（payCallback 标记 used；支付失败/取消/退款/过期会释放）
    if (appliedCoupon && appliedCoupon.userCouponId) {
      try {
        await db.collection(COLLECTIONS.USER_COUPONS)
          .doc(appliedCoupon.userCouponId)
          .update({ data: { status: 'locked', order_id: orderResult._id, updated_at: now } });
      } catch (e) { /* 优惠券集合可能尚未创建 */ }
    }

   // 真实支付模式：调用微信支付（instantPaid=true 时跳过：mock 或券全额抵扣免单）
   if (!instantPaid) {
     try {
       const payParams = await createWechatPayment(outTradeNo, payAmount, openid,
         (memberTier.includes('yearly') ? '年卡' : '月卡') + '会员购买');
       return {
         code: RESPONSE_CODE.SUCCESS,
         msg: '会员订单创建成功',
         data: {
           orderId: orderResult._id,
           outTradeNo,
           status: ORDER_STATUS.PENDING,
           amount: payAmount,
           amountDisplay: (payAmount / 100).toFixed(2),
           memberTier,
           couponDiscount: couponDiscount,
           payParams: payParams
         },
       };
     } catch (payErr) {
       console.error('[createOrder] 统一下单失败:', payErr.message);
       // 支付失败：删除订单并释放已锁定的优惠券
       await db.collection(COLLECTIONS.ORDERS).doc(orderResult._id).remove();
       if (appliedCoupon && appliedCoupon.userCouponId) {
         try {
           await db.collection(COLLECTIONS.USER_COUPONS).doc(appliedCoupon.userCouponId)
             .update({ data: { status: 'unused', order_id: '', updated_at: new Date() } });
         } catch (_) {}
       }
       return { code: RESPONSE_CODE.SERVER_ERROR, msg: '支付通道暂不可用，请稍后重试', data: {} };
     }
   }

   // mock_pay 模式：订单已标记 PAID，但没有微信回调触发会员激活。
   // 主动调用 payCallback 分发业务（激活会员/到账点数），否则会员记录不会更新。
   // S6 加固：payCallback 云函数间调用可能超时/失败，调用后校验会员是否真正激活，
   // 未激活则内联兜底执行激活逻辑，确保 mock 模式下会员状态一致。
   if (instantPaid) {
     let activated = false;
     try {
       console.log('[createOrder] ' + (isFreeOrder ? '免单(券全额抵扣)' : 'mock_pay') + '模式，主动触发 payCallback 激活会员:', orderResult._id);
       await cloud.callFunction({
         name: 'payCallback',
         data: {
           out_trade_no: outTradeNo,
           transaction_id: transactionId,
           result_code: 'SUCCESS'
         }
       });
       // 校验会员是否真正激活（type 已切换为目标类型）
       const verifyRes = await db.collection(COLLECTIONS.MEMBERS)
         .where({ user_id: openid, status: MEMBER_STATUS.ACTIVE })
         .limit(1)
         .get();
       const vm = verifyRes.data && verifyRes.data[0];
       if (vm && vm.type === memberTier && vm.activated_by_order === orderResult._id) {
         activated = true;
         console.log('[createOrder] mock_pay 激活校验通过:', memberTier);
       } else {
         console.warn('[createOrder] mock_pay 激活校验失败，预期 type=' + memberTier +
           ' 实际 type=' + (vm ? vm.type : 'null') + '，执行内联兜底');
       }
     } catch (cbErr) {
       console.error('[createOrder] mock_pay payCallback 调用异常:', cbErr.message);
     }
     // 兜底：payCallback 未成功激活时，内联执行激活逻辑
     if (!activated) {
       try {
         await inlineActivateMember(openid, memberTier, orderResult._id);
         await db.collection(COLLECTIONS.ORDERS).doc(orderResult._id).update({
           data: { dispatch_status: 'completed', dispatched_at: new Date(), updated_at: new Date() }
         });
         console.log('[createOrder] mock_pay 内联激活成功:', memberTier);
       } catch (inlineErr) {
         console.error('[createOrder] mock_pay 内联激活失败:', inlineErr.message);
         await db.collection(COLLECTIONS.ORDERS).doc(orderResult._id).update({
           data: { dispatch_status: 'failed', dispatch_error: inlineErr.message, updated_at: new Date() }
         }).catch(() => {});
       }
     }
   }

   return {
     code: RESPONSE_CODE.SUCCESS,
     msg: '会员订单创建成功',
     data: {
       orderId: orderResult._id,
       outTradeNo,
       status: orderData.status,
       amount: payAmount,
       amountDisplay: (payAmount / 100).toFixed(2),
       memberTier,
       couponDiscount: couponDiscount,
     },
   };
  } catch (error) {
    console.error('创建会员订单失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '创建会员订单失败', data: {} };
  }
}


/**
 * mock_pay 兜底：内联激活会员（当 payCallback 云函数间调用失败时使用）
 * 复用统一激活服务 common/activation-service.js，与 payCallback 保持一致，避免逻辑漂移
 */
async function inlineActivateMember(openid, memberTier, orderId) {
  // MEMBER_CREDITS 已在入口被 Object.assign 为 DB 动态值，作为 dbCredits 传入
  await activateMembership({
    db,
    _,
    dbCredits: MEMBER_CREDITS,
    openid,
    memberType: memberTier,
    orderId
  });
}

/**
 * 点数包订单处理
 */
async function handlePointsOrder(event, openid, mockPay) {
  const packType = event.packType || 'PACK_3';
  const pack = POINTS_PACKS[packType];
  if (!pack) {
    return { code: RESPONSE_CODE.ERROR, msg: '无效的点数包类型', data: {} };
  }

  const now = new Date();
  const outTradeNo = 'WELL_POINTS_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const description = `${pack.count} 次点数包购买`;

  try {
    // 自动选最优优惠券（用户指定 couponId 优先；金额>0 才选）
    let appliedCoupon = null;
    if (pack.price > 0) {
      try {
        appliedCoupon = await autoSelectCoupon(openid, pack.price, ORDER_TYPES.POINTS, event.couponId || null);
      } catch (couponErr) {
        console.warn('[createOrder] 点数优惠券查询跳过:', couponErr.message);
      }
    }
    const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
    const payAmount = Math.max(pack.price - couponDiscount, 0);
    const isFreeOrder = payAmount === 0;          // 券全额抵扣 → 免单
    const instantPaid = mockPay || isFreeOrder;   // 立即付清（不走微信支付）
    const transactionId = instantPaid ? (mockPay ? 'MOCK_' : 'FREE_') + outTradeNo : '';

    const orderData = {
      user_id: openid,
      type: ORDER_TYPES.POINTS,
      status: instantPaid ? ORDER_STATUS.PAID : ORDER_STATUS.PENDING,
      amount: payAmount,
      origin_amount: pack.price,
      coupon_discount: couponDiscount,
      out_trade_no: outTradeNo,
      transaction_id: transactionId,
      description,
      // metadata 字段名与 payCallback.creditPoints 读取对齐
      metadata: {
        pack_type: packType,
        points_count: pack.count,
        expire_days: pack.expire_days,
        mock_pay: mockPay,
        coupon_user_id: appliedCoupon ? appliedCoupon.userCouponId : '',
        coupon_name: appliedCoupon ? appliedCoupon.couponName : '',
        coupon_discount: couponDiscount
      },
      paid_at: instantPaid ? now : null,
      channel: event.channel || 'mp',
      is_checked: false,
      need_manual_review: pack.price >= PRICES.MANUAL_REVIEW_THRESHOLD,
      created_at: now,
      updated_at: now,
    };

    const orderResult = await db.collection(COLLECTIONS.ORDERS).add({ data: orderData });
    const orderId = orderResult._id;

    // 锁定优惠券（真实支付由 payCallback 标 used；失败/取消/退款/过期释放）
    if (appliedCoupon && appliedCoupon.userCouponId) {
      try {
        await db.collection(COLLECTIONS.USER_COUPONS)
          .doc(appliedCoupon.userCouponId)
          .update({ data: { status: 'locked', order_id: orderId, updated_at: now } });
      } catch (e) { /* 优惠券集合可能尚未创建 */ }
    }

    // 立即付清（mock 或券全额抵扣免单）：直接发放点数 + 标记券已用（真实支付由 payCallback 标记）
    if (instantPaid) {
      await creditPoints(openid, pack.count, pack.expire_days, orderId);
      if (appliedCoupon && appliedCoupon.userCouponId) {
        try {
          await db.collection(COLLECTIONS.USER_COUPONS).doc(appliedCoupon.userCouponId)
            .update({ data: { status: 'used', order_id: orderId, used_at: now, updated_at: now } });
        } catch (_) {}
      }
    }

    // 真实支付模式：调用微信统一下单，返回支付参数给前端
    if (!instantPaid) {
      try {
        const payParams = await createWechatPayment(outTradeNo, payAmount, openid, description);
        return {
          code: RESPONSE_CODE.SUCCESS,
          msg: '点数包订单创建成功，请完成支付',
          data: {
            orderId,
            outTradeNo,
            status: ORDER_STATUS.PENDING,
            amount: payAmount,
            amountDisplay: (payAmount / 100).toFixed(2),
            packCount: pack.count,
            couponDiscount: couponDiscount,
            payParams,
          },
        };
      } catch (payErr) {
        console.error('[createOrder] 点数包统一下单失败:', payErr.message);
        // 支付失败：删除订单并释放已锁定的优惠券
        await db.collection(COLLECTIONS.ORDERS).doc(orderId).remove();
        if (appliedCoupon && appliedCoupon.userCouponId) {
          try {
            await db.collection(COLLECTIONS.USER_COUPONS).doc(appliedCoupon.userCouponId)
              .update({ data: { status: 'unused', order_id: '', updated_at: new Date() } });
          } catch (_) {}
        }
        return { code: RESPONSE_CODE.SERVER_ERROR, msg: '支付通道暂不可用，请稍后重试', data: {} };
      }
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '点数包订单创建成功',
      data: {
        orderId,
        outTradeNo,
        status: orderData.status,
        amount: payAmount,
        amountDisplay: (payAmount / 100).toFixed(2),
        packCount: pack.count,
        couponDiscount: couponDiscount,
      },
    };
  } catch (error) {
    console.error('创建点数包订单失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '创建点数包订单失败', data: {} };
  }
}

/**
 * 套餐订单处理 — 主订单 + 子订单拆分
 */
async function handleBundleOrder(event, openid, mockPay) {
  const bundleKey = event.bundleKey;
  const BUNDLES_CONST = {
    STARTER: {
      name: '新手礼包', price: 2990, origin_price: 3980,
      items: [
        { type: 'member', tier: 'monthly' },
        { type: 'points', pack: 'PACK_3' },
      ],
    },
    ESSENTIAL: {
      name: '铲屎官必备', price: 11900, origin_price: 12890,
      items: [
        { type: 'member', tier: 'yearly' },
        { type: 'points', pack: 'PACK_5' },
      ],
    },
    FAMILY: {
      name: '家庭尊享', price: 3990, origin_price: 4980,
      items: [
        { type: 'member', tier: 'family_monthly' },
        { type: 'points', pack: 'PACK_3' },
      ],
    },
  };

  const bundle = BUNDLES_CONST[bundleKey];
  if (!bundle) {
    return { code: RESPONSE_CODE.ERROR, msg: '无效的套餐类型', data: {} };
  }

  const now = new Date();
  const outTradeNo = 'WELL_BUNDLE_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

  try {
    const subOrders = [];

    // 创建子订单
    for (const item of bundle.items) {
      let subType, subAmount, subDesc;
      if (item.type === 'member') {
        const PRICE_MAP = {
          monthly: PRICES.MEMBER_MONTHLY, yearly: PRICES.MEMBER_YEARLY,
          family_monthly: PRICES.MEMBER_FAMILY_MONTHLY, family_yearly: PRICES.MEMBER_FAMILY_YEARLY,
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
        parent_order_id: null, // 稍后更新
        bundle_type: bundleKey,
        metadata: { bundle_item: item, mock_pay: mockPay },
        is_checked: false,
        created_at: now,
        updated_at: now,
      };

      const subResult = await db.collection(COLLECTIONS.ORDERS).add({ data: subOrder });
      subOrders.push({ order_id: subResult._id, type: subType });
    }

    // 创建主订单
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
      channel: event.channel || 'mp',
      is_checked: false,
      need_manual_review: bundle.price >= PRICES.MANUAL_REVIEW_THRESHOLD,
      created_at: now,
      updated_at: now,
    };

    const mainResult = await db.collection(COLLECTIONS.ORDERS).add({ data: mainOrderData });

    // 回写子订单的 parent_order_id
    for (const sub of subOrders) {
      await db.collection(COLLECTIONS.ORDERS).doc(sub.order_id).update({
        data: { parent_order_id: mainResult._id },
      });
    }

    // 真实支付模式：用主订单金额调微信统一下单，返回支付参数给前端
    if (!mockPay && bundle.price > 0) {
      try {
        const payParams = await createWechatPayment(outTradeNo, bundle.price, openid, bundle.name);
        return {
          code: RESPONSE_CODE.SUCCESS,
          msg: '套餐订单创建成功，请完成支付',
          data: {
            orderId: mainResult._id,
            outTradeNo,
            status: ORDER_STATUS.PENDING,
            amount: bundle.price,
            amountDisplay: (bundle.price / 100).toFixed(2),
            originAmount: bundle.origin_price,
            bundleName: bundle.name,
            subOrders,
            payParams,
          },
        };
      } catch (payErr) {
        console.error('[createOrder] 套餐统一下单失败:', payErr.message);
        // 回滚：删除主订单 + 所有子订单
        try { await db.collection(COLLECTIONS.ORDERS).doc(mainResult._id).remove(); } catch (e) { /* 忽略 */ }
        for (const sub of subOrders) {
          try { await db.collection(COLLECTIONS.ORDERS).doc(sub.order_id).remove(); } catch (e) { /* 忽略 */ }
        }
        return { code: RESPONSE_CODE.SERVER_ERROR, msg: '支付通道暂不可用，请稍后重试', data: {} };
      }
    }

   // mock_pay 模式：主订单已 PAID，主动调用 payCallback 触发套餐拆单激活（会员+点数）
   if (mockPay) {
     try {
       console.log('[createOrder] mock_pay 模式，主动触发 payCallback 激活套餐:', mainResult._id);
       await cloud.callFunction({
         name: 'payCallback',
         data: {
           out_trade_no: outTradeNo,
           transaction_id: 'MOCK_' + outTradeNo,
           result_code: 'SUCCESS'
         }
       });
     } catch (cbErr) {
       console.error('[createOrder] mock_pay 套餐激活失败:', cbErr.message);
     }
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
       originAmount: bundle.origin_price,
       bundleName: bundle.name,
       subOrders,
     },
   };
  } catch (error) {
    console.error('创建套餐订单失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '创建套餐订单失败', data: {} };
  }
}

/**
 * 发放点数到用户账户（Mock 模式或 payCallback 调用）
 */
async function creditPoints(openid, count, expireDays, orderId) {
  const now = new Date();
  const expireAt = new Date(now.getTime() + expireDays * 24 * 60 * 60 * 1000);

  // 查找或创建 user_points 记录
  const existing = await db.collection(COLLECTIONS.USER_POINTS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  if (existing.data && existing.data.length > 0) {
    const record = existing.data[0];
    await db.collection(COLLECTIONS.USER_POINTS).doc(record._id).update({
      data: {
        balance: _.inc(count),
        total_purchased: _.inc(count),
        expire_at: expireAt, // 简化：以最新购买为准
        updated_at: now,
      },
    });
  } else {
    await db.collection(COLLECTIONS.USER_POINTS).add({
      data: {
        user_id: openid,
        balance: count,
        total_purchased: count,
        total_used: 0,
        expire_at: expireAt,
        created_at: now,
        updated_at: now,
      },
    });
  }

  // 记录流水
  await db.collection(COLLECTIONS.POINT_TRANSACTIONS).add({
    data: {
      user_id: openid,
      type: 'purchase',
      amount: count,
      order_id: orderId,
      created_at: now,
    },
  });
}

// 额度解析/扣减/回滚逻辑已提取至 cloudfunctions/common/quota-service.js
// （resolveQuota / deductQuota / rollbackQuota / calcNextReset）

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
 * 自动选取最优优惠券
 * 查询用户可用券，按优惠金额从大到小排序，返回最优的一张
 *
 * @param {string} openid - 用户 openid
 * @param {number} orderAmount - 原始订单金额（分）
 * @param {string} orderType - 订单类型（report / member / points）
 * @param {string} [preferCouponId] - 用户指定的 user_coupons._id；命中且通过 type/min 校验则优先返回，否则自动选最优
 * @returns {object|null} { userCouponId, couponName, discount, couponType }
 */
async function autoSelectCoupon(openid, orderAmount, orderType, preferCouponId) {
  const now = new Date();

  // 查询用户所有未使用、未过期的优惠券
  const userCouponsResult = await db.collection(COLLECTIONS.USER_COUPONS)
    .where({
      user_id: openid,
      status: 'unused',
      expire_at: _.gt(now)
    })
    .get();

  if (!userCouponsResult.data || userCouponsResult.data.length === 0) {
    return null;
  }

  // 批量查询券模板
  const couponIds = [...new Set(userCouponsResult.data.map(uc => uc.coupon_id))];
  const templatesResult = await db.collection(COLLECTIONS.COUPONS)
    .where({
      _id: _.in(couponIds),
      is_active: true
    })
    .get();

  if (!templatesResult.data || templatesResult.data.length === 0) {
    return null;
  }

  const templates = {};
  for (const t of templatesResult.data) {
    templates[t._id] = t;
  }

  // 计算每个可用券的优惠金额，取最大
  let bestCoupon = null;
  let maxDiscount = 0;

  for (const uc of userCouponsResult.data) {
    const tmpl = templates[uc.coupon_id];
    if (!tmpl) continue;
    // 校验适用商品类型
    if (tmpl.type && tmpl.type !== 'universal' && tmpl.type !== orderType) continue;
    // 校验最低使用金额
    if (tmpl.min_amount && orderAmount < tmpl.min_amount) continue;

    let discount = 0;
    if (tmpl.discount_type === 'fixed') {
      discount = tmpl.discount_value || 0;
    } else if (tmpl.discount_type === 'percent') {
      // percent: 80 表示 8 折 => 优惠 20%
      discount = Math.floor(orderAmount * (100 - (tmpl.discount_value || 100)) / 100);
    }

    // 优惠不能超过订单金额
    discount = Math.min(discount, orderAmount);

    if (discount > maxDiscount) {
      maxDiscount = discount;
      bestCoupon = {
        userCouponId: uc._id,
        couponId: uc.coupon_id,
        couponName: tmpl.name || '优惠券',
        discount: discount,
        discountType: tmpl.discount_type
      };
    }
    // 用户指定券优先：命中即返回（已通过上方 type/min_amount 校验）
    if (preferCouponId && uc._id === preferCouponId) {
      return {
        userCouponId: uc._id,
        couponId: uc.coupon_id,
        couponName: tmpl.name || '优惠券',
        discount: discount,
        discountType: tmpl.discount_type
      };
    }
  }

  return bestCoupon;
}

/**
 * 调用微信支付统一下单 API
 * 直接在云函数中调用集成中心HTTP云函数
 *
 * @param {string} outTradeNo - 商户订单号
 * @param {number} totalFee - 支付金额（分）
 * @param {string} openid - 用户 openid
 * @param {string} body - 商品描述
 * @returns {object} 前端调起支付需要的参数 { timeStamp, nonceStr, package, signType, paySign }
 */
async function createWechatPayment(outTradeNo, totalFee, openid, body) {
  try {
    const integrationFunctionName = 'Mewora-1r02jkm1-demo-scfweb';

    console.log('[createWechatPayment] 调用支付云函数:', integrationFunctionName);

    // 调用 Event 类型支付云函数
    const result = await cloud.callFunction({
      name: integrationFunctionName,
      data: {
        action: '/wx-pay/wxpay_order',
        params: {
          description: body || 'AI健康报告',
          out_trade_no: outTradeNo,
          amount: {
            total: totalFee,  // 单位：分（正整数）
            currency: 'CNY'
          }
        },
        openid: openid  // 传递 openid
      }
    });

    console.log('[createWechatPayment] 云函数返回:', result);

    const responseData = result.result || result;

    if (responseData.code !== 0) {
      throw new Error(`下单失败: ${responseData.msg}`);
    }

    const payment = responseData.data || responseData;

    return {
      timeStamp: String(payment.timeStamp),
      nonceStr: payment.nonceStr,
      package: payment.package || `prepay_id=${payment.prepay_id}`,
      signType: payment.signType || 'RSA',
      paySign: payment.paySign
    };
  } catch (error) {
    console.error('[createWechatPayment] 调用失败:', error);
    throw new Error(`支付通道调用失败: ${error.message}`);
  }
}
