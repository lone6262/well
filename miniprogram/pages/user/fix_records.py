f = open('records.wxml', encoding='utf-8')
c = f.read()
f.close()
old = '\u70b9\u51fb\u67e5\u770b\u8be6\u60c5 \u203a'
new = '\u70b9\u51fb\u67e5\u770b\u8be6\u60c5 \u203a</text>\n        <view class=\"delete-record-btn\" catchtap=\"deleteRecord\" data-id=\"{{item._id}}\">\u5220\u9664</view>'
c = c.replace(old, new)
f = open('records.wxml', 'w', encoding='utf-8')
f.write(c)
f.close()
print('WXML done')
