/**
 * 云函数统一日志模块
 * 替代 console.log 直接调用，支持按级别控制输出 + 敏感字段脱敏
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

// 需要脱敏的敏感字段名（不区分大小写匹配）
var SENSITIVE_KEYS = ['openid', 'token', 'secret', 'password', 'phone', 'apikey', 'api_key', 'adminsecret'];

/**
 * 脱敏处理：将敏感字段的值替换为 ***
 * @param {*} obj - 需要脱敏的对象或值
 * @returns {*} 脱敏后的副本
 */
function sanitize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (obj instanceof Error) return obj.message || String(obj);

  if (Array.isArray(obj)) {
    return obj.map(function(item) { return sanitize(item); });
  }

  if (typeof obj === 'object') {
    var result = {};
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var lowerKey = key.toLowerCase();
      var isSensitive = false;
      for (var j = 0; j < SENSITIVE_KEYS.length; j++) {
        if (lowerKey.indexOf(SENSITIVE_KEYS[j]) !== -1) {
          isSensitive = true;
          break;
        }
      }
      if (isSensitive) {
        var val = obj[key];
        result[key] = (typeof val === 'string' && val.length > 4)
          ? val.substring(0, 4) + '***'
          : '***';
      } else {
        result[key] = sanitize(obj[key]);
      }
    }
    return result;
  }

  return obj;
}

function createLogger(prefix) {
  var envLevel = process.env.LOG_LEVEL || 'debug';
  var currentLevel = LOG_LEVELS[envLevel] !== undefined ? LOG_LEVELS[envLevel] : LOG_LEVELS.debug;
  var label = prefix ? '[' + prefix + ']' : '';

  return {
    debug: function() {
      if (currentLevel <= LOG_LEVELS.debug) {
        var args = Array.prototype.slice.call(arguments);
        console.log.apply(console, [label].concat(args.map(function(a) { return sanitize(a); })));
      }
    },
    info: function() {
      if (currentLevel <= LOG_LEVELS.info) {
        var args = Array.prototype.slice.call(arguments);
        console.log.apply(console, [label].concat(args.map(function(a) { return sanitize(a); })));
      }
    },
    warn: function() {
      if (currentLevel <= LOG_LEVELS.warn) {
        var args = Array.prototype.slice.call(arguments);
        console.warn.apply(console, [label].concat(args.map(function(a) { return sanitize(a); })));
      }
    },
    error: function() {
      // error 级别也进行基础脱敏（保留 Error 对象的堆栈信息用于调试）
      var args = Array.prototype.slice.call(arguments);
      var sanitizedArgs = args.map(function(a) {
        return a instanceof Error ? a : sanitize(a);
      });
      console.error.apply(console, [label].concat(sanitizedArgs));
    }
  };
}

module.exports = { createLogger, LOG_LEVELS, sanitize };
