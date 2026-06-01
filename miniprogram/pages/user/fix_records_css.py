f = open('records.wxss', encoding='utf-8')
c = f.read()
f.close()
css = '''

/* === 删除按钮 === */
.delete-record-btn {
  padding: 8rpx 20rpx;
  background: #FFEBEE;
  color: #FF6B6B;
  font-size: 22rpx;
  border-radius: 8rpx;
  font-weight: 500;
}
.delete-record-btn:active {
  background: #FFCDD2;
}
'''
c = c.strip() + '\n' + css
f = open('records.wxss', 'w', encoding='utf-8')
f.write(c)
f.close()
print('CSS done')
