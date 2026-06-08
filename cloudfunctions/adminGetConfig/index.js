/**
 * 获取系统配置云函数（管理端）
 * 用于查看和修改系统价格、额度等配置
 */
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  PRICES,
  MEMBER_CREDITS,
  PAYMENT_TIMEOUT,
  warmupConfig
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
    // 获取数据库中的动态配置
    const configResult = await db.collection(COLLECTIONS.SYSTEM_CONFIG)
      .get();

    const dbConfig = {};
    for (const item of configResult.data || []) {
      // 转换 key 为驼峰命名
      const camelKey = item.key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      dbConfig[camelKey] = item.value;
    }

    // 构建完整配置（代码常量 + 数据库配置）
    const config = {
      prices: {
        firstReport: PRICES.FIRST_REPORT,
        firstReportDisplay: (PRICES.FIRST_REPORT / 100).toFixed(2),
        standardReport: PRICES.STANDARD_REPORT,
        standardReportDisplay: (PRICES.STANDARD_REPORT / 100).toFixed(2),
        memberMonthly: PRICES.MEMBER_MONTHLY,
        memberMonthlyDisplay: (PRICES.MEMBER_MONTHLY / 100).toFixed(2),
        memberYearly: PRICES.MEMBER_YEARLY,
        memberYearlyDisplay: (PRICES.MEMBER_YEARLY / 100).toFixed(2)
      },
      memberCredits: {
        monthlyReports: MEMBER_CREDITS.MONTHLY_REPORTS,
        yearlyReports: MEMBER_CREDITS.YEARLY_REPORTS
      },
      payment: {
        timeout: PAYMENT_TIMEOUT
      },
      dynamicConfig: dbConfig,
      metadata: {
        version: '1.1.0',
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
