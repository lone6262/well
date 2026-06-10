// 领券中心
const logger = require('../../utils/logger.js')
const log = logger.child('CouponReceive')
const app = getApp();

Page({
  data: {
    coupons: [],
    loading: true,
  },

  onLoad() {
    this.loadAvailableCoupons();
  },

  onPullDownRefresh() {
    this.loadAvailableCoupons().then(() => wx.stopPullDownRefresh());
  },

  async loadAvailableCoupons() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminGateway',
        data: { action: 'getCoupons', isActive: true },
      });
      if (res.result.code === 0) {
        const coupons = (res.result.data.coupons || []).map(c => ({
          ...c,
          discount_display: c.discount_type === 'fixed'
            ? '¥' + ((c.discount_value || 0) / 100).toFixed(2)
            : c.discount_value + '折',
          min_amount_display: ((c.min_amount || 0) / 100).toFixed(2),
          type_text: c.type === 'report' ? '报告' : c.type === 'member' ? '会员' : c.type === 'points' ? '点数包' : '通用',
          scene_text: { new_user: '新用户', invite: '邀请', followup: '回访', renew: '续费', return: '回归' }[c.scene] || '',
          remaining: c.total_limit ? (c.total_limit - (c.total_issued || 0)) : '不限',
        }));
        this.setData({ coupons });
      }
    } catch (err) {
      log.error('加载优惠券失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async onReceiveCoupon(e) {
    const couponId = e.currentTarget.dataset.id;
    try {
      const token = wx.getStorageSync('token');
      const res = await wx.cloud.callFunction({
        name: 'receiveCoupon',
        data: { couponId, token },
      });
      if (res.result.code === 0) {
        wx.showToast({ title: '领取成功', icon: 'success' });
        this.loadAvailableCoupons();
      } else {
        wx.showToast({ title: res.result.msg || '领取失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: '领取失败', icon: 'none' });
    }
  },
});
