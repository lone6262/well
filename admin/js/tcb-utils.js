/**
 * CloudBase 公共工具函数
 * 提供 TCB SDK 相关的通用操作
 */

'use strict';

/** CloudBase localStorage 缓存键前缀 */
const TCB_CACHE_PREFIXES = ['cloudbase', 'tcb', '__auth'];

/**
 * 清理 CloudBase 相关的 localStorage 缓存
 * 用于避免旧缓存导致的认证问题
 */
function clearCloudBaseCache() {
  const keys = Object.keys(localStorage);
  keys.forEach(function(k) {
    if (TCB_CACHE_PREFIXES.some(function(p) { return k.indexOf(p) !== -1; })) {
      localStorage.removeItem(k);
    }
  });
}
