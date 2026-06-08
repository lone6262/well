/**
 * 数据统计模块
 */

/**
 * 加载统计数据
 */
async function loadStats(range = 'overview') {
  showLoading();

  try {
    const result = await callCloudFunction(CLOUD_FUNCTIONS.adminGetStats, { range });

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

/**
 * 显示统计数据
 */
function displayStats(data) {
  const overview = data.overview;

  // 用户统计
  document.getElementById('statUsersTotal').textContent = formatNumber(overview.users.total);
  document.getElementById('statUsersGrowth').textContent = `今日 +${overview.users.today}`;

  // 收入统计
  document.getElementById('statRevenueTotal').textContent = formatNumber(overview.revenue.total / 100);
  document.getElementById('statRevenueToday').textContent = `今日 ¥${formatNumber(overview.revenue.today / 100)}`;

  // 订单统计
  document.getElementById('statOrdersTotal').textContent = formatNumber(overview.orders.total);
  document.getElementById('statOrdersPaid').textContent = `已支付 ${overview.orders.paid}`;

  // 会员统计
  document.getElementById('statMembersActive').textContent = formatNumber(overview.members.active);
  document.getElementById('statMembersTotal').textContent = `总计 ${overview.members.total}`;
}

/**
 * 初始化统计模块
 */
function initStatsModule() {
  // 加载默认统计数据
  loadStats('overview');

  // 时间范围按钮
  document.querySelectorAll('.chart-controls .btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const range = e.target.dataset.range;
      loadStats(range);
    });
  });
}
