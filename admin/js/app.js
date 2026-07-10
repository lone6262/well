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
 * 转义 HTML 属性值中的特殊字符（防止 onclick 等属性中的 XSS）
 * @param {string} str - 要转义的字符串
 * @returns {string} 转义后的安全字符串
 */
function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  html += `<span class="page-info">共 ${Number(total) || 0} 条</span>`;

  container.innerHTML = html;

  // 绑定事件
  container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page);
      callback(page);
    });
  });
}

const modalFocusState = {};

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(element => element.offsetParent !== null);
}

function trapModalFocus(modal, event) {
  if (event.key !== 'Tab') return;

  const focusable = getFocusableElements(modal);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * 打开弹窗
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modalFocusState[modalId] = document.activeElement;
  modal.classList.remove('hidden');

  const focusable = getFocusableElements(modal);
  if (focusable.length > 0) {
    focusable[0].focus();
  }

  if (!modalFocusState[modalId + 'Keydown']) {
    modalFocusState[modalId + 'Keydown'] = function(event) {
      if (event.key === 'Escape') {
        closeModal(modalId);
        return;
      }
      trapModalFocus(modal, event);
    };
  }

  document.addEventListener('keydown', modalFocusState[modalId + 'Keydown']);
}

/**
 * 关闭弹窗
 */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.add('hidden');
  if (modalFocusState[modalId + 'Keydown']) {
    document.removeEventListener('keydown', modalFocusState[modalId + 'Keydown']);
  }

  const previousFocus = modalFocusState[modalId];
  if (previousFocus && typeof previousFocus.focus === 'function') {
    previousFocus.focus();
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
    refunds: '退款管理',
    coupons: '优惠券管理',
    members: '会员管理',
    bills: '对账记录',
    risk: '风控面板',
    foods: '食物管理',
    errorlogs: '错误日志',
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
    case 'refunds':
      initRefundsModule();
      break;
    case 'coupons':
      initCouponsModule();
      break;
    case 'members':
      initMembersModule();
      break;
    case 'bills':
      initBillsModule();
      break;
    case 'risk':
      initRiskModule();
      break;
    case 'foods':
      initFoodsModule();
      break;
    case 'errorlogs':
      initErrorLogsModule();
      break;
    case 'settings':
      initSettingsModule();
      break;
  }
}

/**
 * 设置功能开关复选框（元素不存在时静默跳过）
 */
function setFlagCheckbox(elementId, value, defaultValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.checked = value === undefined || value === null ? defaultValue : !!value;
}

/**
 * 读取功能开关复选框值
 */
