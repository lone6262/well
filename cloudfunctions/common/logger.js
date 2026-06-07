/**
 * 云函数统一日志模块
 * 替代 console.log 直接调用，支持按级别控制输出
 *
 * 使用方式：
 *   const { createLogger } = require('../common/logger');
 *   const logger = createLogger('createOrder');
 *   logger.info('订单创建成功', { orderId: 'xxx' });
 *   logger.error('扣款失败', error);
 *
 * 生产环境建议：
 *   process.env.LOG_LEVEL = 'warn'  # 只输出警告和错误
 *   process.env.LOG_LEVEL = 'error' # 只输出错误
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
};

function createLogger(prefix) {
  const envLevel = process.env.LOG_LEVEL || 'debug';
  const currentLevel = LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : LOG_LEVELS.debug;
  const label = prefix ? `[${prefix}]` : '';

  return {
    debug: function() {
      if (currentLevel <= LOG_LEVELS.debug) {
        console.log(label, ...arguments);
      }
    },
    info: function() {
      if (currentLevel <= LOG_LEVELS.info) {
        console.log(label, ...arguments);
      }
    },
    warn: function() {
      if (currentLevel <= LOG_LEVELS.warn) {
        console.warn(label, ...arguments);
      }
    },
    error: function() {
      if (currentLevel <= LOG_LEVELS.error) {
        console.error(label, ...arguments);
      }
    }
  };
}

module.exports = { createLogger, LOG_LEVELS };
