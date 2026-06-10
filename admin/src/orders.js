// 订单管理模块 — ES Module

import { CLOUD_FUNCTIONS, STATUS_MAP, ORDER_TYPE_MAP } from './config.js';
import { callCloudFunction, showLoading, hideLoading, showToast, handleApiError } from './api.js';
import { formatDateTime, escapeHtml, escapeAttr } from './utils.js';
import { createCrudLoader, bindFilterEvents, confirmedAction } from './crud-base.js';

let ordersCurrentPage = 1;

const loadOrders = createCrudLoader({
  loadFn: function(page, pageSize, filters) {
    return callCloudFunction(CLOUD_FUNCTIONS.adminGetOrders, {
      page: page,
      pageSize: pageSize,
      status: filters.status || 'all',
      type: filters.type || 'all'
    });
  },
  displayFn: displayOrders,
  paginationId: 'ordersPagination',
  dataPath: 'data.orders',
  getState: function() { return { page: ordersCurrentPage }; },
  setState: function(state) { ordersCurrentPage = state.page; },
  getFilters: function() {
    return {
      status: document.getElementById('orderStatusFilter').value,
      type: document.getElementById('orderTypeFilter').value
    };
  }
});

function displayOrders(orders) {
  var tbody = document.getElementById('ordersTableBody');

  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(function(order) {
    var statusInfo = STATUS_MAP.order[order.status] || { text: order.status, class: 'badge-gray' };
    var typeText = ORDER_TYPE_MAP[order.type] || order.type;

    return '<tr>' +
      '<td><code>' + escapeHtml((order.out_trade_no || '').substring(0, 12)) + '...</code></td>' +
      '<td>' + escapeHtml(order.userInfo ? order.userInfo.nickName || '未知用户' : '未知用户') + '</td>' +
      '<td>' + escapeHtml(typeText) + '</td>' +
      '<td>¥' + (order.amountDisplay || '0.00') + '</td>' +
      '<td><span class="badge ' + statusInfo.class + '">' + escapeHtml(statusInfo.text) + '</span></td>' +
      '<td>' + formatDateTime(order.created_at) + '</td>' +
      '<td>' +
        (order.status === 'paid'
          ? '<button class="btn btn-sm btn-outline" onclick="window.__orders.refundOrder(\'' + escapeAttr(order._id) + '\')">退款</button>'
          : '-') +
      '</td>' +
    '</tr>';
  }).join('');
}

async function refundOrder(orderId) {
  confirmedAction('确定要退款此订单吗？', function() {
    return callCloudFunction(CLOUD_FUNCTIONS.adminUpdateOrder, {
      orderId: orderId,
      status: 'refunded'
    });
  }, '退款成功', function() { loadOrders(ordersCurrentPage); });
}

export function initOrdersModule() {
  window.__orders = { refundOrder: refundOrder };

  bindFilterEvents([
    { elementId: 'orderStatusFilter' },
    { elementId: 'orderTypeFilter' }
  ], loadOrders);

  loadOrders(1);
}
