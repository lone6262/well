// 组合套餐页
const app = getApp();

Page({
  data: {
    bundles: [
      {
        key: 'STARTER',
        name: '新手礼包',
        desc: '月卡 + 3 次点数包',
        price: 29.90,
        originPrice: 39.80,
        save: 9.90,
        items: ['个人月卡（3 次/月）', '3 次点数包（90 天有效）'],
      },
      {
        key: 'ESSENTIAL',
        name: '铲屎官必备',
        desc: '年卡 + 5 次点数包',
        price: 119.00,
        originPrice: 128.90,
        save: 9.90,
        items: ['个人年卡（3 次/月）', '5 次点数包（90 天有效）'],
      },
      {
        key: 'FAMILY',
        name: '家庭尊享',
        desc: '家庭月卡 + 3 次点数包',
        price: 39.90,
        originPrice: 49.80,
        save: 9.90,
        items: ['家庭月卡（6 次/月，最多 4 人共享）', '3 次点数包（90 天有效）'],
      },
    ],
    purchasing: false,
  },

  async onPurchaseBundle(e) {
    const bundleKey = e.currentTarget.dataset.key;
    if (this.data.purchasing) return;

    wx.showModal({
      title: '确认购买',
      content: `确定购买${this.data.bundles.find(b => b.key === bundleKey).name}？`,
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ purchasing: true });

        try {
          const token = wx.getStorageSync('token');
          const result = await wx.cloud.callFunction({
            name: 'createOrder',
            data: { type: 'bundle', bundleKey, token },
          });

          if (result.result.code === 0) {
            wx.showToast({ title: '购买成功', icon: 'success' });
            setTimeout(() => wx.switchTab({ url: '/pages/user/index' }), 1500);
          } else {
            wx.showToast({ title: result.result.msg || '购买失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '购买失败', icon: 'none' });
        } finally {
          this.setData({ purchasing: false });
        }
      },
    });
  },
});
