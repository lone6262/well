// CRUD 公共工具 — ES Module

import { PAGINATION } from './config.js';
import { showLoading, hideLoading, showToast, handleApiError, confirmAction } from './api.js';
import { renderPagination } from './utils.js';

export function extractData(result, path) {
  var parts = path.split('.');
  var current = result;
  for (var i = 0; i < parts.length; i++) {
    if (current == null) return [];
    current = current[parts[i]];
  }
  return Array.isArray(current) ? current : [];
}

export function createCrudLoader(config) {
  var loadFn = config.loadFn;
  var displayFn = config.displayFn;
  var paginationId = config.paginationId;
  var emptyHtml = config.emptyHtml || '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
  var getState = config.getState;
  var setState = config.setState;
  var getFilters = config.getFilters || function() { return {}; };
  var dataPath = config.dataPath || 'data';

  function loadPage(page) {
    page = page || 1;
    showLoading();

    var filters = getFilters();

    loadFn(page, PAGINATION.defaultPageSize, filters)
      .then(function(result) {
        if (result.code === 0) {
          var items = extractData(result, dataPath);
          displayFn(items);

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

export function bindFilterEvents(filters, loadFn) {
  filters.forEach(function(filter) {
    var el = document.getElementById(filter.elementId);
    if (el) {
      el.addEventListener(filter.event || 'change', function() {
        loadFn(1);
      });
    }
  });
}

export function confirmedAction(message, actionFn, successMsg, reloadFn) {
  confirmAction(message, async function() {
    showLoading('处理中...');
    try {
      var result = await actionFn();
      if (result.code === 0) {
        var msg = typeof successMsg === 'function' ? successMsg(result) : successMsg;
        showToast(msg || '操作成功', 'success');
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