function getFlagCheckbox(elementId, defaultValue) {
  const el = document.getElementById(elementId);
  if (!el) return defaultValue;
  return !!el.checked;
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

      // 填充报告价格设置
      document.getElementById('priceFirstReport').value = parseFloat(config.prices.firstReportDisplay);
      document.getElementById('priceStandardReport').value = parseFloat(config.prices.standardReportDisplay);

      // 填充个人会员价格设置
      document.getElementById('priceMemberMonthly').value = parseFloat(config.prices.memberMonthlyDisplay);
      document.getElementById('priceMemberYearly').value = parseFloat(config.prices.memberYearlyDisplay);
      document.getElementById('priceRenewMonthly').value = parseFloat(config.prices.renewMonthlyDisplay);
      document.getElementById('priceRenewYearly').value = parseFloat(config.prices.renewYearlyDisplay);

      // 填充家庭会员价格设置
      document.getElementById('priceFamilyMonthly').value = parseFloat(config.prices.memberFamilyMonthlyDisplay);
      document.getElementById('priceFamilyYearly').value = parseFloat(config.prices.memberFamilyYearlyDisplay);
      document.getElementById('priceRenewFamilyMonthly').value = parseFloat(config.prices.renewFamilyMonthlyDisplay);
      document.getElementById('priceRenewFamilyYearly').value = parseFloat(config.prices.renewFamilyYearlyDisplay);

      // 填充额度设置
      document.getElementById('creditsMonthlyReports').value = config.memberCredits.monthlyReports;
      document.getElementById('creditsYearlyReports').value = config.memberCredits.yearlyReports;
      document.getElementById('creditsFamilyMonthlyReports').value = config.memberCredits.familyMonthlyReports;
      document.getElementById('creditsFamilyYearlyReports').value = config.memberCredits.familyYearlyReports;
      document.getElementById('creditsTrialReports').value = config.memberCredits.trialReports;

      // 填充功能开关（Feature Flags）
      const flags = config.featureFlags || {};
      setFlagCheckbox('flagEnableTools', flags.enable_tools, true);
      setFlagCheckbox('flagEnableFoodSearch', flags.enable_food_search, true);
      setFlagCheckbox('flagEnableShareCard', flags.enable_share_card, false);
      setFlagCheckbox('flagEnableGroup', flags.enable_group, false);
      setFlagCheckbox('flagEnablePromotion', flags.enable_promotion, false);
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
  const settingsRoot = document.getElementById('tab-settings');
  const validation = validateAndShow({
    priceFirstReport: { number: true, min: 0, message: '首份报告价格不能小于 0' },
    priceStandardReport: { number: true, min: 0, message: '标准报告价格不能小于 0' },
    priceMemberMonthly: { number: true, min: 0, message: '个人月卡价格不能小于 0' },
    priceMemberYearly: { number: true, min: 0, message: '个人年卡价格不能小于 0' },
    priceRenewMonthly: { number: true, min: 0, message: '月卡续费价格不能小于 0' },
    priceRenewYearly: { number: true, min: 0, message: '年卡续费价格不能小于 0' },
    priceFamilyMonthly: { number: true, min: 0, message: '家庭月卡价格不能小于 0' },
    priceFamilyYearly: { number: true, min: 0, message: '家庭年卡价格不能小于 0' },
    priceRenewFamilyMonthly: { number: true, min: 0, message: '家庭月卡续费价格不能小于 0' },
    priceRenewFamilyYearly: { number: true, min: 0, message: '家庭年卡续费价格不能小于 0' },
    creditsMonthlyReports: { number: true, min: 0, message: '月卡额度不能小于 0' },
    creditsYearlyReports: { number: true, min: 0, message: '年卡额度不能小于 0' },
    creditsFamilyMonthlyReports: { number: true, min: 0, message: '家庭月卡额度不能小于 0' },
    creditsFamilyYearlyReports: { number: true, min: 0, message: '家庭年卡额度不能小于 0' },
    creditsTrialReports: { number: true, min: 0, message: '体验会员额度不能小于 0' }
  }, { root: settingsRoot });

  if (!validation.valid) {
    showToast('请修正配置错误后再保存', 'error');
    return;
  }

  const updates = {
    firstReport: Math.round(parseFloat(document.getElementById('priceFirstReport').value) * 100),
    standardReport: Math.round(parseFloat(document.getElementById('priceStandardReport').value) * 100),
    memberMonthly: Math.round(parseFloat(document.getElementById('priceMemberMonthly').value) * 100),
    memberYearly: Math.round(parseFloat(document.getElementById('priceMemberYearly').value) * 100),
    renewMonthly: Math.round(parseFloat(document.getElementById('priceRenewMonthly').value) * 100),
    renewYearly: Math.round(parseFloat(document.getElementById('priceRenewYearly').value) * 100),
    memberFamilyMonthly: Math.round(parseFloat(document.getElementById('priceFamilyMonthly').value) * 100),
    memberFamilyYearly: Math.round(parseFloat(document.getElementById('priceFamilyYearly').value) * 100),
    renewFamilyMonthly: Math.round(parseFloat(document.getElementById('priceRenewFamilyMonthly').value) * 100),
    renewFamilyYearly: Math.round(parseFloat(document.getElementById('priceRenewFamilyYearly').value) * 100),
    monthlyReports: parseInt(document.getElementById('creditsMonthlyReports').value, 10),
    yearlyReports: parseInt(document.getElementById('creditsYearlyReports').value, 10),
    familyMonthlyReports: parseInt(document.getElementById('creditsFamilyMonthlyReports').value, 10),
    familyYearlyReports: parseInt(document.getElementById('creditsFamilyYearlyReports').value, 10),
    trialReports: parseInt(document.getElementById('creditsTrialReports').value, 10)
  };

  // 功能开关（Feature Flags）— 作为独立配置项写入 system_config
  updates.featureFlags = {
    enable_tools: getFlagCheckbox('flagEnableTools', true),
    enable_food_search: getFlagCheckbox('flagEnableFoodSearch', true),
    enable_share_card: getFlagCheckbox('flagEnableShareCard', false),
    enable_group: getFlagCheckbox('flagEnableGroup', false),
    enable_promotion: getFlagCheckbox('flagEnablePromotion', false),
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

  // 批量导入按钮
  const importArticlesBtn = document.getElementById('importArticlesBtn');
  if (importArticlesBtn) {
    importArticlesBtn.addEventListener('click', openImportModal);
  }

  // 批量导入弹窗关闭
  const importArticlesModalClose = document.getElementById('importArticlesModalClose');
  const importArticlesModalCancel = document.getElementById('importArticlesModalCancel');
  if (importArticlesModalClose) {
    importArticlesModalClose.addEventListener('click', () => closeModal('importArticlesModal'));
  }
  if (importArticlesModalCancel) {
    importArticlesModalCancel.addEventListener('click', () => closeModal('importArticlesModal'));
  }

  // 开始导入按钮
  const startImportBtn = document.getElementById('startImportBtn');
  if (startImportBtn) {
    startImportBtn.addEventListener('click', executeImport);
  }

  // 根据当前 URL 或默认加载统计数据
  const hash = window.location.hash.substring(1) || 'dashboard';
  switchTab(hash);
});

