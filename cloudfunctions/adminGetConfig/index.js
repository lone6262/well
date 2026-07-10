/**
 * 获取系统配置云函数（管理端）
 * 用于查看和修改系统价格、额度等配置
 *
 * V2.0: 价格从 system_config 数据库动态加载，数据库无值时回退到 constants 默认值
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  PAYMENT_TIMEOUT,
  MEMBER_LIMITS,
  warmupConfig,
  loadPrices,
  resetPrices
} = require('./common/constants');
const { validateAdminRequest } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 获取系统配置
 */
exports.main = async (event, context) => {
  await warmupConfig(db);

  console.log('[adminGetConfig] 获取系统配置请求');

  // 验证管理员权限
  const auth = validateAdminRequest(event);
  if (!auth.valid) {
    return {
      code: RESPONSE_CODE.UNAUTHORIZED,
      msg: auth.error,
      data: {}
    };
  }

  try {
    // 每次调用强制从数据库重新加载（不命中内存缓存）
    const dbPriceConfig = await loadPrices(db, { forceReload: true });

    // 读取 Feature Flags 配置
    let featureFlags = {};
    try {
      const flagResult = await db.collection(COLLECTIONS.SYSTEM_CONFIG)
        .where({ key: 'feature_flags' })
        .limit(1)
        .get();
      if (flagResult.data && flagResult.data.length > 0) {
        const raw = flagResult.data[0].value;
        featureFlags = (typeof raw === 'string') ? JSON.parse(raw) : (raw || {});
      }
    } catch (e) {
      console.warn('[adminGetConfig] feature_flags 读取失败:', e.message);
    }
    const dbPrices = dbPriceConfig.prices;
    const dbCredits = dbPriceConfig.memberCredits;

    // 构建完整配置（所有价格以分为单位存储，display 字段为元）
    const config = {
      prices: {
        // 报告价格
        firstReport: dbPrices.FIRST_REPORT,
        firstReportDisplay: (dbPrices.FIRST_REPORT / 100).toFixed(2),
        standardReport: dbPrices.STANDARD_REPORT,
        standardReportDisplay: (dbPrices.STANDARD_REPORT / 100).toFixed(2),

        // 个人会员
        memberMonthly: dbPrices.MEMBER_MONTHLY,
        memberMonthlyDisplay: (dbPrices.MEMBER_MONTHLY / 100).toFixed(2),
        memberYearly: dbPrices.MEMBER_YEARLY,
        memberYearlyDisplay: (dbPrices.MEMBER_YEARLY / 100).toFixed(2),

        // 个人续费
        renewMonthly: dbPrices.RENEW_MONTHLY,
        renewMonthlyDisplay: (dbPrices.RENEW_MONTHLY / 100).toFixed(2),
        renewYearly: dbPrices.RENEW_YEARLY,
        renewYearlyDisplay: (dbPrices.RENEW_YEARLY / 100).toFixed(2),

        // 家庭会员
        memberFamilyMonthly: dbPrices.MEMBER_FAMILY_MONTHLY,
        memberFamilyMonthlyDisplay: (dbPrices.MEMBER_FAMILY_MONTHLY / 100).toFixed(2),
        memberFamilyYearly: dbPrices.MEMBER_FAMILY_YEARLY,
        memberFamilyYearlyDisplay: (dbPrices.MEMBER_FAMILY_YEARLY / 100).toFixed(2),

        // 家庭续费
        renewFamilyMonthly: dbPrices.RENEW_FAMILY_MONTHLY,
        renewFamilyMonthlyDisplay: (dbPrices.RENEW_FAMILY_MONTHLY / 100).toFixed(2),
        renewFamilyYearly: dbPrices.RENEW_FAMILY_YEARLY,
        renewFamilyYearlyDisplay: (dbPrices.RENEW_FAMILY_YEARLY / 100).toFixed(2),
      },
      memberCredits: {
        monthlyReports: dbCredits.MONTHLY_REPORTS,
        yearlyReports: dbCredits.YEARLY_REPORTS,
        familyMonthlyReports: dbCredits.FAMILY_MONTHLY_REPORTS,
        familyYearlyReports: dbCredits.FAMILY_YEARLY_REPORTS,
        trialReports: dbCredits.TRIAL_REPORTS,
      },
      memberLimits: {
        maxPetsPersonal: MEMBER_LIMITS.MAX_PETS_PERSONAL,
        maxPetsFamily: MEMBER_LIMITS.MAX_PETS_FAMILY,
        maxFamilyMembers: MEMBER_LIMITS.MAX_FAMILY_MEMBERS,
      },
      payment: {
        timeout: PAYMENT_TIMEOUT
      },
      featureFlags: featureFlags,
      metadata: {
        version: '2.0.0',
        lastUpdate: new Date().toISOString()
      }
    };

    console.log('[adminGetConfig] 配置获取成功');

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: config
    };

  } catch (error) {
    console.error('[adminGetConfig] 查询失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '查询失败，请稍后重试',
      data: {}
    };
  }
};
