/**
 * 日志工具模块
 * 替换全项目中的 console.log，支持按环境控制日志级别
 *
 * 使用方式:
 *   const logger = require('../../utils/logger.js')
 *   logger.info('用户登录成功', { openid: 'xxx' })
 *   logger.warn('缓存过期')
 *   logger.error('API调用失败', error)
 *   logger.debug('详细调试信息', data)
 *
 * 环境配置:
 *   logger.setLevel('debug')   // 开发环境，输出所有日志
 *   logger.setLevel('warn')    // 生产环境，只输出警告和错误
 *   logger.setLevel('error')   // 最小输出，仅错误
 *   logger.setLevel('silent')  // 完全静默
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
};

const LEVEL_LABELS = {
  debug: '🔍 DEBUG',
  info: '📘 INFO',
  warn: '⚠️ WARN',
  error: '❌ ERROR'
};

class Logger {
  constructor() {
    // 默认开发环境输出所有日志，可通过 setLevel 调整
    this._level = LOG_LEVELS.debug;
    this._prefix = '';
  }

  /**
   * 设置日志级别
   * @param {'debug'|'info'|'warn'|'error'|'silent'} level
   */
  setLevel(level) {
    if (LOG_LEVELS.hasOwnProperty(level)) {
      this._level = LOG_LEVELS[level];
    }
  }

  /**
   * 获取当前日志级别
   */
  getLevel() {
    const entry = Object.entries(LOG_LEVELS).find(([, v]) => v === this._level);
    return entry ? entry[0] : 'debug';
  }

  /**
   * 设置日志前缀（如模块名）
   * @param {string} prefix
   */
  setPrefix(prefix) {
    this._prefix = prefix ? `[${prefix}] ` : '';
  }

  /**
   * 创建带有固定前缀的子Logger
   * @param {string} prefix
   * @returns {Logger}
   */
  createChild(prefix) {
    const child = new Logger();
    child._level = this._level;
    child._prefix = this._prefix + (prefix ? `[${prefix}] ` : '');
    return child;
  }

  _formatMessage(level, args) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const label = LEVEL_LABELS[level] || level.toUpperCase();
    return [`${timestamp} ${label} ${this._prefix}`].concat(Array.prototype.slice.call(args));
  }

  /**
   * 调试日志 — 仅在 debug 级别输出
   */
  debug() {
    if (this._level <= LOG_LEVELS.debug) {
      console.log.apply(console, this._formatMessage('debug', arguments));
    }
  }

  /**
   * 信息日志
   */
  info() {
    if (this._level <= LOG_LEVELS.info) {
      console.log.apply(console, this._formatMessage('info', arguments));
    }
  }

  /**
   * 警告日志
   */
  warn() {
    if (this._level <= LOG_LEVELS.warn) {
      console.warn.apply(console, this._formatMessage('warn', arguments));
    }
  }

  /**
   * 错误日志
   */
  error() {
    if (this._level <= LOG_LEVELS.error) {
      console.error.apply(console, this._formatMessage('error', arguments));
    }
  }
}

// 导出单例
const logger = new Logger();

// 同时导出Logger类，方便创建独立实例
logger.Logger = Logger;
logger.LOG_LEVELS = LOG_LEVELS;

/**
 * 别名：child() 等同于 createChild()
 * @param {string} prefix
 * @returns {Logger}
 */
logger.child = (prefix) => logger.createChild(prefix);

module.exports = logger;
