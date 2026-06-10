/**
 * CRUD 模块公共工具
 * 封装管理后台列表页通用的 加载 → 显示 → 分页 → 错误处理 流程
 *
 * 用法：
 *   // 在模块文件中调用
 *   createCrudLoader({
 *     loadFn: (page, pageSize, filters) => callCloudFunction('xxx', { page, pageSize, ...filters }),
 *     displayFn: (items) => { document.getElementById('tbody').innerHTML = ... },
 *     paginationId: 'xxxPagination',
 *     emptyHtml: '<tr><td colspan="6" class="loading">暂无数据</td></tr>',
 *     getState: () => ({ page: xxxCurrentPage }),
 *     setState: (state) => { xxxCurrentPage = state.page; },
 *     getFilters: () => ({ status: document.getElementById('filter').value }),
 *   });
 */

/**
 * 创建标准 CRUD 加载器
 * @param {Object} config - 配置项
 * @param {Function} config.loadFn - 异步加载函数 (page, pageSize, filters) => result
 * @param {Function} config.displayFn - 数据显示函数 (items) => void
 * @param {string} config.paginationId - 分页容器 DOM ID
 * @param {string} [config.emptyHtml] - 空数据时的 HTML
 * @param {Function} config.getState - 获取当前状态 () => { page }
 * @param {Function} config.setState - 设置状态 (state) => void
 * @param {Function} [config.getFilters] - 获取筛选条件 () => Object
 * @param {string} [config.dataPath] - 数据路径 'data.items' 或 'data.orders' 等
 * @returns {Function} loadPage(page) 函数
 */
function createCrudLoader(config) {
  var loadFn = config.loadFn;
  var displayFn = config.displayFn;
  var paginationId = config.paginationId;
  var emptyHtml = config.emptyHtml || '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
  var getState = config.getState;
  var setState = config.setState;
  var getFilters = config.getFilters || function() { return {}; };
  var dataPath = config.dataPath || 'data';

  /**
   * 加载指定页数据
   * @param {number} page - 页码（默认 1）
   */
  function loadPage(page) {
    page = page || 1;
    showLoading();

    var filters = getFilters();

    loadFn(page, PAGINATION.defaultPageSize, filters)
      .then(function(result) {
        if (result.code === 0) {
          // 从 result 中按路径提取数据
          var items = extractData(result, dataPath);
          displayFn(items);

          // 分页
          var pagination = result.data && result.data.pagination
            ? result.data.pagination
            : null;
          if (pagination && paginationId) {
            renderPagination(paginationId, pagination, loadPage);
          }

          setState({ page: page });
        } else {
          showToast(result.msg || '加载失败', 'error');
        }
      })
      .catch(function(error) {
        handleApiError(error);
      })
      .finally(function() {
        hideLoading();
      });
  }

  return loadPage;
}

/**
 * 从 result 对象中按路径提取数据
 * @param {Object} result - 云函数返回结果
 * @param {string} path - 数据路径，如 'data.orders' 或 'data'
 * @returns {Array} 数据数组
 */
function extractData(result, path) {
  var parts = path.split('.');
  var current = result;
  for (var i = 0; i < parts.length; i++) {
    if (current == null) return [];
    current = current[parts[i]];
  }
  return Array.isArray(current) ? current : [];
}

/**
 * 绑定过滤器事件（统一模式）
 * @param {Array<{elementId: string, event: string}>} filters - 过滤器配置
 * @param {Function} loadFn - 重新加载函数 loadPage(1)
 */
function bindFilterEvents(filters, loadFn) {
  filters.forEach(function(filter) {
    var el = document.getElementById(filter.elementId);
    if (el) {
      el.addEventListener(filter.event || 'change', function() {
        loadFn(1);
      });
    }
  });
}

/**
 * 创建带确认的操作
 * @param {string} message - 确认消息
 * @param {Function} actionFn - 异步操作函数 () => result
 * @param {string} successMsg - 成功提示
 * @param {Function} reloadFn - 成功后重新加载函数
 */
function confirmedAction(message, actionFn, successMsg, reloadFn) {
  confirmAction(message, async function() {
    showLoading('处理中...');
    try {
      var result = await actionFn();
      if (result.code === 0) {
        var message = typeof successMsg === 'function' ? successMsg(result) : successMsg;
        showToast(message || '操作成功', 'success');
        if (reloadFn) reloadFn();
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
