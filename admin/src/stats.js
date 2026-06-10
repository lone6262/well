// 数据统计模块 — ES Module

import { CLOUD_FUNCTIONS } from './config.js';
import { callCloudFunction, showLoading, hideLoading, showToast, handleApiError } from './api.js';
import { formatNumber } from './utils.js';

async function loadStats(range) {
  range = range || 'overview';
  showLoading();

  try {
    var result = await callCloudFunction(CLOUD_FUNCTIONS.adminGetStats, { range: range });

    if (result.code === 0) {
      displayStats(result.data);
    } else {
      showToast(result.msg || '加载失败', 'error');
    }
  } catch (error) {
    handleApiError(error);
  } finally {
    hideLoading();
  }
}

function displayStats(data) {
  var overview = data.overview;

  document.getElementById('statUsersTotal').textContent = formatNumber(overview.users.total);
  document.getElementById('statUsersGrowth').textContent = '今日 +' + overview.users.today;

  document.getElementById('statRevenueTotal').textContent = formatNumber(overview.revenue.total / 100);
  document.getElementById('statRevenueToday').textContent = '今日 ¥' + formatNumber(overview.revenue.today / 100);

  document.getElementById('statOrdersTotal').textContent = formatNumber(overview.orders.total);
  document.getElementById('statOrdersPaid').textContent = '已支付 ' + overview.orders.paid;

  document.getElementById('statMembersActive').textContent = formatNumber(overview.members.active);
  document.getElementById('statMembersTotal').textContent = '总计 ' + overview.members.total;
}

export function initStatsModule() {
  loadStats('overview');

  var chartBtns = document.querySelectorAll('.chart-controls .btn');
  for (var i = 0; i < chartBtns.length; i++) {
    chartBtns[i].addEventListener('click', function(e) {
      var range = e.target.dataset.range;
      loadStats(range);
    });
  }
}
