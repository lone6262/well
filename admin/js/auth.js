/**
 * 认证管理模块
 * 处理管理员登录、Token 验证和退出登录
 */

/**
 * 获取管理员 Token
 */
function getAdminToken() {
  return localStorage.getItem('adminToken');
}

/**
 * 设置管理员 Token
 */
function setAdminToken(token) {
  localStorage.setItem('adminToken', token);
}

/**
 * 检查 Token 是否过期
 */
function isTokenExpired() {
  const expires = localStorage.getItem('tokenExpires');
  if (!expires) return true;
  return Date.now() > parseInt(expires);
}

/**
 * 验证登录状态
 */
function checkAuth() {
  const token = getAdminToken();
  if (!token || isTokenExpired()) {
    // Token 无效或过期，跳转到登录页
    localStorage.removeItem('adminToken');
    localStorage.removeItem('tokenExpires');
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

/**
 * 退出登录
 */
function logout() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('tokenExpires');
  window.location.href = 'index.html';
}

/**
 * 在页面加载时检查认证
 */
document.addEventListener('DOMContentLoaded', () => {
  // 如果不是登录页面，检查认证
  var path = window.location.pathname;
  if (path.endsWith('index.html') || path === '/' || path === '') {
    return; // 登录页不需要认证检查
  }
  checkAuth();

  // 绑定退出按钮
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});
