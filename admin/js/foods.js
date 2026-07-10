/**
 * 食物安全管理模块
 * 对接云函数：adminGetFoods / adminSaveFood / adminDeleteFood / getFoodCategories
 */

let foodsCurrentPage = 1;
// 列表缓存（无单独详情接口，编辑时从缓存取）
const foodsCache = {};

// 食物分类（与前端 food-safety.js ALL_CATEGORIES 保持一致）
const FOOD_CATEGORIES = ['水果', '蔬菜', '肉类', '零食', '饮料', '添加剂', '植物', '坚果', '其他'];

// 安全等级 → 中文 + 徽章样式
const FOOD_SAFETY_MAP = {
  danger: { text: '危险', class: 'badge-danger' },
  caution: { text: '谨慎', class: 'badge-warning' },
  safe: { text: '安全', class: 'badge-success' },
};

function safetyBadge(level) {
  const m = FOOD_SAFETY_MAP[level] || { text: level || '-', class: 'badge-gray' };
  return `<span class="badge ${m.class}">${m.text}</span>`;
}

// 使用 CRUD 公共加载器
const loadFoods = createCrudLoader({
  loadFn: function(page, pageSize, filters) {
    return callCloudFunction('adminGetFoods', {
      page: page,
      pageSize: pageSize,
      category: filters.category === 'all' ? 'all' : filters.category,
      status: filters.status === 'all' ? 'all' : filters.status,
    });
  },
  displayFn: displayFoods,
  paginationId: 'foodsPagination',
  dataPath: 'data.foods',
  getState: function() { return { page: foodsCurrentPage }; },
  setState: function(state) { foodsCurrentPage = state.page; },
  getFilters: function() {
    return {
      category: document.getElementById('foodCategoryFilter').value,
      status: document.getElementById('foodStatusFilter').value,
    };
  },
});

/**
 * 显示食物列表
 */
function displayFoods(foods) {
  const tbody = document.getElementById('foodsTableBody');

  if (!foods || foods.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">暂无食物数据</td></tr>';
    return;
  }

  // 刷新缓存
  foods.forEach(function(f) { foodsCache[f._id] = f; });

  tbody.innerHTML = foods.map(function(food) {
    return `
      <tr>
        <td>${escapeHtml(food.name || '-')}</td>
        <td>${escapeHtml(food.category || '-')}</td>
        <td>${safetyBadge(food.cat_safety)}</td>
        <td>${safetyBadge(food.dog_safety)}</td>
        <td>${food.severity || '-'}</td>
        <td>${escapeHtml(food.status === 'published' ? '已发布' : (food.status === 'draft' ? '草稿' : (food.status || '-')))}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editFood('${escapeAttr(food._id)}')">编辑</button>
          <button class="btn btn-sm btn-outline" onclick="deleteFood('${escapeAttr(food._id)}')">删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 打开新建/编辑弹窗
 */
function showFoodModal(foodId) {
  const isNew = !foodId;
  document.getElementById('foodModalTitle').textContent = isNew ? '新建食物' : '编辑食物';

  const form = document.getElementById('foodForm');
  if (form) {
    clearFieldErrors(form);
  }

  if (isNew) {
    form.reset();
    document.getElementById('foodId').value = '';
    document.getElementById('foodCatSafety').value = 'caution';
    document.getElementById('foodDogSafety').value = 'caution';
    document.getElementById('foodStatus').value = 'published';
  }

  openModal('foodModal');
}

/**
 * 编辑（从列表缓存填充）
 */
function editFood(foodId) {
  const food = foodsCache[foodId];
  if (!food) {
    showToast('数据已过期，请刷新列表', 'error');
    return;
  }

  document.getElementById('foodId').value = food._id;
  document.getElementById('foodName').value = food.name || '';
  document.getElementById('foodCategory').value = food.category || '其他';
  document.getElementById('foodAliases').value = Array.isArray(food.aliases) ? food.aliases.join(', ') : '';
  document.getElementById('foodCatSafety').value = food.cat_safety || 'caution';
  document.getElementById('foodDogSafety').value = food.dog_safety || 'caution';
  document.getElementById('foodEffect').value = food.effect || '';
  document.getElementById('foodAlternative').value = food.alternative || '';
  document.getElementById('foodSeverity').value = food.severity || 1;
  document.getElementById('foodStatus').value = food.status || 'published';

  showFoodModal(foodId);
}

/**
 * 保存食物（新建/更新）
 */
async function saveFood() {
  const foodId = document.getElementById('foodId').value;
  const isNew = !foodId;
  const form = document.getElementById('foodForm');

  const validation = validateAndShow({
    foodName: [
      { required: true, message: '请输入食物名称' },
      { maxLength: 30, message: '食物名称最多 30 个字符' },
    ],
    foodSeverity: { number: true, min: 1, max: 5, message: '严重程度必须是 1 到 5' },
  }, { root: form });

  if (!validation.valid) {
    showToast('请修正表单错误后再保存', 'error');
    return;
  }

  const aliasesRaw = document.getElementById('foodAliases').value.trim();
  const data = {
    name: document.getElementById('foodName').value.trim(),
    category: document.getElementById('foodCategory').value,
    aliases: aliasesRaw ? aliasesRaw.split(/[,，]/).map(function(s) { return s.trim(); }).filter(Boolean) : [],
    cat_safety: document.getElementById('foodCatSafety').value,
    dog_safety: document.getElementById('foodDogSafety').value,
    effect: document.getElementById('foodEffect').value.trim(),
    alternative: document.getElementById('foodAlternative').value.trim(),
    severity: parseInt(document.getElementById('foodSeverity').value, 10) || 1,
    status: document.getElementById('foodStatus').value,
  };

  if (!isNew) {
    data.foodId = foodId;
  }

  showLoading('保存中...');
  try {
    const result = await callCloudFunction('adminSaveFood', data);
    if (result.code === 0) {
      showToast('保存成功', 'success');
      closeModal('foodModal');
      loadFoods(foodsCurrentPage);
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
 * 删除食物
 */
function deleteFood(foodId) {
  confirmedAction('确定删除此食物记录？删除后不可恢复。', function() {
    return callCloudFunction('adminDeleteFood', { foodId: foodId });
  }, '已删除', function() { loadFoods(foodsCurrentPage); });
}

/**
 * 初始化食物管理模块
 */
function initFoodsModule() {
  bindFilterEvents([
    { elementId: 'foodCategoryFilter' },
    { elementId: 'foodStatusFilter' },
  ], loadFoods);

  const createBtn = document.getElementById('createFoodBtn');
  if (createBtn) {
    createBtn.addEventListener('click', function() { showFoodModal(null); });
  }

  loadFoods(1);
}
