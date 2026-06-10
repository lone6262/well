// 我的优惠券列表
const logger = require('../../utils/logger.js')
const log = logger.child('CouponList')
const app = getApp();

Page({
  data: {
    coupons: [],
    loading: true,
    activeTab: 'unused',
  },

  onLoad() {
    this.loadCoupons();
  },

  onShow() {
    this.loadCoupons();
  },

  async loadCoupons() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getUserCoupons',
        data: { status: this.data.activeTab === 'all' ? undefined : this.data.activeTab },
      });
      if (res.result.code === 0) {
        this.setData({ coupons: res.result.data.coupons || [] });
      } else {
        wx.showToast({ title: res.result.msg || '加载失败', icon: 'none' });
      }
    } catch (err) {
      log.error('加载优惠券失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.loadCoupons();
  },

  onCouponTap(e) {
    const coupon = e.currentTarget.dataset.coupon;
    if (coupon.status === 'unused') {
      wx.showToast({ title: '下单时将自动抵扣', icon: 'none' });
    }
  },
});
