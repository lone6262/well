f = open("profile.wxml", encoding="utf-8")
c = f.read()
f.close()
last = c.rstrip().rfind("</view>")
modal = """  <!-- \u8bb0\u5f55\u5217\u8868\u5f39\u7a97 -->
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
c = c[:last] + modal + c[last:]
f = open("profile.wxml", "w", encoding="utf-8")
f.write(c)
f.close()
print("Done")
