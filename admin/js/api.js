/**
 * API 调用封装模块
 * CloudBase SDK 匿名登录 + callFunction
 */

var _app = null;
var _ready = null;
var _env = (typeof TCB_CONFIG !== 'undefined') ? TCB_CONFIG.env : ''; //云环境ID

function initCloud() {
  if (_ready) return _ready;

  _ready = new Promise(function(resolve, reject) {
    try {
      ['cloudbase', 'tcb', '__auth'].forEach(function(prefix) {
        Object.keys(localStorage).forEach(function(k) {
          if (k.indexOf(prefix) !== -1) localStorage.removeItem(k);
        });
      });

      var CloudBase = typeof cloudbase !== 'undefined' ? cloudbase : (typeof tcb !== 'undefined' ? tcb : null);
      if (!CloudBase) { reject(new Error('SDK 未加载')); return; }

      _app = CloudBase.init({ env: _env });

      _app.auth({ persistence: 'local' })
        .anonymousAuthProvider()
        .signIn()
        .then(function() {
          console.log('[api] 匿名登录成功');
          resolve(_app);
        })
        .catch(function() {
          console.warn('[api] 匿名登录失败，继续尝试');
          resolve(_app);
        });
    } catch(e) {
      reject(e);
    }
  });

  return _ready;
}

function callCloudFunction(name, data) {
  data = data || {};

  return initCloud().then(function(app) {
    return app.callFunction({
      name: name,
      data: Object.assign({}, data, { adminToken: getAdminToken() })
    });
  }).then(function(result) {
    return result.result;
  }).catch(function(error) {
    console.error('云函数调用失败 [' + name + ']:', error);
    throw error;
  });
}

/**
 * 显示加载状态
 */
function showLoading(message = '加载中...') {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.querySelector('p').textContent = message;
    overlay.classList.remove('hidden');
  }
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

/**
 * 显示消息提示
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

/**
 * 处理 API 错误
 */
function handleApiError(error) {
  console.error('API 错误:', error);

  if (error && error.errCode) {
    // 云函数错误
    switch (error.errCode) {
      case 'FUNCTION_NOT_FOUND':
        showToast('云函数不存在，请检查配置', 'error');
        break;
      default:
        showToast('操作失败，请稍后重试', 'error');
    }
  } else {
    showToast('网络错误，请检查连接', 'error');
  }

  hideLoading();
}

/**
 * 确认对话框
 */
function confirmAction(message, callback) {
  if (confirm(message)) {
    callback();
  }
}
