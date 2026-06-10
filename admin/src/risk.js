// 风控面板模块 — ES Module

import { ORDER_TYPE_MAP } from './config.js';
import { callCloudFunction, showLoading, hideLoading, showToast, handleApiError, confirmAction } from './api.js';
import { formatDateTime, escapeHtml, escapeAttr } from './utils.js';

async function loadRiskStats() {
  try {
    var result = await callCloudFunction('adminGateway', { action: 'getRiskStats' });

    if (result.code === 0 && result.data) {
      var d = result.data;
      document.getElementById('riskAlertCount').textContent = d.alertCount || 0;
      document.getElementById('riskBanCount').textContent = d.banCount || 0;
      document.getElementById('riskReviewCount').textContent = d.reviewCount || 0;
    }
  } catch (error) {
    console.error('加载风控统计失败:', error);
  }
}

async function loadRiskReviewOrders() {
  try {
    var result = await callCloudFunction('adminGateway', { action: 'getRiskReviewOrders' });

    if (result.code === 0) {
      displayRiskReviewOrders(result.data.orders || []);
    } else {
      showToast(result.msg || '加载失败', 'error');
    }
  } catch (error) {
    handleApiError(error);
  }
}

function displayRiskReviewOrders(orders) {
  var tbody = document.getElementById('riskReviewTableBody');

  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无待审核订单</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(function(order) {
    var amountYuan = ((order.amount || 0) / 100).toFixed(2);
    var typeText = ORDER_TYPE_MAP[order.type] || order.type;

    return '<tr>' +
      '<td><code>' + escapeHtml((order.out_trade_no || '').substring(0, 12)) + '</code></td>' +
      '<td>' + escapeHtml(order.user_id || '').substring(0, 8) + '...</td>' +
      '<td>¥' + amountYuan + '</td>' +
      '<td>' + escapeHtml(typeText) + '</td>' +
      '<td>' + formatDateTime(order.created_at) + '</td>' +
      '<td>' +
        '<button class="btn btn-sm btn-primary" onclick="window.__risk.approveRiskOrder(\'' + escapeAttr(order._id) + '\')">放行</button> ' +
        '<button class="btn btn-sm btn-outline" onclick="window.__risk.blockRiskOrder(\'' + escapeAttr(order._id) + '\')">冻结</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

async function approveRiskOrder(orderId) {
  confirmAction('确定放行此订单？', async function() {
    showLoading('处理中...');
    try {
      var result = await callCloudFunction('adminGateway', {
        action: 'reviewOrder',
        orderId: orderId,
        approved: true,
      });
      if (result.code === 0) {
        showToast('订单已放行', 'success');
        loadRiskReviewOrders();
        loadRiskStats();
      } else {
        showToast(result.msg || '操作失败', 'error');
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      hideLoading();
    }
  });
}

async function blockRiskOrder(orderId) {
  var reason = prompt('请输入冻结原因:');
  if (!reason) return;

  showLoading('处理中...');
  try {
    var result = await callCloudFunction('adminGateway', {
      action: 'reviewOrder',
      orderId: orderId,
      approved: false,
      reason: reason,
    });
    if (result.code === 0) {
      showToast('订单已冻结', 'success');
      loadRiskReviewOrders();
      loadRiskStats();
    } else {
      showToast(result.msg || '操作失败', 'error');
    }
  } catch (error) {
    handleApiError(error);
  } finally {
    hideLoading();
  }
}

export function initRiskModule() {
  window.__risk = { approveRiskOrder: approveRiskOrder, blockRiskOrder: blockRiskOrder };
  loadRiskStats();
  loadRiskReviewOrders();
}
