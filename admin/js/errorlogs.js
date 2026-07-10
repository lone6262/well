/**
 * 错误日志查看模块（只读）
 * 数据来源：error_logs 集合（前端未捕获异常 + 云函数错误）
 * 对接云函数：adminGetErrorLogs
 */

let errorLogsCurrentPage = 1;
const errorLogsCache = {};

// 使用 CRUD 公共加载器（分页）
const loadErrorLogs = createCrudLoader({
  loadFn: function(page, pageSize, filters) {
    return callCloudFunction('adminGetErrorLogs', {
      page: page,
      pageSize: pageSize,
      func: filters.func === 'all' ? '' : filters.func,
      keyword: filters.keyword || '',
    });
  },
  displayFn: displayErrorLogs,
  paginationId: 'errorLogsPagination',
  dataPath: 'data.logs',
  getState: function() { return { page: errorLogsCurrentPage }; },
  setState: function(state) { errorLogsCurrentPage = state.page; },
  getFilters: function() {
    return {
      func: document.getElementById('errorLogFuncFilter').value,
      keyword: (document.getElementById('errorLogKeywordFilter').value || '').trim(),
    };
  },
});

/**
 * 显示错误日志列表
 */
function displayErrorLogs(logs) {
  const tbody = document.getElementById('errorLogsTableBody');

  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无错误日志</td></tr>';
    return;
  }

  logs.forEach(function(l) { errorLogsCache[l._id] = l; });

  tbody.innerHTML = logs.map(function(log) {
    const when = formatDateTime(log.created_at || log.client_timestamp);
    const func = log.function || log.operation || '-';
    const page = log.page || '-';
    const msg = String(log.error_message || log.error || '').substring(0, 80);
    const uid = (log.user_id || '').substring(0, 12);

    return `
      <tr>
        <td>${when}</td>
        <td>${escapeHtml(func)}</td>
        <td>${escapeHtml(page)}</td>
        <td>${escapeHtml(msg)}</td>
        <td><code>${escapeHtml(uid)}</code></td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="viewErrorLogDetail('${escapeAttr(log._id)}')">详情</button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 查看错误详情
 */
function viewErrorLogDetail(logId) {
  const log = errorLogsCache[logId];
  if (!log) {
    showToast('数据已过期，请刷新列表', 'error');
    return;
  }

  const fields = [
    ['时间', formatDateTime(log.created_at || log.client_timestamp)],
    ['来源', log.function || log.operation || '-'],
    ['页面', log.page || '-'],
    ['类型', log.error_type || '-'],
    ['用户', log.user_id || '-'],
    ['设备', [log.brand, log.model, log.system].filter(Boolean).join(' ') || '-'],
    ['错误信息', log.error_message || log.error || '-'],
    ['堆栈', log.stack || '-'],
  ];

  document.getElementById('errorLogDetailBody').innerHTML = fields.map(function(f) {
    const isStack = f[0] === '堆栈';
    return `
      <div class="detail-row">
        <div class="detail-label">${escapeHtml(f[0])}</div>
        <div class="detail-value ${isStack ? 'detail-pre' : ''}">${escapeHtml(String(f[1]))}</div>
      </div>
    `;
  }).join('');

  openModal('errorLogDetailModal');
}

/**
 * 初始化错误日志模块
 */
function initErrorLogsModule() {
  bindFilterEvents([
    { elementId: 'errorLogFuncFilter' },
  ], loadErrorLogs);

  const searchBtn = document.getElementById('errorLogSearchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', function() { loadErrorLogs(1); });
  }

  loadErrorLogs(1);
}
