// 组合套餐页 — V2.1: 价格从 getPrices 云端加载
const app = getApp();
const priceService = require('../../utils/price-service')
const { invokePayment } = require('../../utils/pay')

Page({
  data: {
    bundles: [],
    purchasing: false,
  },

  onLoad: function() {
    // 检查登录状态
    if (!this.checkLogin()) {
      return
    }
    this.loadPrices()
  },

  // 检查登录状态
  checkLogin: function() {
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

  /** 通过公共服务加载套餐价格 */
  loadPrices: function() {
    var self = this
    priceService.fetchPricesWithCallback(function(d) {
      if (!d || !d.bundles) return
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

          if (!result.result || result.result.code !== 0) {
            wx.showToast({ title: (result.result && result.result.msg) || '购买失败', icon: 'none' });
            return;
          }
          const data = result.result.data || {};
          if (data.payParams) {
            // 真实支付：调起微信支付，成功后套餐内容由 payCallback 异步激活
            try {
              await invokePayment(data.payParams);
              wx.showToast({ title: '购买成功', icon: 'success' });
              setTimeout(() => wx.switchTab({ url: '/pages/user/index' }), 1500);
            } catch (e) {
              wx.showToast({ title: '支付未完成', icon: 'none' });
            }
          } else {
            // mock/0 元：套餐已直接生效
            wx.showToast({ title: '购买成功', icon: 'success' });
            setTimeout(() => wx.switchTab({ url: '/pages/user/index' }), 1500);
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
