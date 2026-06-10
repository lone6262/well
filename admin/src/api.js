// API 调用 + UI 反馈 — ES Module

import { TCB_CONFIG, TOAST_DISPLAY_DURATION } from './config.js';
import { initCloud, getAdminToken } from './auth.js';

export function callCloudFunction(name, data) {
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

export function showLoading(message) {
  message = message || '加载中...';
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.querySelector('p').textContent = message;
    overlay.classList.remove('hidden');
  }
}

export function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

export function showToast(message, type) {
  type = type || 'info';
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = 'toast ' + type;
  toast.classList.remove('hidden');

  setTimeout(function() {
    toast.classList.add('hidden');
  }, TOAST_DISPLAY_DURATION);
}

export function handleApiError(error) {
  console.error('API 错误:', error);

  if (error && error.errCode) {
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

export function confirmAction(message, callback) {
  var overlay = document.getElementById('confirmDialog');
  var msgEl = document.getElementById('confirmMessage');
  var okBtn = document.getElementById('confirmOkBtn');
  var cancelBtn = document.getElementById('confirmCancelBtn');

  if (!overlay || !msgEl || !okBtn || !cancelBtn) {
    if (confirm(message)) { callback(); }
    return;
  }

  var previousFocus = document.activeElement;
  msgEl.textContent = message;
  overlay.classList.remove('hidden');
  okBtn.focus();

  // 清理之前的事件监听器（通过克隆节点）
  var newOk = okBtn.cloneNode(true);
  var newCancel = cancelBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  function closeDialog() {
    overlay.classList.add('hidden');
    document.removeEventListener('keydown', handleKeydown);
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      closeDialog();
    } else if (e.key === 'Enter') {
      closeDialog();
      callback();
    } else if (e.key === 'Tab') {
      var focusable = [newCancel, newOk];
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  newOk.addEventListener('click', function() {
    closeDialog();
    callback();
  });

  newCancel.addEventListener('click', closeDialog);

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) { closeDialog(); }
  });

  document.addEventListener('keydown', handleKeydown);
}
