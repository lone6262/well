/**
 * 订单管理模块
 */

let ordersCurrentPage = 1;
let ordersTotalPages = 1;
let ordersCurrentFilters = {
  status: 'all',
  type: 'all'
};

/**
 * 加载订单列表
 */
async function loadOrders(page = 1) {
  showLoading();

  try {
    const result = await callCloudFunction(CLOUD_FUNCTIONS.adminGetOrders, {
      page: page,
      pageSize: PAGINATION.defaultPageSize,
      status: ordersCurrentFilters.status,
      type: ordersCurrentFilters.type
    });

    if (result.code === 0) {
      displayOrders(result.data.orders);
      renderPagination('ordersPagination', result.data.pagination, loadOrders);
      ordersCurrentPage = page;
      ordersTotalPages = result.data.pagination.totalPages;
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
 * 显示订单列表
 */
function displayOrders(orders) {
  const tbody = document.getElementById('ordersTableBody');

  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(order => {
    const statusInfo = STATUS_MAP.order[order.status] || { text: order.status, class: 'badge-gray' };
    const typeText = ORDER_TYPE_MAP[order.type] || order.type;

    return `
      <tr>
        <td><code>${escapeHtml((order.out_trade_no || '').substring(0, 12))}...</code></td>
        <td>${escapeHtml(order.userInfo?.nickName || '未知用户')}</td>
        <td>${typeText}</td>
        <td>¥${order.amountDisplay || '0.00'}</td>
        <td><span class="badge ${statusInfo.class}">${statusInfo.text}</span></td>
        <td>${formatDateTime(order.created_at)}</td>
        <td>
          ${order.status === 'paid' ? `<button class="btn btn-sm btn-outline" onclick="refundOrder('${order._id}')">退款</button>` : '-'}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 退款订单
 */
async function refundOrder(orderId) {
  confirmAction('确定要退款此订单吗？', async () => {
    showLoading('处理中...');

    try {
      const result = await callCloudFunction(CLOUD_FUNCTIONS.adminUpdateOrder, {
        orderId: orderId,
        status: 'refunded'
      });

      if (result.code === 0) {
        showToast('退款成功', 'success');
        loadOrders(ordersCurrentPage);
      } else {
        showToast(result.msg || '退款失败', 'error');
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      hideLoading();
    }
  });
}

/**
 * 初始化订单管理
 */
function initOrdersModule() {
  // 订单状态过滤
  document.getElementById('orderStatusFilter').addEventListener('change', (e) => {
    ordersCurrentFilters.status = e.target.value;
    loadOrders(1);
  });

  // 订单类型过滤
  document.getElementById('orderTypeFilter').addEventListener('change', (e) => {
    ordersCurrentFilters.type = e.target.value;
    loadOrders(1);
  });

  // 初始加载
  loadOrders(1);
}
