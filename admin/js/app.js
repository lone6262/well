/**
 * 管理后台主应用文件
 * 处理页面导航和模块初始化
 */

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN');
}

/**
 * 格式化日期时间
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
}

/**
 * 格式化数字
 */
function formatNumber(num) {
  if (num == null) return '0';
  return num.toLocaleString('zh-CN');
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 渲染分页
 */
function renderPagination(containerId, pagination, callback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { page, pageSize, total, totalPages } = pagination;

  let html = '';

  // 上一页
  html += `<button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">上一页</button>`;

  // 页码
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);

  if (startPage > 1) {
    html += `<button class="page-btn" data-page="1">1</button>`;
    if (startPage > 2) {
      html += `<span class="page-info">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span class="page-info">...</span>`;
    }
    html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // 下一页
  html += `<button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">下一页</button>`;

  // 信息
  html += `<span class="page-info">共 ${total} 条</span>`;

  container.innerHTML = html;

  // 绑定事件
  container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page);
      callback(page);
    });
  });
}

/**
 * 打开弹窗
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
  }
}

/**
 * 关闭弹窗
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * 切换 Tab
 */
function switchTab(tabName) {
  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.tab === tabName) {
      item.classList.add('active');
    }
  });

  // 更新内容区域
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  const targetContent = document.getElementById(`tab-${tabName}`);
  if (targetContent) {
    targetContent.classList.add('active');
  }

  // 更新页面标题
  const titles = {
    dashboard: '数据统计',
    users: '用户管理',
    orders: '订单管理',
    articles: '内容管理',
    settings: '系统设置'
  };
  document.getElementById('pageTitle').textContent = titles[tabName] || '管理后台';

  // 加载对应模块数据
  switch (tabName) {
    case 'dashboard':
      initStatsModule();
      break;
    case 'users':
      initUsersModule();
      break;
    case 'orders':
      initOrdersModule();
      break;
    case 'articles':
      initArticlesModule();
      break;
    case 'settings':
      initSettingsModule();
      break;
  }
}

/**
 * 初始化设置模块
 */
async function initSettingsModule() {
  showLoading();

  try {
    const result = await callCloudFunction(CLOUD_FUNCTIONS.adminGetConfig);

    if (result.code === 0) {
      const config = result.data;

      // 填充价格设置
      document.getElementById('priceFirstReport').value = parseFloat(config.prices.firstReportDisplay);
      document.getElementById('priceStandardReport').value = parseFloat(config.prices.standardReportDisplay);
      document.getElementById('priceMemberMonthly').value = parseFloat(config.prices.memberMonthlyDisplay);
      document.getElementById('priceMemberYearly').value = parseFloat(config.prices.memberYearlyDisplay);

      // 填充额度设置
      document.getElementById('creditsMonthlyReports').value = config.memberCredits.monthlyReports;
      document.getElementById('creditsYearlyReports').value = config.memberCredits.yearlyReports;
    } else {
      showToast(result.msg || '加载配置失败', 'error');
    }
  } catch (error) {
    handleApiError(error);
  } finally {
    hideLoading();
  }
}

/**
 * 保存配置
 */
async function saveConfig() {
  const updates = {
    firstReport: Math.round(parseFloat(document.getElementById('priceFirstReport').value) * 100),
    standardReport: Math.round(parseFloat(document.getElementById('priceStandardReport').value) * 100),
    memberMonthly: Math.round(parseFloat(document.getElementById('priceMemberMonthly').value) * 100),
    memberYearly: Math.round(parseFloat(document.getElementById('priceMemberYearly').value) * 100),
    monthlyReports: parseInt(document.getElementById('creditsMonthlyReports').value),
    yearlyReports: parseInt(document.getElementById('creditsYearlyReports').value)
  };

  showLoading('保存中...');

  try {
    const result = await callCloudFunction(CLOUD_FUNCTIONS.adminUpdateConfig, { updates });

    if (result.code === 0) {
      showToast('配置保存成功', 'success');
    } else {
      showToast(result.msg || '保存失败', 'error');
    }
  } catch (error) {
    handleApiError(error);
  } finally {
    hideLoading();
  }
}

/**
 * 初始化应用
 */
document.addEventListener('DOMContentLoaded', () => {
  // 初始化云开发
  initCloud();

  // 导航点击事件
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab || item.getAttribute('href').substring(1);
      switchTab(tab);
    });
  });

  // 保存配置按钮
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', saveConfig);
  }

  // 根据当前 URL 或默认加载统计数据
  const hash = window.location.hash.substring(1) || 'dashboard';
  switchTab(hash);
});
