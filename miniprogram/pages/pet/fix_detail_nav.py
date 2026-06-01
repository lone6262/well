f = open("profile.js", encoding="utf-8")
js = f.read()
f.close()

# Add riskLevel to the list items
old = """              icon: iconMap[level] || '\u2705',
              bgColor: bgMap[level] || '#E8F5E9',
              title: (r.symptoms || []).slice(0, 3).join(', ') || '\u81ea\u67e5\u8bb0\u5f55',
              desc: (r.createdAt || '').substring(0, 10) + ' \u00b7 ' + (levelText[level] || '\u4f4e\u98ce\u9669')"""
new = """              icon: iconMap[level] || '\u2705',
              bgColor: bgMap[level] || '#E8F5E9',
              title: (r.symptoms || []).slice(0, 3).join(', ') || '\u81ea\u67e5\u8bb0\u5f55',
              desc: (r.createdAt || '').substring(0, 10) + ' \u00b7 ' + (levelText[level] || '\u4f4e\u98ce\u9669'),
              riskLevel: level"""
js = js.replace(old, new)

# Update viewRecordDetail to pass riskLevel
old2 = """  viewRecordDetail: function(e) {
    var recordId = e.currentTarget.dataset.recordId;
    if (!recordId) return;
    wx.navigateTo({
      url: '/pages/risk/result?assessmentId=' + recordId
    });
  },"""
new2 = """  viewRecordDetail: function(e) {
    var recordId = e.currentTarget.dataset.recordId;
    var record = this.data.recordList.find(function(r) { return r._id === recordId; });
    if (!recordId) return;
    wx.navigateTo({
      url: '/pages/risk/result?assessmentId=' + recordId + '&riskLevel=' + (record ? record.riskLevel : 'low')
    });
  },"""
js = js.replace(old2, new2)

f = open("profile.js", "w", encoding="utf-8")
f.write(js)
f.close()
print("Detail nav updated")
