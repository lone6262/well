// 家庭成员管理页
const logger = require('../../utils/logger.js')
const log = logger.child('MemberFamily')
const app = getApp();

Page({
  data: {
    members: [],
    loading: true,
    isOwner: false,
    maxMembers: 4,
    inviteCode: '',
    showInviteModal: false,
  },

  onLoad() {
    // 检查登录状态
    if (!this.checkLogin()) {
      return
    }
    this.loadFamilyMembers();
  },

  // 检查登录状态
  checkLogin() {
    let openid = app.getOpenid()
    if (!openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/user/index'
        })
      }, 1500)
      return false
    }
    return true
  },

  onShow() {
    this.loadFamilyMembers();
  },

  async loadFamilyMembers() {
    this.setData({ loading: true });
    try {
      const token = wx.getStorageSync('token');
      const res = await wx.cloud.callFunction({
        name: 'getFamilyMembers',
        data: { token },
      });

      if (res.result.code === 0) {
        const data = res.result.data;
        this.setData({
          members: data.members || [],
          isOwner: data.isOwner || false,
        });
      } else {
        wx.showToast({ title: res.result.msg || '加载失败', icon: 'none' });
      }
    } catch (err) {
      log.error('加载家庭成员失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onInviteFamily() {
    if (!this.data.isOwner) {
      wx.showToast({ title: '仅主账号可邀请', icon: 'none' });
      return;
    }

    try {
      const token = wx.getStorageSync('token');
      const res = await wx.cloud.callFunction({
        name: 'inviteFamilyMember',
        data: { token },
      });

      if (res.result.code === 0) {
        this.setData({
          inviteCode: res.result.data.inviteCode,
          showInviteModal: true,
        });
      } else {
        wx.showToast({ title: res.result.msg || '邀请失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onCopyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => wx.showToast({ title: '已复制邀请码', icon: 'success' }),
    });
  },

  onCloseInviteModal() {
    this.setData({ showInviteModal: false });
  },

  async onAcceptInvite() {
    wx.showModal({
      title: '加入家庭',
      editable: true,
      placeholderText: '请输入邀请码',
      success: async (res) => {
        if (!res.confirm || !res.content) return;

        try {
          const token = wx.getStorageSync('token');
          const result = await wx.cloud.callFunction({
            name: 'acceptFamilyInvite',
            data: { inviteCode: res.content.trim(), token },
          });

          if (result.result.code === 0) {
            wx.showToast({ title: '加入成功', icon: 'success' });
            this.loadFamilyMembers();
          } else {
            wx.showToast({ title: result.result.msg || '加入失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  },

  async onRemoveMember(e) {
    const targetUserId = e.currentTarget.dataset.userid;
    const nickname = e.currentTarget.dataset.nickname || '该成员';

    wx.showModal({
      title: '确认移除',
      content: `确定移除${nickname}？已消耗的额度不会被追溯。`,
      success: async (res) => {
        if (!res.confirm) return;

        try {
          const token = wx.getStorageSync('token');
          const result = await wx.cloud.callFunction({
            name: 'removeFamilyMember',
            data: { targetUserId, token },
          });

          if (result.result.code === 0) {
            wx.showToast({ title: '已移除', icon: 'success' });
            this.loadFamilyMembers();
          } else {
            wx.showToast({ title: result.result.msg || '移除失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  },
});
