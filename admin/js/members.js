/**
 * 会员管理模块
 */

let membersCurrentPage = 1;

// 使用 CRUD 公共加载器
const loadMembers = createCrudLoader({
  loadFn: function(page, pageSize, filters) {
    return callCloudFunction('adminGateway', {
      action: 'getMembers',
      page: page,
      pageSize: pageSize,
      memberType: filters.type === 'all' ? undefined : filters.type,
      status: filters.status === 'all' ? undefined : filters.status,
      keyword: filters.keyword || undefined,
    });
  },
  displayFn: displayMembers,
  paginationId: 'membersPagination',
  dataPath: 'data.members',
  getState: function() { return { page: membersCurrentPage }; },
  setState: function(state) { membersCurrentPage = state.page; },
  getFilters: function() {
    return {
      type: document.getElementById('memberTypeFilter').value,
      status: document.getElementById('memberStatusFilter').value,
      keyword: document.getElementById('memberSearchInput').value.trim()
    };
  }
});

/**
 * 显示会员列表
 */
function displayMembers(members) {
  const tbody = document.getElementById('membersTableBody');

  if (!members || members.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading">暂无会员数据</td></tr>';
    return;
  }

  tbody.innerHTML = members.map(member => {
    const typeText = MEMBER_TYPE_MAP[member.type] || member.type || '-';
    const statusInfo = STATUS_MAP.member[member.status] || { text: member.status, class: 'badge-gray' };
    const expireDate = formatDate(member.expire_date);
    const isExpired = member.status !== 'active';
    const creditsUsed = member.report_credits_used || 0;
    const creditsTotal = member.report_credits_total || 0;
    const autoRenew = member.auto_renew ? '✅ 开启' : '❌ 关闭';

    return `
      <tr>
        <td>${escapeHtml(member.userInfo?.nickName || member.user_id?.substring(0, 8) || '-')}</td>
        <td>${escapeHtml(typeText)}</td>
        <td><span class="badge ${statusInfo.class}">${statusInfo.text}</span></td>
        <td>${expireDate}</td>
        <td>${creditsTotal} 次/月</td>
        <td>${creditsUsed} / ${creditsTotal}</td>
        <td>${autoRenew}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="viewMemberDetail('${escapeAttr(member._id)}')">详情</button>
          ${!isExpired ? `<button class="btn btn-sm btn-outline" onclick="cancelMember('${escapeAttr(member._id)}')">取消</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 查看会员详情（弹窗）
 */
async function viewMemberDetail(memberId) {
  showLoading();
  try {
    const result = await callCloudFunction('adminGateway', {
      action: 'getMemberDetail',
      memberId: memberId,
    });

    if (result.code === 0 && result.data) {
      const m = result.data;
      const info = [
        `用户ID: ${m.user_id || '-'}`,
        `会员类型: ${MEMBER_TYPE_MAP[m.type] || m.type}`,
        `状态: ${m.status === 'active' ? '有效' : '已过期'}`,
        `开通日期: ${formatDate(m.start_date)}`,
        `到期日期: ${formatDate(m.expire_date)}`,
        `月额度: ${m.report_credits_total || 0} 次`,
        `已使用: ${m.report_credits_used || 0} 次`,
        `自动续费: ${m.auto_renew ? '是' : '否'}`,
        m.family_member_ids && m.family_member_ids.length > 0
          ? `家庭成员: ${m.family_member_ids.length} 人`
          : '',
        m.auto_renew && m.renew_price
          ? `续费价格: ¥${((m.renew_price || 0) / 100).toFixed(2)}`
          : '',
      ].filter(Boolean).join('\n');

      alert(info);
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
 * 取消会员
 */
async function cancelMember(memberId) {
  confirmedAction('确定要取消此会员？', function() {
    return callCloudFunction('adminGateway', {
      action: 'cancelMember',
      memberId: memberId,
    });
  }, '会员已取消', function() { loadMembers(membersCurrentPage); });
}

/**
 * 初始化会员管理
 */
function initMembersModule() {
  bindFilterEvents([
    { elementId: 'memberTypeFilter' },
    { elementId: 'memberStatusFilter' }
  ], loadMembers);

  const searchBtn = document.getElementById('memberSearchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => loadMembers(1));
  }

  const searchInput = document.getElementById('memberSearchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') loadMembers(1);
    });
  }

  loadMembers(1);
}
