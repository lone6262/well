import re

# ===== 1. Add CSS styles =====
f = open("profile.wxss", encoding="utf-8")
css = f.read()
f.close()

records_css = """
/* === 自查记录 & 健康报告入口 === */
.pet-records-section {
  margin: 16rpx 0;
  border-top: 1rpx solid #F0F2F5;
  padding-top: 8rpx;
}

.record-entry {
  display: flex;
  align-items: center;
  padding: 20rpx 8rpx;
  border-radius: 12rpx;
  margin-bottom: 4rpx;
  transition: background 0.2s;
}

.record-entry:active {
  background: #F5F6FA;
}

.record-entry-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.record-entry-text {
  flex: 1;
  font-size: 26rpx;
  color: #333333;
  font-weight: 500;
}

.record-count-badge {
  font-size: 22rpx;
  color: #999999;
  background: #F0F2F5;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  margin-right: 8rpx;
}

.record-entry-arrow {
  font-size: 32rpx;
  color: #CCCCCC;
}

/* === 记录列表弹窗 === */
.record-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.record-modal-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #FFFFFF;
  border-radius: 24rpx 24rpx 0 0;
  z-index: 1001;
  max-height: 75vh;
  display: flex;
  flex-direction: column;
}

.record-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 32rpx;
  border-bottom: 1rpx solid #F0F2F5;
}

.record-modal-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333333;
}

.record-modal-close {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #F0F2F5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #666666;
}

.record-modal-list {
  flex: 1;
  overflow-y: auto;
  padding: 16rpx 32rpx;
  max-height: 60vh;
}

.record-list-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F5F6FA;
}

.record-list-item:last-child {
  border-bottom: none;
}

.record-item-icon {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.record-item-info {
  flex: 1;
}

.record-item-title {
  font-size: 26rpx;
  color: #333333;
  font-weight: 500;
  margin-bottom: 4rpx;
}

.record-item-desc {
  font-size: 22rpx;
  color: #999999;
}

.record-item-arrow {
  font-size: 28rpx;
  color: #CCCCCC;
  margin-left: 12rpx;
}

.record-modal-empty {
  text-align: center;
  padding: 80rpx 0;
  color: #999999;
  font-size: 26rpx;
}
"""

css = css.strip() + "\n" + records_css
f = open("profile.wxss", "w", encoding="utf-8")
f.write(css)
f.close()
print("CSS added")

# ===== 2. Add record list modal to WXML =====
f = open("profile.wxml", encoding="utf-8")
wxml = f.read()
f.close()

modal_html = """
  <!-- 记录列表弹窗 -->
  <view class="record-modal-mask" wx:if="{{showRecordModal}}" bindtap="hideRecordModal"></view>
  <view class="record-modal-sheet" wx:if="{{showRecordModal}}">
    <view class="record-modal-header">
      <text class="record-modal-title">{{recordModalTitle}}</text>
      <view class="record-modal-close" bindtap="hideRecordModal">\u2716</view>
    </view>
    <view class="record-modal-list">
      <view class="record-list-item" wx:for="{{recordList}}" wx:key="_id" bindtap="viewRecordDetail" data-record-id="{{item._id}}">
        <view class="record-item-icon" style="background: {{item.bgColor}};">{{item.icon}}</view>
        <view class="record-item-info">
          <text class="record-item-title">{{item.title}}</text>
          <text class="record-item-desc">{{item.desc}}</text>
        </view>
        <text class="record-item-arrow">\u203a</text>
      </view>
      <view class="record-modal-empty" wx:if="{{recordList.length === 0}}">\u6682\u65e0\u8bb0\u5f55</view>
    </view>
  </view>
"""

# Insert before the closing </view>
wxml = wxml.replace("</view>\n</view>\n", "</view>\n" + modal_html + "\n</view>\n")
wxml = wxml.replace("</view>\n" + modal_html + "\n</view>\n</view>\n", modal_html + "\n</view>\n</view>\n")

f = open("profile.wxml", "w", encoding="utf-8")
f.write(wxml)
f.close()
print("Modal added")

print("Done all")
