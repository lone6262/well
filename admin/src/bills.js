// 对账记录模块 — ES Module

import { callCloudFunction, showLoading, hideLoading, showToast, handleApiError } from './api.js';
import { formatDateTime, escapeHtml, escapeAttr } from './utils.js';
import { createCrudLoader, confirmedAction } from './crud-base.js';

let billsCurrentPage = 1;

const loadBills = createCrudLoader({
  loadFn: function(page, pageSize, filters) {
    return callCloudFunction('adminGateway', {
      action: 'getBills',
      page: page,
      pageSize: pageSize,
      billDate: filters.date || undefined,
    });
  },
  displayFn: displayBills,
  paginationId: 'billsPagination',
  dataPath: 'data.bills',
  getState: function() { return { page: billsCurrentPage }; },
  setState: function(state) { billsCurrentPage = state.page; },
  getFilters: function() {
    return { date: document.getElementById('billDateFilter').value };
  }
});

function displayBills(bills) {
  var tbody = document.getElementById('billsTableBody');

  if (!bills || bills.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">暂无对账记录</td></tr>';
    return;
  }

  var statusMap = {
    success: { text: '正常', class: 'badge-success' },
    mock_mode: { text: 'Mock', class: 'badge-warning' },
    failed: { text: '失败', class: 'badge-danger' },
    skipped: { text: '跳过', class: 'badge-gray' },
  };

  tbody.innerHTML = bills.map(function(bill) {
    var totalAmount = ((bill.total_amount || 0) / 100).toFixed(2);
    var diffCount = bill.diff_orders ? bill.diff_orders.length : 0;
    var statusInfo = statusMap[bill.bill_fetch_status] || { text: bill.bill_fetch_status || '-', class: 'badge-gray' };

    return '<tr>' +
      '<td>' + escapeHtml(bill.bill_date || '-') + '</td>' +
      '<td>' + (bill.total_order_count || 0) + '</td>' +
      '<td>¥' + totalAmount + '</td>' +
      '<td>' + (diffCount > 0 ? '<span class="badge badge-danger">' + diffCount + '</span>' : '<span class="badge badge-success">0</span>') + '</td>' +
      '<td><span class="badge ' + statusInfo.class + '">' + statusInfo.text + '</span></td>' +
      '<td>' + formatDateTime(bill.created_at) + '</td>' +
      '<td>' +
        (diffCount > 0 ? '<button class="btn btn-sm btn-outline" onclick="window.__bills.viewBillDetail(\'' + escapeAttr(bill._id) + '\')">查看差异</button>' : '-') +
      '</td>' +
    '</tr>';
  }).join('');
}

async function viewBillDetail(billId) {
  showLoading();
  try {
    var result = await callCloudFunction('adminGateway', {
      action: 'getBillDetail',
      billId: billId,
    });

    if (result.code === 0 && result.data) {
      var diffs = result.data.diff_orders || [];
      if (diffs.length === 0) {
        showToast('无差异记录', 'info');
        return;
      }

      var details = diffs.map(function(d, i) {
        return [
          '--- 差异 #' + (i + 1) + ' ---',
          '订单ID: ' + d.order_id,
          '差异类型: ' + d.diff_type,
          '本地状态: ' + d.local_status,
          '微信状态: ' + (d.wx_status || '-'),
          '本地金额: ' + (d.local_amount ? '¥' + (d.local_amount / 100).toFixed(2) : '-'),
          '微信金额: ' + (d.wx_amount ? '¥' + (d.wx_amount / 100).toFixed(2) : '-'),
        ].join('\n');
      }).join('\n\n');

      alert(details);
    } else {
      showToast(result.msg || '加载失败', 'error');
    }
  } catch (error) {
    handleApiError(error);
  } finally {
    hideLoading();
  }
}

function getYesterdayStr() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

async function runBillCheck() {
  var billDate = document.getElementById('billDateFilter').value || getYesterdayStr();
  confirmedAction('确定要对账 ' + billDate + ' 的数据？', function() {
    return callCloudFunction('checkDailyBill', { billDate: billDate });
  }, function(result) {
    return '对账完成：' + result.data.totalOrders + ' 笔订单，' + result.data.diffCount + ' 笔差异';
  }, function() { loadBills(1); });
}

export function initBillsModule() {
  window.__bills = { viewBillDetail: viewBillDetail };

  var runBtn = document.getElementById('runBillCheckBtn');
  if (runBtn) {
    runBtn.addEventListener('click', runBillCheck);
  }
  loadBills(1);
}
