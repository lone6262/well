// 退款管理模块 — ES Module

import { REFUND_STATUS_MAP } from './config.js';
import { callCloudFunction, showLoading, hideLoading, showToast, handleApiError } from './api.js';
import { formatDateTime, escapeHtml, escapeAttr } from './utils.js';
import { createCrudLoader, bindFilterEvents, confirmedAction } from './crud-base.js';

let refundsCurrentPage = 1;

const loadRefunds = createCrudLoader({
  loadFn: function(page, pageSize, filters) {
    return callCloudFunction('adminGateway', {
      action: 'getRefunds',
      page: page,
      pageSize: pageSize,
      status: filters.status === 'all' ? undefined : filters.status,
    });
  },
  displayFn: displayRefunds,
  paginationId: 'refundsPagination',
  dataPath: 'data.refunds',
  getState: function() { return { page: refundsCurrentPage }; },
  setState: function(state) { refundsCurrentPage = state.page; },
  getFilters: function() {
    return { status: document.getElementById('refundStatusFilter').value };
  }
});

function displayRefunds(refunds) {
  var tbody = document.getElementById('refundsTableBody');

  if (!refunds || refunds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading">暂无退款记录</td></tr>';
    return;
  }

  tbody.innerHTML = refunds.map(function(refund) {
    var statusInfo = REFUND_STATUS_MAP[refund.status] || { text: refund.status, class: 'badge-gray' };
    var amountYuan = ((refund.amount || 0) / 100).toFixed(2);

    return '<tr>' +
      '<td><code>' + escapeHtml(refund._id || '').substring(0, 12) + '</code></td>' +
      '<td>' + escapeHtml(refund.user_id || '').substring(0, 8) + '...</td>' +
      '<td><code>' + escapeHtml(refund.order_id || '').substring(0, 12) + '</code></td>' +
      '<td>¥' + amountYuan + '</td>' +
      '<td>' + escapeHtml(refund.reason || '-') + '</td>' +
      '<td><span class="badge ' + statusInfo.class + '">' + statusInfo.text + '</span></td>' +
      '<td>' + formatDateTime(refund.created_at) + '</td>' +
      '<td>' +
        (refund.status === 'pending'
          ? '<button class="btn btn-sm btn-primary" onclick="window.__refunds.approveRefund(\'' + escapeAttr(refund._id) + '\')">批准</button> ' +
            '<button class="btn btn-sm btn-outline" onclick="window.__refunds.rejectRefund(\'' + escapeAttr(refund._id) + '\')">拒绝</button>'
          : '-') +
      '</td>' +
    '</tr>';
  }).join('');
}

async function approveRefund(refundId) {
  confirmedAction('确定批准此退款？退款将原路退回。', function() {
    return callCloudFunction('adminGateway', {
      action: 'processRefund',
      refundId: refundId,
      approved: true,
    });
  }, '退款已批准', function() { loadRefunds(refundsCurrentPage); });
}

async function rejectRefund(refundId) {
  var reason = prompt('请输入拒绝原因:');
  if (!reason) return;

  var rejectReason = reason.trim();
  if (!rejectReason) {
    showToast('拒绝原因不能为空', 'error');
    return;
  }

  if (rejectReason.length > 200) {
    showToast('拒绝原因不能超过 200 个字符', 'error');
    return;
  }

  confirmedAction('确定拒绝此退款？', function() {
    return callCloudFunction('adminGateway', {
      action: 'processRefund',
      refundId: refundId,
      approved: false,
      rejectReason: rejectReason,
    });
  }, '已拒绝退款', function() { loadRefunds(refundsCurrentPage); });
}

export function initRefundsModule() {
  window.__refunds = { approveRefund: approveRefund, rejectRefund: rejectRefund };

  bindFilterEvents([
    { elementId: 'refundStatusFilter' }
  ], loadRefunds);

  loadRefunds(1);
}
