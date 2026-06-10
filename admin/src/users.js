// 用户管理模块 — ES Module

import { CLOUD_FUNCTIONS, PAGINATION } from './config.js';
import { callCloudFunction, showLoading, hideLoading, showToast, handleApiError } from './api.js';
import { formatDate, escapeHtml, renderPagination } from './utils.js';

let usersCurrentPage = 1;
let usersCurrentFilters = { searchKey: '', memberStatus: 'all' };

async function loadUsers(page) {
  page = page || 1;
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
    } else {
      showToast(result.msg || '加载失败', 'error');
    }
  } catch (error) {
    handleApiError(error);
  } finally {
    hideLoading();
  }
}

function displayUsers(users) {
  const tbody = document.getElementById('usersTableBody');

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(function(user) {
    return '<tr>' +
      '<td><code>' + escapeHtml(user.user_id || '').substring(0, 16) + '...</code></td>' +
      '<td>' + escapeHtml(user.nickName || '未设置') + '</td>' +
      '<td>' + (user.isMember ? '<span class="badge badge-success">会员</span>' : '<span class="badge badge-gray">普通</span>') + '</td>' +
      '<td>' + (user.petsCount || 0) + '</td>' +
      '<td>' + (user.ordersCount || 0) + '</td>' +
      '<td>' + formatDate(user.created_at) + '</td>' +
    '</tr>';
  }).join('');
}

export function initUsersModule() {
  document.getElementById('userSearchBtn').addEventListener('click', function() {
    usersCurrentFilters.searchKey = document.getElementById('userSearchInput').value.trim();
    loadUsers(1);
  });

  document.getElementById('userSearchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      usersCurrentFilters.searchKey = e.target.value.trim();
      loadUsers(1);
    }
  });

  document.getElementById('userMemberFilter').addEventListener('change', function(e) {
    usersCurrentFilters.memberStatus = e.target.value;
    loadUsers(1);
  });

  loadUsers(1);
}
