/**
 * 优惠券管理模块
 */

let couponsCurrentPage = 1;

// 使用 CRUD 公共加载器
const loadCoupons = createCrudLoader({
  loadFn: function(page, pageSize, filters) {
    return callCloudFunction('adminGateway', {
      action: 'getCoupons',
      page: page,
      pageSize: pageSize,
      isActive: filters.status === 'active' ? true : filters.status === 'inactive' ? false : undefined,
      scene: filters.scene === 'all' ? undefined : filters.scene,
    });
  },
  displayFn: displayCoupons,
  paginationId: 'couponsPagination',
  dataPath: 'data.coupons',
  getState: function() { return { page: couponsCurrentPage }; },
  setState: function(state) { couponsCurrentPage = state.page; },
  getFilters: function() {
    return {
      status: document.getElementById('couponStatusFilter').value,
      scene: document.getElementById('couponSceneFilter').value
    };
  }
});

/**
 * 显示优惠券列表
 */
function displayCoupons(coupons) {
  const tbody = document.getElementById('couponsTableBody');

  if (!coupons || coupons.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading">暂无优惠券</td></tr>';
    return;
  }

  tbody.innerHTML = coupons.map(coupon => {
    const discountText = coupon.discount_type === 'fixed'
      ? `减 ¥${((coupon.discount_value || 0) / 100).toFixed(2)}`
      : `${coupon.discount_value} 折`;
    const sceneText = COUPON_SCENE_MAP[coupon.scene] || coupon.scene || '-';
    const appTypeText = coupon.type || '通用';
    const statusText = coupon.is_active ? '活跃' : '已下架';
    const statusClass = coupon.is_active ? 'badge-success' : 'badge-gray';
    const issuedCount = coupon.total_issued || 0;
    const totalCount = coupon.total_limit || '不限';

    return `
      <tr>
        <td>${escapeHtml(coupon.name || '-')}</td>
        <td>${coupon.discount_type === 'fixed' ? '固定减' : '折扣'}</td>
        <td>${discountText}</td>
        <td>${escapeHtml(appTypeText)}</td>
        <td>${escapeHtml(sceneText)}</td>
        <td>${issuedCount} / ${totalCount}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editCoupon('${escapeAttr(coupon._id)}')">编辑</button>
          <button class="btn btn-sm btn-outline" onclick="toggleCoupon('${escapeAttr(coupon._id)}', ${!coupon.is_active})">
            ${coupon.is_active ? '下架' : '上架'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 创建/编辑优惠券
 */
function showCouponModal(couponId) {
  const isNew = !couponId;
  document.getElementById('couponModalTitle').textContent = isNew ? '新建优惠券' : '编辑优惠券';

  // 清空或填充表单
  const form = document.getElementById('couponForm');
  if (form) {
    clearFieldErrors(form);
  }

  if (isNew) {
    form.reset();
    document.getElementById('couponId').value = '';
  } else {
    // 数据会在 editCoupon 中填充
  }

  openModal('couponModal');
}

async function editCoupon(couponId) {
  showLoading();
  try {
    const result = await callCloudFunction('adminGateway', {
      action: 'getCouponDetail',
      couponId: couponId,
    });

    if (result.code === 0 && result.data) {
      const c = result.data;
      document.getElementById('couponId').value = c._id;
      document.getElementById('couponName').value = c.name || '';
      document.getElementById('couponType').value = c.type || 'report';
      document.getElementById('couponDiscountType').value = c.discount_type || 'fixed';
      document.getElementById('couponDiscountValue').value = c.discount_type === 'fixed'
        ? ((c.discount_value || 0) / 100).toFixed(2)
        : c.discount_value;
      document.getElementById('couponMinAmount').value = ((c.min_amount || 0) / 100).toFixed(2);
      document.getElementById('couponValidityDays').value = c.validity_days || 30;
      document.getElementById('couponScene').value = c.scene || 'new_user';
      document.getElementById('couponTotalLimit').value = c.total_limit || '';
      document.getElementById('couponPerUserLimit').value = c.per_user_limit || 1;
      showCouponModal(couponId);
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
 * 保存优惠券
 */
async function saveCoupon() {
  const couponId = document.getElementById('couponId').value;
  const isNew = !couponId;
  const form = document.getElementById('couponForm');
  const discountType = document.getElementById('couponDiscountType').value;
  const validation = validateAndShow({
    couponName: [
      { required: true, message: '请输入券名称' },
      { maxLength: 40, message: '券名称最多 40 个字符' }
    ],
    couponDiscountValue: [
      { required: true, message: '请输入折扣值' },
      { number: true, min: 0.01, max: discountType === 'percent' ? 9.9 : undefined, message: discountType === 'percent' ? '折扣必须在 0.01 到 9.9 之间（8 = 8 折）' : '固定减金额必须大于 0' }
    ],
    couponMinAmount: { number: true, min: 0, message: '最低使用金额不能小于 0' },
    couponValidityDays: [
      { required: true, message: '请输入有效天数' },
      { number: true, min: 1, max: 3650, message: '有效天数必须在 1 到 3650 之间' }
    ],
    couponTotalLimit: { number: true, min: 1, message: '总发行量必须为空或大于 0' },
    couponPerUserLimit: [
      { required: true, message: '请输入每人限领数量' },
      { number: true, min: 1, message: '每人限领必须大于 0' }
    ]
  }, { root: form });

  if (!validation.valid) {
    showToast('请修正表单错误后再保存', 'error');
    return;
  }

  const data = {
    action: isNew ? 'createCoupon' : 'updateCoupon',
    name: document.getElementById('couponName').value.trim(),
    type: document.getElementById('couponType').value,
    discount_type: discountType,
    discount_value: discountType === 'fixed'
      ? Math.round(parseFloat(document.getElementById('couponDiscountValue').value) * 100)
      : parseInt(document.getElementById('couponDiscountValue').value, 10),
    min_amount: Math.round(parseFloat(document.getElementById('couponMinAmount').value || 0) * 100),
    validity_days: parseInt(document.getElementById('couponValidityDays').value, 10),
    scene: document.getElementById('couponScene').value,
    total_limit: document.getElementById('couponTotalLimit').value
      ? parseInt(document.getElementById('couponTotalLimit').value, 10)
      : null,
    per_user_limit: parseInt(document.getElementById('couponPerUserLimit').value, 10),
  };

  if (!isNew) {
    data.couponId = couponId;
  }

  showLoading('保存中...');
  try {
    const result = await callCloudFunction('adminGateway', data);
    if (result.code === 0) {
      showToast('保存成功', 'success');
      closeModal('couponModal');
      loadCoupons(couponsCurrentPage);
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
 * 切换优惠券上下架
 */
async function toggleCoupon(couponId, isActive) {
  const action = isActive ? '上架' : '下架';
  confirmedAction(`确定${action}此优惠券？`, function() {
    return callCloudFunction('adminGateway', {
      action: 'toggleCoupon',
      couponId: couponId,
      isActive: isActive,
    });
  }, `已${action}`, function() { loadCoupons(couponsCurrentPage); });
}

/**
 * 初始化优惠券管理
 */
function initCouponsModule() {
  bindFilterEvents([
    { elementId: 'couponStatusFilter' },
    { elementId: 'couponSceneFilter' }
  ], loadCoupons);

  const createBtn = document.getElementById('createCouponBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => showCouponModal(null));
  }

  loadCoupons(1);
}
