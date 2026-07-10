// 工具埋点统一封装（Phase 1）
// 支撑 Phase X 验证指标：工具打开率(tool_view)、使用率(tool_use)、到报告 CTR(tool_to_report_click)
// 设计原则：静默上报、失败忽略、不阻断业务、不强制登录（OPENID 由 trackEvent 云函数服务端解析）

const api = require('./api.js');

/**
 * 事件名常量（须与 trackEvent 云函数 VALID_EVENTS 保持一致）
 */
const EVENT = {
  VIEW: 'tool_view',
  USE: 'tool_use',
  TO_REPORT: 'tool_to_report_click'
};

/**
 * 内部上报方法
 * @param {string} toolName - 工具标识（pet_age / food_safety / poop_score / vaccine ...）
 * @param {string} eventName - 事件名
 * @param {object} [extra] - 额外属性
 */
function track(toolName, eventName, extra) {
  if (!toolName || !eventName) return;
  const properties = Object.assign({ tool_name: toolName }, extra || {});
  // api.call 始终 resolve（失败返回 {success:false}），不会产生未捕获 rejection
  api.call(
    'trackEvent',
    { eventName: eventName, properties: properties },
    { requireLogin: false }
  );
}

module.exports = {
  EVENT: EVENT,
  /** 工具页打开（onLoad 调用） */
  view: function(toolName, extra) {
    track(toolName, EVENT.VIEW, extra);
  },
  /** 工具核心功能使用（主交互处理器内调用） */
  use: function(toolName, extra) {
    track(toolName, EVENT.USE, extra);
  },
  /** 点击「查看 AI 报告」（goToReport 内调用） */
  toReport: function(toolName, extra) {
    track(toolName, EVENT.TO_REPORT, extra);
  }
};
