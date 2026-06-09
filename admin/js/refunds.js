/**
 * 退款管理模块
 */

let refundsCurrentPage = 1;

/**
 * 加载退款列表
 */
async function loadRefunds(page = 1) {
  showLoading();

  try {
    const statusFilter = document.getElementById('refundStatusFilter').value;
    const result = await callCloudFunction('adminGateway', {
      action: 'getRefunds',
      page: page,
      pageSize: PAGINATION.defaultPageSize,
      status: statusFilter === 'all' ? undefined : statusFilter,
    });

    if (result.code === 0) {
      displayRefunds(result.data.refunds || []);
      if (result.data.pagination) {
        renderPagination('refundsPagination', result.data.pagination, loadRefunds);
      }
      refundsCurrentPage = page;
    } else {
      showToast(result.msg || '加载失败', 'error');
    }
  } catch (error) {
    handleApiError(error);
  } finally {
    hideLoading();
  }
}

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
            <button class="btn btn-sm btn-primary" onclick="approveRefund('${refund._id}')">批准</button>
            <button class="btn btn-sm btn-outline" onclick="rejectRefund('${refund._id}')">拒绝</button>
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
  confirmAction('确定批准此退款？退款将原路退回。', async () => {
    showLoading('处理退款中...');
    try {
      const result = await callCloudFunction('adminGateway', {
        action: 'processRefund',
        refundId: refundId,
        approved: true,
      });
      if (result.code === 0) {
        showToast('退款已批准', 'success');
        loadRefunds(refundsCurrentPage);
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

/**
 * 拒绝退款
 */
async function rejectRefund(refundId) {
  const reason = prompt('请输入拒绝原因:');
  if (!reason) return;

  showLoading('处理中...');
  try {
    const result = await callCloudFunction('adminGateway', {
      action: 'processRefund',
      refundId: refundId,
      approved: false,
      rejectReason: reason,
    });
    if (result.code === 0) {
      showToast('已拒绝退款', 'success');
      loadRefunds(refundsCurrentPage);
    } else {
      showToast(result.msg || '操作失败', 'error');
    }
  } catch (error) {
    handleApiError(error);
  } finally {
    hideLoading();
  }
}

/**
 * 初始化退款管理
 */
function initRefundsModule() {
  document.getElementById('refundStatusFilter').addEventListener('change', () => {
    loadRefunds(1);
  });
  loadRefunds(1);
}
