/**
 * 文章管理模块
 */

let articlesCurrentPage = 1;
let articlesTotalPages = 1;
let articlesCurrentFilters = {
  category: 'all',
  status: 'all'
};
let currentEditingArticle = null;

/**
 * 加载文章列表
 */
async function loadArticles(page = 1) {
  showLoading();

  try {
    const result = await callCloudFunction(CLOUD_FUNCTIONS.adminGetArticles, {
      page: page,
      pageSize: PAGINATION.defaultPageSize,
      category: articlesCurrentFilters.category,
      status: articlesCurrentFilters.status
    });

    if (result.code === 0) {
      displayArticles(result.data.articles);
      renderPagination('articlesPagination', result.data.pagination, loadArticles);
      articlesCurrentPage = page;
      articlesTotalPages = result.data.pagination.totalPages;
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
 * 显示文章列表
 */
function displayArticles(articles) {
  const tbody = document.getElementById('articlesTableBody');

  if (!articles || articles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = articles.map(article => {
    const statusInfo = STATUS_MAP.article[article.status] || { text: article.status, class: 'badge-gray' };
    const categoryName = CATEGORY_MAP[article.category] || article.category;

    return `
      <tr>
        <td>${escapeHtml(article.title)}</td>
        <td>${escapeHtml(categoryName)}</td>
        <td><span class="badge ${statusInfo.class}">${escapeHtml(statusInfo.text)}</span></td>
        <td>${article.view_count || 0}</td>
        <td>${formatDate(article.published_at)}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editArticle('${escapeAttr(article._id)}')">编辑</button>
          ${article.status !== 'archived' ? `<button class="btn btn-sm btn-outline" onclick="deleteArticle('${escapeAttr(article._id)}', false)">归档</button>` : `<button class="btn btn-sm btn-outline" onclick="deleteArticle('${escapeAttr(article._id)}', true)">删除</button>`}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 打开文章编辑弹窗
 */
function editArticle(articleId) {
  currentEditingArticle = articleId;

  if (articleId) {
    // 加载文章数据
    loadArticleData(articleId);
  } else {
    // 新建文章
    currentEditingArticle = null;
    resetArticleForm();
    document.getElementById('articleModalTitle').textContent = '新建文章';
    openModal('articleModal');
  }
}

/**
 * 加载文章数据
 */
async function loadArticleData(articleId) {
  showLoading();

  try {
    // 这里需要调用获取文章详情的云函数，暂时简化处理
    // 实际应该有一个 adminGetArticleDetail 云函数
    resetArticleForm();
    document.getElementById('articleModalTitle').textContent = '编辑文章';
    openModal('articleModal');
  } catch (error) {
    handleApiError(error);
  } finally {
    hideLoading();
  }
}

/**
 * 重置文章表单
 */
function resetArticleForm() {
  const form = document.getElementById('articleForm');
  form.reset();
  clearFieldErrors(form);
  document.getElementById('articleId').value = '';
}

/**
 * 保存文章
 */
async function saveArticle(e) {
  e.preventDefault();

  const form = document.getElementById('articleForm');
  const validation = validateAndShow({
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

  const articleData = {
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
    const result = await callCloudFunction(CLOUD_FUNCTIONS.adminSaveArticle, articleData);

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

/**
 * 删除文章
 */
async function deleteArticle(articleId, hardDelete = false) {
  const message = hardDelete ? '确定要永久删除此文章吗？此操作不可恢复！' : '确定要归档此文章吗？';

  confirmAction(message, async () => {
    showLoading('处理中...');

    try {
      const result = await callCloudFunction(CLOUD_FUNCTIONS.adminDeleteArticle, {
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

/**
 * 初始化文章管理
 */
function initArticlesModule() {
  // 新建文章按钮
  document.getElementById('createArticleBtn').addEventListener('click', () => {
    currentEditingArticle = null;
    resetArticleForm();
    document.getElementById('articleModalTitle').textContent = '新建文章';
    openModal('articleModal');
  });

  // 分类过滤
  document.getElementById('articleCategoryFilter').addEventListener('change', (e) => {
    articlesCurrentFilters.category = e.target.value;
    loadArticles(1);
  });

  // 状态过滤
  document.getElementById('articleStatusFilter').addEventListener('change', (e) => {
    articlesCurrentFilters.status = e.target.value;
    loadArticles(1);
  });

  // 文章表单提交
  document.getElementById('articleForm').addEventListener('submit', saveArticle);

  // 弹窗关闭
  document.getElementById('articleModalClose').addEventListener('click', () => closeModal('articleModal'));
  document.getElementById('articleModalCancel').addEventListener('click', () => closeModal('articleModal'));

  // 初始加载
  loadArticles(1);
}
