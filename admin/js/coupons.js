/**
 * 优惠券管理模块
 */

let couponsCurrentPage = 1;

/**
 * 加载优惠券列表
 */
async function loadCoupons(page = 1) {
  showLoading();

  try {
    const statusFilter = document.getElementById('couponStatusFilter').value;
    const sceneFilter = document.getElementById('couponSceneFilter').value;
    const result = await callCloudFunction('adminGateway', {
      action: 'getCoupons',
      page: page,
      pageSize: PAGINATION.defaultPageSize,
      isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
      scene: sceneFilter === 'all' ? undefined : sceneFilter,
    });

    if (result.code === 0) {
      displayCoupons(result.data.coupons || []);
      if (result.data.pagination) {
        renderPagination('couponsPagination', result.data.pagination, loadCoupons);
      }
      couponsCurrentPage = page;
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
      : `${coupon.discount_value}% 折`;
    const sceneText = COUPON_SCENE_MAP[coupon.scene] || coupon.scene || '-';
    const appTypeText = coupon.type || '通用';
    const statusText = coupon.is_active ? '活跃' : '已下架';
    const statusClass = coupon.is_active ? 'badge-success' : 'badge-gray';
    const issuedCount = coupon.total_issued || 0;
    const totalCount = coupon.total_limit || '不限';

    return `
      <tr>
        <td>${escapeHtml(coupon.name || '-')}</td>
        <td>${coupon.discount_type === 'fixed' ? '固定减' : '百分比'}</td>
        <td>${discountText}</td>
        <td>${escapeHtml(appTypeText)}</td>
        <td>${escapeHtml(sceneText)}</td>
        <td>${issuedCount} / ${totalCount}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="editCoupon('${coupon._id}')">编辑</button>
          <button class="btn btn-sm btn-outline" onclick="toggleCoupon('${coupon._id}', ${!coupon.is_active})">
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
  if (isNew) {
    document.getElementById('couponForm').reset();
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

  const data = {
    action: isNew ? 'createCoupon' : 'updateCoupon',
    name: document.getElementById('couponName').value,
    type: document.getElementById('couponType').value,
    discount_type: document.getElementById('couponDiscountType').value,
    discount_value: document.getElementById('couponDiscountType').value === 'fixed'
      ? Math.round(parseFloat(document.getElementById('couponDiscountValue').value) * 100)
      : parseInt(document.getElementById('couponDiscountValue').value),
    min_amount: Math.round(parseFloat(document.getElementById('couponMinAmount').value || 0) * 100),
    validity_days: parseInt(document.getElementById('couponValidityDays').value),
    scene: document.getElementById('couponScene').value,
    total_limit: document.getElementById('couponTotalLimit').value
      ? parseInt(document.getElementById('couponTotalLimit').value)
      : null,
    per_user_limit: parseInt(document.getElementById('couponPerUserLimit').value),
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
  confirmAction(`确定${action}此优惠券？`, async () => {
    showLoading('处理中...');
    try {
      const result = await callCloudFunction('adminGateway', {
        action: 'toggleCoupon',
        couponId: couponId,
        isActive: isActive,
      });
      if (result.code === 0) {
        showToast(`已${action}`, 'success');
        loadCoupons(couponsCurrentPage);
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
 * 初始化优惠券管理
 */
function initCouponsModule() {
  document.getElementById('couponStatusFilter').addEventListener('change', () => loadCoupons(1));
  document.getElementById('couponSceneFilter').addEventListener('change', () => loadCoupons(1));

  const createBtn = document.getElementById('createCouponBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => showCouponModal(null));
  }

  loadCoupons(1);
}
