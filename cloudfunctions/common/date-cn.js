/**
 * 中国时区（UTC+8）日期工具
 *
 * 云函数容器默认时区为 UTC，日记生成 / featured_date 等场景需统一按北京时间计算，
 * 否则日期边界会错位 8 小时。所有云函数日期处理一律走这里。
 *
 * 使用方式：
 *   const { cnDateStr, cnYesterdayRange } = require('./common/date-cn');
 */

const CN_OFFSET_MS = 8 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** 当前北京时间（已偏移到 UTC+8，取值时用 getUTC* 系列方法） */
function cnNow() {
  return new Date(Date.now() + CN_OFFSET_MS);
}

/** 北京日期字符串 YYYY-MM-DD */
function cnDateStr() {
  const d = cnNow();
  return (
    d.getUTCFullYear() +
    '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

/**
 * 北京时间"昨天"的范围，返回 UTC Date，可直接用于 db.command.gte / lt。
 * 区间 = [北京昨天 00:00, 北京今天 00:00)，即北京时间昨天的完整一天。
 */
function cnYesterdayRange() {
  const cnNowMs = Date.now() + CN_OFFSET_MS;
  const cnTodayMidnightMs = Math.floor(cnNowMs / ONE_DAY_MS) * ONE_DAY_MS;
  const cnTodayMidnightUtcMs = cnTodayMidnightMs - CN_OFFSET_MS;
  return {
    start: new Date(cnTodayMidnightUtcMs - ONE_DAY_MS), // 北京昨天 00:00
    end: new Date(cnTodayMidnightUtcMs), // 北京今天 00:00
  };
}

module.exports = { cnNow, cnDateStr, cnYesterdayRange };
