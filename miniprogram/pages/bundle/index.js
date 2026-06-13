// 组合套餐页 — V2.1: 价格从 getPrices 云端加载
const app = getApp();

Page({
  data: {
    bundles: [],
    purchasing: false,
  },

  onLoad: function() {
    this.loadPrices()
  },

  /** V2.1: 从 getPrices 动态加载套餐 */
  loadPrices: function() {
    var self = this
    wx.cloud.callFunction({
      name: 'getPrices',
      data: {},
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var d = res.result.data
          self.setData({
            bundles: [
              {
                key: 'STARTER',
                name: d.bundles.starter.name,
                desc: d.bundles.starter.desc,
                price: d.bundles.starter.display,
                originPrice: d.bundles.starter.originDisplay,
                save: d.bundles.starter.saveDisplay,
                items: d.bundles.starter.items,
              },
              {
                key: 'ESSENTIAL',
                name: d.bundles.essential.name,
                desc: d.bundles.essential.desc,
                price: d.bundles.essential.display,
                originPrice: d.bundles.essential.originDisplay,
                save: d.bundles.essential.saveDisplay,
                items: d.bundles.essential.items,
              },
              {
                key: 'FAMILY',
                name: d.bundles.family.name,
                desc: d.bundles.family.desc,
                price: d.bundles.family.display,
                originPrice: d.bundles.family.originDisplay,
                save: d.bundles.family.saveDisplay,
                items: d.bundles.family.items,
              },
            ],
          })
        }
      }
    })
  },

  async onPurchaseBundle(e) {
    const bundleKey = e.currentTarget.dataset.key;
    if (this.data.purchasing) return;

    var bundles = this.data.bundles
    wx.showModal({
      title: '确认购买',
      content: '确定购买' + bundles.find(function(b) { return b.key === bundleKey }).name + '？',
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
