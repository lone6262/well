/**
 * 用户管理模块
 */

let usersCurrentPage = 1;
let usersTotalPages = 1;
let usersCurrentFilters = {
  searchKey: '',
  memberStatus: 'all'
};

/**
 * 加载用户列表
 */
async function loadUsers(page = 1) {
  showLoading();

  try {
    const result = await callCloudFunction(CLOUD_FUNCTIONS.adminGetUsers, {
      page: page,
      pageSize: PAGINATION.defaultPageSize,
      searchKey: usersCurrentFilters.searchKey,
      memberStatus: usersCurrentFilters.memberStatus
    });

    if (result.code === 0) {
      displayUsers(result.data.users);
      renderPagination('usersPagination', result.data.pagination, loadUsers);
      usersCurrentPage = page;
      usersTotalPages = result.data.pagination.totalPages;
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
 * 显示用户列表
 */
function displayUsers(users) {
  const tbody = document.getElementById('usersTableBody');

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr>
      <td><code>${escapeHtml(user.user_id || '').substring(0, 16)}...</code></td>
      <td>${escapeHtml(user.nickName || '未设置')}</td>
      <td>${user.phoneNumber ? escapeHtml(user.phoneNumber) : '<span class="text-gray">未绑定</span>'}</td>
      <td>${user.isMember ? '<span class="badge badge-success">会员</span>' : '<span class="badge badge-gray">普通</span>'}</td>
      <td>${user.petsCount || 0}</td>
      <td>${user.ordersCount || 0}</td>
      <td>${formatDate(user.created_at)}</td>
    </tr>
  `).join('');
}

/**
 * 初始化用户管理
 */
function initUsersModule() {
  // 搜索按钮
  document.getElementById('userSearchBtn').addEventListener('click', () => {
    usersCurrentFilters.searchKey = document.getElementById('userSearchInput').value.trim();
    loadUsers(1);
  });

  // 搜索输入框回车
  document.getElementById('userSearchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      usersCurrentFilters.searchKey = e.target.value.trim();
      loadUsers(1);
    }
  });

  // 会员状态过滤
  document.getElementById('userMemberFilter').addEventListener('change', (e) => {
    usersCurrentFilters.memberStatus = e.target.value;
    loadUsers(1);
  });

  // 初始加载
  loadUsers(1);
}
