/**
 * 获取价格配置云函数（公开接口，供前端调用）
 * 从 system_config 数据库动态加载，无值时回退到 constants 默认值
 */
const cloud = require('wx-server-sdk');
const { RESPONSE_CODE, warmupConfig, loadPrices, resetPrices } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  await warmupConfig(db);

  try {
    const dbPriceConfig = await loadPrices(db, { forceReload: true });
    const dbPrices = dbPriceConfig.prices;
    const dbCredits = dbPriceConfig.memberCredits;

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '获取成功',
      data: {
        // 报告价格
        firstReport: dbPrices.FIRST_REPORT,
        firstReportDisplay: (dbPrices.FIRST_REPORT / 100).toFixed(2),
        standardReport: dbPrices.STANDARD_REPORT,
        standardReportDisplay: (dbPrices.STANDARD_REPORT / 100).toFixed(2),

        // 个人会员
        monthly: {
          price: dbPrices.MEMBER_MONTHLY,
          display: (dbPrices.MEMBER_MONTHLY / 100).toFixed(2),
          renew: dbPrices.RENEW_MONTHLY,
          renewDisplay: (dbPrices.RENEW_MONTHLY / 100).toFixed(2),
          credits: dbCredits.MONTHLY_REPORTS,
        },
        yearly: {
          price: dbPrices.MEMBER_YEARLY,
          display: (dbPrices.MEMBER_YEARLY / 100).toFixed(2),
          renew: dbPrices.RENEW_YEARLY,
          renewDisplay: (dbPrices.RENEW_YEARLY / 100).toFixed(2),
          credits: dbCredits.YEARLY_REPORTS,
        },

        // 家庭会员
        familyMonthly: {
          price: dbPrices.MEMBER_FAMILY_MONTHLY,
          display: (dbPrices.MEMBER_FAMILY_MONTHLY / 100).toFixed(2),
          renew: dbPrices.RENEW_FAMILY_MONTHLY,
          renewDisplay: (dbPrices.RENEW_FAMILY_MONTHLY / 100).toFixed(2),
          credits: dbCredits.FAMILY_MONTHLY_REPORTS,
        },
        familyYearly: {
          price: dbPrices.MEMBER_FAMILY_YEARLY,
          display: (dbPrices.MEMBER_FAMILY_YEARLY / 100).toFixed(2),
          renew: dbPrices.RENEW_FAMILY_YEARLY,
          renewDisplay: (dbPrices.RENEW_FAMILY_YEARLY / 100).toFixed(2),
          credits: dbCredits.FAMILY_YEARLY_REPORTS,
        },

        // 点数包
        points: {
          pack3: {
            price: dbPrices.POINTS_PACK_3,
            display: (dbPrices.POINTS_PACK_3 / 100).toFixed(2),
            count: 3,
            expireDays: 90,
          },
          pack5: {
            price: dbPrices.POINTS_PACK_5,
            display: (dbPrices.POINTS_PACK_5 / 100).toFixed(2),
            count: 5,
            expireDays: 90,
          },
        },

        // 组合套餐
        bundles: {
          starter: {
            name: '新手礼包',
            desc: '月卡 + 3 次点数包',
            price: dbPrices.BUNDLE_STARTER,
            display: (dbPrices.BUNDLE_STARTER / 100).toFixed(2),
            originDisplay: ((dbPrices.MEMBER_MONTHLY + dbPrices.POINTS_PACK_3) / 100).toFixed(2),
            saveDisplay: (((dbPrices.MEMBER_MONTHLY + dbPrices.POINTS_PACK_3) - dbPrices.BUNDLE_STARTER) / 100).toFixed(2),
            items: ['个人月卡（' + dbCredits.MONTHLY_REPORTS + ' 次/月）', '3 次点数包（90 天有效）'],
          },
          essential: {
            name: '铲屎官必备',
            desc: '年卡 + 5 次点数包',
            price: dbPrices.BUNDLE_ESSENTIAL,
            display: (dbPrices.BUNDLE_ESSENTIAL / 100).toFixed(2),
            originDisplay: ((dbPrices.MEMBER_YEARLY + dbPrices.POINTS_PACK_5) / 100).toFixed(2),
            saveDisplay: (((dbPrices.MEMBER_YEARLY + dbPrices.POINTS_PACK_5) - dbPrices.BUNDLE_ESSENTIAL) / 100).toFixed(2),
            items: ['个人年卡（' + dbCredits.YEARLY_REPORTS + ' 次/月）', '5 次点数包（90 天有效）'],
          },
          family: {
            name: '家庭尊享',
            desc: '家庭月卡 + 3 次点数包',
            price: dbPrices.BUNDLE_FAMILY,
            display: (dbPrices.BUNDLE_FAMILY / 100).toFixed(2),
            originDisplay: ((dbPrices.MEMBER_FAMILY_MONTHLY + dbPrices.POINTS_PACK_3) / 100).toFixed(2),
            saveDisplay: (((dbPrices.MEMBER_FAMILY_MONTHLY + dbPrices.POINTS_PACK_3) - dbPrices.BUNDLE_FAMILY) / 100).toFixed(2),
            items: ['家庭月卡（' + dbCredits.FAMILY_MONTHLY_REPORTS + ' 次/月，最多 4 人共享）', '3 次点数包（90 天有效）'],
          },
        },

        // 协议用价格
        agreementPrices: {
          monthlyDisplay: (dbPrices.MEMBER_MONTHLY / 100).toFixed(2),
          yearlyDisplay: (dbPrices.MEMBER_YEARLY / 100).toFixed(2),
          monthlyCredits: dbCredits.MONTHLY_REPORTS,
        },
      },
    };
  } catch (error) {
    console.error('[getPrices] 查询失败:', error);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '服务器错误', data: {} };
  }
};
