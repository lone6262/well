// 文章管理模块 — ES Module

import { CLOUD_FUNCTIONS, PAGINATION, STATUS_MAP, CATEGORY_MAP } from './config.js';
import { callCloudFunction, showLoading, hideLoading, showToast, handleApiError, confirmAction } from './api.js';
import { formatDate, escapeHtml, escapeAttr, renderPagination } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { validateAndShow, clearFieldErrors } from './validator.js';

let articlesCurrentPage = 1;
let currentEditingArticle = null;

async function loadArticles(page) {
  page = page || 1;
  showLoading();

  try {
    const result = await callCloudFunction(CLOUD_FUNCTIONS.adminGetArticles, {
      page: page,
      pageSize: PAGINATION.defaultPageSize,
      category: getCategoryFilter(),
      status: getStatusFilter()
    });

    if (result.code === 0) {
      displayArticles(result.data.articles);
      renderPagination('articlesPagination', result.data.pagination, loadArticles);
      articlesCurrentPage = page;
    } else {
      showToast(result.msg || '加载失败', 'error');
    }
  } catch (error) {
    handleApiError(error);
  } finally {
    hideLoading();
  }
}

function getCategoryFilter() {
  var el = document.getElementById('articleCategoryFilter');
  return el ? el.value : 'all';
}

function getStatusFilter() {
  var el = document.getElementById('articleStatusFilter');
  return el ? el.value : 'all';
}

function displayArticles(articles) {
  var tbody = document.getElementById('articlesTableBody');

  if (!articles || articles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = articles.map(function(article) {
    var statusInfo = STATUS_MAP.article[article.status] || { text: article.status, class: 'badge-gray' };
    var categoryName = CATEGORY_MAP[article.category] || article.category;

    return '<tr>' +
      '<td>' + escapeHtml(article.title) + '</td>' +
      '<td>' + escapeHtml(categoryName) + '</td>' +
      '<td><span class="badge ' + statusInfo.class + '">' + escapeHtml(statusInfo.text) + '</span></td>' +
      '<td>' + (article.view_count || 0) + '</td>' +
      '<td>' + formatDate(article.published_at) + '</td>' +
      '<td>' +
        '<button class="btn btn-sm btn-outline" onclick="window.__articles.editArticle(\'' + escapeAttr(article._id) + '\')">编辑</button>' +
        (article.status !== 'archived'
          ? '<button class="btn btn-sm btn-outline" onclick="window.__articles.deleteArticle(\'' + escapeAttr(article._id) + '\', false)">归档</button>'
          : '<button class="btn btn-sm btn-outline" onclick="window.__articles.deleteArticle(\'' + escapeAttr(article._id) + '\', true)">删除</button>') +
      '</td>' +
    '</tr>';
  }).join('');
}

function editArticle(articleId) {
  currentEditingArticle = articleId;

  if (articleId) {
    resetArticleForm();
    document.getElementById('articleModalTitle').textContent = '编辑文章';
    openModal('articleModal');
  } else {
    currentEditingArticle = null;
    resetArticleForm();
    document.getElementById('articleModalTitle').textContent = '新建文章';
    openModal('articleModal');
  }
}

function resetArticleForm() {
  var form = document.getElementById('articleForm');
  form.reset();
  clearFieldErrors(form);
  document.getElementById('articleId').value = '';
}

async function saveArticle(e) {
  e.preventDefault();

  var form = document.getElementById('articleForm');
  var validation = validateAndShow({
    articleTitle: [
      { required: true, message: '请输入文章标题' },
      { maxLength: 80, message: '标题最多 80 个字符' }
    ],
    articleSummary: { maxLength: 200, message: '摘要最多 200 个字符' },
    articleContent: { required: true, message: '请输入文章内容' },
    articleSortOrder: { number: true, min: 0, message: '排序必须是大于等于 0 的数字' }
  }, { root: form });

  if (!validation.valid) {
    showToast('请修正表单错误后再保存', 'error');
    return;
  }

  var articleData = {
    articleId: document.getElementById('articleId').value || null,
    title: document.getElementById('articleTitle').value.trim(),
    category: document.getElementById('articleCategory').value,
    targetPet: document.getElementById('articleTargetPet').value,
    summary: document.getElementById('articleSummary').value.trim(),
    content: document.getElementById('articleContent').value.trim(),
    coverImage: document.getElementById('articleCoverImage').value.trim(),
    sortOrder: parseInt(document.getElementById('articleSortOrder').value, 10) || 0,
    status: document.getElementById('articleStatus').value
  };

  showLoading('保存中...');

  try {
    var result = await callCloudFunction(CLOUD_FUNCTIONS.adminSaveArticle, articleData);

    if (result.code === 0) {
      showToast('保存成功', 'success');
      closeModal('articleModal');
      loadArticles(articlesCurrentPage);
    } else {
      showToast(result.msg || '保存失败', 'error');
    }
  } catch (error) {
    handleApiError(error);
  } finally {
    hideLoading();
  }
}

async function deleteArticle(articleId, hardDelete) {
  hardDelete = !!hardDelete;
  var message = hardDelete ? '确定要永久删除此文章吗？此操作不可恢复！' : '确定要归档此文章吗？';

  confirmAction(message, async function() {
    showLoading('处理中...');

    try {
      var result = await callCloudFunction(CLOUD_FUNCTIONS.adminDeleteArticle, {
        articleId: articleId,
        hardDelete: hardDelete
      });

      if (result.code === 0) {
        showToast(hardDelete ? '删除成功' : '归档成功', 'success');
        loadArticles(articlesCurrentPage);
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

export function initArticlesModule() {
  // 注册到 window 以便 onclick 属性访问
  window.__articles = { editArticle: editArticle, deleteArticle: deleteArticle };

  var createBtn = document.getElementById('createArticleBtn');
  if (createBtn) {
    createBtn.addEventListener('click', function() {
      currentEditingArticle = null;
      resetArticleForm();
      document.getElementById('articleModalTitle').textContent = '新建文章';
      openModal('articleModal');
    });
  }

  var categoryFilter = document.getElementById('articleCategoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', function() { loadArticles(1); });
  }

  var statusFilter = document.getElementById('articleStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', function() { loadArticles(1); });
  }

  var form = document.getElementById('articleForm');
  if (form) {
    form.addEventListener('submit', saveArticle);
  }

  var closeBtn = document.getElementById('articleModalClose');
  if (closeBtn) closeBtn.addEventListener('click', function() { closeModal('articleModal'); });

  var cancelBtn = document.getElementById('articleModalCancel');
  if (cancelBtn) cancelBtn.addEventListener('click', function() { closeModal('articleModal'); });

  loadArticles(1);
}
