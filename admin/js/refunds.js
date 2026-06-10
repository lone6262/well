/**
 * 退款管理模块
 */

let refundsCurrentPage = 1;

// 使用 CRUD 公共加载器
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
    return {
      status: document.getElementById('refundStatusFilter').value
    };
  }
});

/**
 * 显示退款列表
 */
function displayRefunds(refunds) {
  const tbody = document.getElementById('refundsTableBody');

  if (!refunds || refunds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading">暂无退款记录</td></tr>';
    return;
  }

  tbody.innerHTML = refunds.map(refund => {
    const statusInfo = REFUND_STATUS_MAP[refund.status] || { text: refund.status, class: 'badge-gray' };
    const amountYuan = ((refund.amount || 0) / 100).toFixed(2);

    return `
      <tr>
        <td><code>${escapeHtml(refund._id || '').substring(0, 12)}</code></td>
        <td>${escapeHtml(refund.user_id || '').substring(0, 8)}...</td>
        <td><code>${escapeHtml(refund.order_id || '').substring(0, 12)}</code></td>
        <td>¥${amountYuan}</td>
        <td>${escapeHtml(refund.reason || '-')}</td>
        <td><span class="badge ${statusInfo.class}">${statusInfo.text}</span></td>
        <td>${formatDateTime(refund.created_at)}</td>
        <td>
          ${refund.status === 'pending' ? `
            <button class="btn btn-sm btn-primary" onclick="approveRefund('${escapeAttr(refund._id)}')">批准</button>
            <button class="btn btn-sm btn-outline" onclick="rejectRefund('${escapeAttr(refund._id)}')">拒绝</button>
          ` : '-'}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 批准退款
 */
async function approveRefund(refundId) {
  confirmedAction('确定批准此退款？退款将原路退回。', function() {
    return callCloudFunction('adminGateway', {
      action: 'processRefund',
      refundId: refundId,
      approved: true,
    });
  }, '退款已批准', function() { loadRefunds(refundsCurrentPage); });
}

/**
 * 拒绝退款
 */
async function rejectRefund(refundId) {
  const reason = prompt('请输入拒绝原因:');
  if (!reason) return;

  const rejectReason = reason.trim();
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

/**
 * 初始化退款管理
 */
function initRefundsModule() {
  bindFilterEvents([
    { elementId: 'refundStatusFilter' }
  ], loadRefunds);

  loadRefunds(1);
}
