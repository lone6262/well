f = open("profile.js", encoding="utf-8")
js = f.read()
f.close()

# Add data fields for record modal
old_data = "    loading: true,"
new_data = "    showRecordModal: false,\n    recordModalTitle: '',\n    recordList: [],\n    currentRecordPetId: '',\n    loading: true,"
js = js.replace(old_data, new_data)

# Add functions before the closing })
funcs = """
  // === 自查记录 ===
  showPetRecords: function(e) {
    var petId = e.currentTarget.dataset.petId;
    var petName = e.currentTarget.dataset.petName;
    this.loadRecordsByPet(petId, petName, 'record');
  },

  // === 健康报告 ===
  showPetReports: function(e) {
    var petId = e.currentTarget.dataset.petId;
    var petName = e.currentTarget.dataset.petName;
    this.loadRecordsByPet(petId, petName, 'report');
  },

  // === 加载宠物相关的记录 ===
  loadRecordsByPet: function(petId, petName, type) {
    var self = this;
    self.setData({
      currentRecordPetId: petId,
      showRecordModal: true,
      recordModalTitle: (type === 'record' ? '\u81ea\u67e5\u8bb0\u5f55 - ' : '\u5065\u5eb7\u62a5\u544a - ') + petName,
      recordList: []
    });

    if (!app.globalData.cloudDevelopmentAvailable) {
      self.setData({ recordList: [] });
      return;
    }

    wx.cloud.callFunction({
      name: 'getRecordList',
      data: {
        openid: app.getOpenid(),
        page: 1,
        pageSize: 50
      },
      success: function(res) {
        if (res.result.code === 0) {
          var allRecords = res.result.data.records || [];
          var petRecords = allRecords.filter(function(r) { return r.petId === petId; });
          var list = petRecords.map(function(r) {
            var level = r.riskLevel || 'low';
            var iconMap = { low: '\u2705', mid: '\u26a0\ufe0f', high: '\u274c' };
            var bgMap = { low: '#E8F5E9', mid: '#FFF3E0', high: '#FFEBEE' };
            var levelText = { low: '\u4f4e\u98ce\u9669', mid: '\u4e2d\u7b49\u98ce\u9669', high: '\u9ad8\u98ce\u9669' };
            return {
              _id: r._id,
              icon: iconMap[level] || '\u2705',
              bgColor: bgMap[level] || '#E8F5E9',
              title: (r.symptoms || []).slice(0, 3).join(', ') || '\u81ea\u67e5\u8bb0\u5f55',
              desc: (r.createdAt || '').substring(0, 10) + ' \u00b7 ' + (levelText[level] || '\u4f4e\u98ce\u9669')
            };
          });
          self.setData({ recordList: list });
        }
      },
      fail: function() {
        self.setData({ recordList: [] });
      }
    });
  },

  // === 关闭弹窗 ===
  hideRecordModal: function() {
    this.setData({ showRecordModal: false });
  },

  // === 查看记录详情 ===
  viewRecordDetail: function(e) {
    var recordId = e.currentTarget.dataset.recordId;
    if (!recordId) return;
    wx.navigateTo({
      url: '/pages/risk/result?assessmentId=' + recordId
    });
  },
"""

js = js.rstrip() + "\n" + funcs + "\n})"
f = open("profile.js", "w", encoding="utf-8")
f.write(js)
f.close()
print("JS functions added")
