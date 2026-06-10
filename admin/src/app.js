// 管理后台主应用 — ES Module

import { CLOUD_FUNCTIONS } from './config.js';
import { initCloud } from './auth.js';
import { callCloudFunction, showLoading, hideLoading, showToast, handleApiError } from './api.js';
import { validateAndShow } from './validator.js';
import { openModal, closeModal } from './modal.js';
import { initArticlesModule } from './articles.js';
import { initCouponsModule } from './coupons.js';
import { initUsersModule } from './users.js';
import { initOrdersModule } from './orders.js';
import { initRefundsModule } from './refunds.js';
import { initMembersModule } from './members.js';
import { initBillsModule } from './bills.js';
import { initRiskModule } from './risk.js';
import { initStatsModule } from './stats.js';

// 页面标题映射
var TAB_TITLES = {
  dashboard: '数据统计',
  users: '用户管理',
  orders: '订单管理',
  articles: '内容管理',
  refunds: '退款管理',
  coupons: '优惠券管理',
  members: '会员管理',
  bills: '对账记录',
  risk: '风控面板',
  settings: '系统设置'
};

export function switchTab(tabName) {
  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.classList.remove('active');
    if (item.dataset.tab === tabName) {
      item.classList.add('active');
    }
  });

  // 更新内容区域
  document.querySelectorAll('.tab-content').forEach(function(content) {
    content.classList.remove('active');
  });
  var targetContent = document.getElementById('tab-' + tabName);
  if (targetContent) {
    targetContent.classList.add('active');
  }

  // 更新页面标题
  document.getElementById('pageTitle').textContent = TAB_TITLES[tabName] || '管理后台';

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
    case 'settings':
      initSettingsModule();
      break;
  }
}

async function initSettingsModule() {
  showLoading();

  try {
    var result = await callCloudFunction(CLOUD_FUNCTIONS.adminGetConfig);

    if (result.code === 0) {
      var config = result.data;

      document.getElementById('priceFirstReport').value = parseFloat(config.prices.firstReportDisplay);
      document.getElementById('priceStandardReport').value = parseFloat(config.prices.standardReportDisplay);
      document.getElementById('priceMemberMonthly').value = parseFloat(config.prices.memberMonthlyDisplay);
      document.getElementById('priceMemberYearly').value = parseFloat(config.prices.memberYearlyDisplay);

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

async function saveConfig() {
  var settingsRoot = document.getElementById('tab-settings');
  var validation = validateAndShow({
    priceFirstReport: { number: true, min: 0, message: '首份报告价格不能小于 0' },
    priceStandardReport: { number: true, min: 0, message: '标准报告价格不能小于 0' },
    priceMemberMonthly: { number: true, min: 0, message: '个人月卡价格不能小于 0' },
    priceMemberYearly: { number: true, min: 0, message: '个人年卡价格不能小于 0' },
    creditsMonthlyReports: { number: true, min: 0, message: '月卡额度不能小于 0' },
    creditsYearlyReports: { number: true, min: 0, message: '年卡额度不能小于 0' }
  }, { root: settingsRoot });

  if (!validation.valid) {
    showToast('请修正配置错误后再保存', 'error');
    return;
  }

  var updates = {
    firstReport: Math.round(parseFloat(document.getElementById('priceFirstReport').value) * 100),
    standardReport: Math.round(parseFloat(document.getElementById('priceStandardReport').value) * 100),
    memberMonthly: Math.round(parseFloat(document.getElementById('priceMemberMonthly').value) * 100),
    memberYearly: Math.round(parseFloat(document.getElementById('priceMemberYearly').value) * 100),
    monthlyReports: parseInt(document.getElementById('creditsMonthlyReports').value, 10),
    yearlyReports: parseInt(document.getElementById('creditsYearlyReports').value, 10)
  };

  showLoading('保存中...');

  try {
    var result = await callCloudFunction(CLOUD_FUNCTIONS.adminUpdateConfig, { updates: updates });

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

// 暴露到 window 以确保 onclick 属性和旧代码兼容
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.saveConfig = saveConfig;
window.initSettingsModule = initSettingsModule;
