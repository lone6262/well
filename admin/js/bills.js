/**
 * 对账记录模块
 */

let billsCurrentPage = 1;

/**
 * 加载对账记录
 */
async function loadBills(page = 1) {
  showLoading();

  try {
    const dateFilter = document.getElementById('billDateFilter').value;
    const result = await callCloudFunction('adminGateway', {
      action: 'getBills',
      page: page,
      pageSize: PAGINATION.defaultPageSize,
      billDate: dateFilter || undefined,
    });

    if (result.code === 0) {
      displayBills(result.data.bills || []);
      if (result.data.pagination) {
        renderPagination('billsPagination', result.data.pagination, loadBills);
      }
      billsCurrentPage = page;
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
 * 显示对账记录列表
 */
function displayBills(bills) {
  const tbody = document.getElementById('billsTableBody');

  if (!bills || bills.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">暂无对账记录</td></tr>';
    return;
  }

  tbody.innerHTML = bills.map(bill => {
    const totalAmount = ((bill.total_amount || 0) / 100).toFixed(2);
    const diffCount = bill.diff_orders ? bill.diff_orders.length : 0;
    const statusMap = {
      success: { text: '正常', class: 'badge-success' },
      mock_mode: { text: 'Mock', class: 'badge-warning' },
      failed: { text: '失败', class: 'badge-danger' },
      skipped: { text: '跳过', class: 'badge-gray' },
    };
    const statusInfo = statusMap[bill.bill_fetch_status] || { text: bill.bill_fetch_status || '-', class: 'badge-gray' };

    return `
      <tr>
        <td>${escapeHtml(bill.bill_date || '-')}</td>
        <td>${bill.total_order_count || 0}</td>
        <td>¥${totalAmount}</td>
        <td>${diffCount > 0 ? `<span class="badge badge-danger">${diffCount}</span>` : '<span class="badge badge-success">0</span>'}</td>
        <td><span class="badge ${statusInfo.class}">${statusInfo.text}</span></td>
        <td>${formatDateTime(bill.created_at)}</td>
        <td>
          ${diffCount > 0 ? `<button class="btn btn-sm btn-outline" onclick="viewBillDetail('${bill._id}')">查看差异</button>` : '-'}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 查看对账差异详情
 */
async function viewBillDetail(billId) {
  showLoading();
  try {
    const result = await callCloudFunction('adminGateway', {
      action: 'getBillDetail',
      billId: billId,
    });

    if (result.code === 0 && result.data) {
      const diffs = result.data.diff_orders || [];
      if (diffs.length === 0) {
        showToast('无差异记录', 'info');
        return;
      }

      const details = diffs.map((d, i) => {
        return [
          `--- 差异 #${i + 1} ---`,
          `订单ID: ${d.order_id}`,
          `差异类型: ${d.diff_type}`,
          `本地状态: ${d.local_status}`,
          `微信状态: ${d.wx_status || '-'}`,
          `本地金额: ${d.local_amount ? '¥' + (d.local_amount / 100).toFixed(2) : '-'}`,
          `微信金额: ${d.wx_amount ? '¥' + (d.wx_amount / 100).toFixed(2) : '-'}`,
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

/**
 * 手动触发对账
 */
async function runBillCheck() {
  const billDate = document.getElementById('billDateFilter').value || getYesterdayStr();
  confirmAction(`确定要对账 ${billDate} 的数据？`, async () => {
    showLoading('对账中，请稍候...');
    try {
      const result = await callCloudFunction('checkDailyBill', {
        billDate: billDate,
      });
      if (result.code === 0) {
        showToast(`对账完成：${result.data.totalOrders} 笔订单，${result.data.diffCount} 笔差异`, 'success');
        loadBills(1);
      } else {
        showToast(result.msg || '对账失败', 'error');
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      hideLoading();
    }
  });
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * 初始化对账模块
 */
function initBillsModule() {
  const runBtn = document.getElementById('runBillCheckBtn');
  if (runBtn) {
    runBtn.addEventListener('click', runBillCheck);
  }
  loadBills(1);
}
