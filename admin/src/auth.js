// 认证模块 — ES Module
// cloudbase SDK 作为外部脚本加载，通过 window 访问

import { TCB_CONFIG } from './config.js';

let _app = null;
let _ready = null;

function getCloudBaseSDK() {
  return typeof cloudbase !== 'undefined' ? cloudbase : (typeof tcb !== 'undefined' ? tcb : null);
}

export function initCloud() {
  if (_ready) return _ready;

  _ready = new Promise(function(resolve, reject) {
    try {
      clearCloudBaseCache();

      const CloudBase = getCloudBaseSDK();
      if (!CloudBase) { reject(new Error('SDK 未加载')); return; }

      _app = CloudBase.init({ env: TCB_CONFIG.env });

      _app.auth({ persistence: 'local' })
        .anonymousAuthProvider()
        .signIn()
        .then(function() {
          resolve(_app);
        })
        .catch(function() {
          resolve(_app);
        });
    } catch(e) {
      reject(e);
    }
  });

  return _ready;
}

export function getAdminToken() {
  return localStorage.getItem('adminToken') || '';
}

export function setAdminToken(token) {
  localStorage.setItem('adminToken', token);
}

export function isTokenExpired() {
  const expires = localStorage.getItem('tokenExpires');
  if (!expires) return true;
  return Date.now() > parseInt(expires, 10);
}

export function clearAdminAuth() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('tokenExpires');
}

// 引用 api.js 中的 cloudbase 缓存清理（避免循环依赖，重新声明）
function clearCloudBaseCache() {
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.indexOf('cloudbase') !== -1 || key.indexOf('tcb') !== -1)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
    }
  } catch(e) {
    // 静默处理
  }
}
