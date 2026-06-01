f = open('records.js', encoding='utf-8')
c = f.read()
f.close()

# Add delete function before goBack
old = '  // 返回\n  goBack: function() {'
new = '''  // 删除记录
  deleteRecord: function(e) {
    var self = this;
    var recordId = e.currentTarget.dataset.id;
    if (!recordId) return;
    wx.showModal({
      title: '\u786e\u8ba4\u5220\u9664',
      content: '\u5220\u9664\u540e\u65e0\u6cd5\u6062\u590d\uff0c\u786e\u5b9a\u8981\u5220\u9664\u8fd9\u6761\u8bb0\u5f55\u5417\uff1f',
      success: function(res) {
        if (res.confirm) {
          if (!app.globalData.cloudDevelopmentAvailable) {
            // 本地存储模式
            var records = self.data.records.filter(function(r) { return r._id !== recordId; });
            self.setData({ records: records });
            wx.showToast({ title: '\u5df2\u5220\u9664', icon: 'success' });
            return;
          }
          wx.showLoading({ title: '\u5220\u9664\u4e2d...' });
          wx.cloud.callFunction({
            name: 'deleteRecord',
            data: { openid: app.getOpenid(), recordId: recordId },
            success: function(res) {
              wx.hideLoading();
              if (res.result && res.result.code === 0) {
                var records = self.data.records.filter(function(r) { return r._id !== recordId; });
                self.setData({ records: records });
                wx.showToast({ title: '\u5df2\u5220\u9664', icon: 'success' });
              } else {
                wx.showToast({ title: res.result.msg || '\u5220\u9664\u5931\u8d25', icon: 'none' });
              }
            },
            fail: function() {
              wx.hideLoading();
              wx.showToast({ title: '\u5220\u9664\u5931\u8d25', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 返回
  goBack: function() {'''
c = c.replace(old, new)

f = open('records.js', 'w', encoding='utf-8')
f.write(c)
f.close()
print('JS done')