/**
 * 打开批量导入弹窗
 */
function openImportModal() {
  // 重置弹窗状态
  document.getElementById('importParamsInput').value = '';
  document.getElementById('importForceCheck').checked = false;
  document.getElementById('importProgress').classList.add('hidden');
  document.getElementById('importResults').classList.add('hidden');

  openModal('importArticlesModal');
}

/**
 * 执行批量导入
 */
async function executeImport() {
  const paramsInput = document.getElementById('importParamsInput').value.trim();
  const forceCheck = document.getElementById('importForceCheck').checked;

  if (!paramsInput) {
    showToast('请粘贴导入参数', 'error');
    return;
  }

  // 解析 JSON 参数
  let params;
  try {
    params = JSON.parse(paramsInput);
  } catch (error) {
    showToast('JSON 格式错误：' + error.message, 'error');
    return;
  }

  // 验证必需字段
  if (!params.action || !params.articles || !Array.isArray(params.articles)) {
    showToast('参数格式错误：缺少 action 或 articles 字段', 'error');
    return;
  }

  // 更新 force 参数
  params.force = forceCheck;

  // 显示进度
  document.getElementById('importProgress').classList.remove('hidden');
  document.getElementById('importResults').classList.add('hidden');
  updateImportProgress(0, '准备导入...');

  try {
    // 调用云函数
    const result = await callCloudFunction('adminImportKnowledge', params);

    if (result.code === 0) {
      const data = result.data;

      // 显示结果
      showImportResults(data);

      // 刷新文章列表
      if (typeof loadArticles === 'function') {
        loadArticles(1);
      }

      showToast('导入完成！', 'success');
    } else {
      showToast('导入失败：' + (result.msg || '未知错误'), 'error');
      document.getElementById('importStatusText').textContent = '导入失败';
    }
  } catch (error) {
    handleApiError(error);
    document.getElementById('importStatusText').textContent = '导入失败：' + error.message;
  }
}

/**
 * 更新导入进度
 */
function updateImportProgress(percent, text) {
  document.getElementById('importProgressBar').style.width = percent + '%';
  document.getElementById('importStatusText').textContent = text;
}

/**
 * 显示导入结果
 */
function showImportResults(data) {
  const resultsDiv = document.getElementById('importResults');
  resultsDiv.classList.remove('hidden');

  const html = `
    <div><strong>导入完成：</strong></div>
    <div>总计：${Number(data.total) || 0} 篇</div>
    <div>成功：${Number(data.success) || 0} 篇 ✅</div>
    <div>跳过：${Number(data.skipped) || 0} 篇 ⏭️</div>
    <div>失败：${Number(data.failed) || 0} 篇 ❌</div>
  `;

  resultsDiv.innerHTML = html;

  // 更新进度条到 100%
  updateImportProgress(100, '导入完成！');
}
