f = open("records.js", encoding="utf-8")
c = f.read()
f.close()
old = "fail: function() {\n              wx.hideLoading();\n              wx.showToast({ title: '\u5220\u9664\u5931\u8d25', icon: 'none' });\n            }"
new = "fail: function(err) {\n              wx.hideLoading();\n              console.error('\u5220\u9664\u4e91\u51fd\u6570\u8c03\u7528\u5931\u8d25:', err);\n              wx.showToast({ title: '\u5220\u9664\u5931\u8d25\uff0c\u8bf7\u786e\u8ba4\u4e91\u51fd\u6570\u5df2\u90e8\u7f72', icon: 'none', duration: 2000 });\n            }"
c = c.replace(old, new)
f = open("records.js", "w", encoding="utf-8")
f.write(c)
f.close()
print("Done")
