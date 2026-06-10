// 通用工具函数 — ES Module

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN');
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
}

export function formatNumber(num) {
  if (num == null) return '0';
  return num.toLocaleString('zh-CN');
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderPagination(containerId, pagination, callback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  var page = pagination.page;
  var totalPages = pagination.totalPages;
  var total = pagination.total;

  var html = '';

  html += '<button class="page-btn" ' + (page <= 1 ? 'disabled' : '') + ' data-page="' + (page - 1) + '">上一页</button>';

  var startPage = Math.max(1, page - 2);
  var endPage = Math.min(totalPages, page + 2);

  if (startPage > 1) {
    html += '<button class="page-btn" data-page="1">1</button>';
    if (startPage > 2) {
      html += '<span class="page-info">...</span>';
    }
  }

  for (var i = startPage; i <= endPage; i++) {
    html += '<button class="page-btn ' + (i === page ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += '<span class="page-info">...</span>';
    }
    html += '<button class="page-btn" data-page="' + totalPages + '">' + totalPages + '</button>';
  }

  html += '<button class="page-btn" ' + (page >= totalPages ? 'disabled' : '') + ' data-page="' + (page + 1) + '">下一页</button>';
  html += '<span class="page-info">共 ' + total + ' 条</span>';

  container.innerHTML = html;

  container.querySelectorAll('.page-btn:not([disabled])').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var pageNum = parseInt(btn.dataset.page);
      callback(pageNum);
    });
  });
}
