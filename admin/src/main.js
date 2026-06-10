// 管理后台入口文件
import './globals.js';
import { initCloud } from './auth.js';
import { switchTab } from './app.js';

document.addEventListener('DOMContentLoaded', function() {
  // 初始化云开发
  initCloud().catch(function(err) {
    console.error('CloudBase 初始化失败:', err);
  });

  // 导航点击事件
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      var tab = item.dataset.tab || item.getAttribute('href').substring(1);
      switchTab(tab);
    });
  });

  // 保存配置按钮
  var saveConfigBtn = document.getElementById('saveConfigBtn');
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', function() {
      // saveConfig is globally exposed by app.js
      if (typeof window.saveConfig === 'function') {
        window.saveConfig();
      }
    });
  }

  // 退出登录按钮
  var logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('tokenExpires');
      window.location.reload();
    });
  }

  // 根据当前 URL hash 或默认加载
  var hash = window.location.hash.substring(1) || 'dashboard';
  switchTab(hash);
});
