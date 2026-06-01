import re
f = open("profile.wxml", encoding="utf-8")
c = f.read()
f.close()
old = '      <!-- \u5e95\u90e8\u64cd\u4f5c\u680f -->\n      <view class="pet-card-footer">'
new = '      <!-- \u81ea\u67e5\u8bb0\u5f55 & \u5065\u5eb7\u62a5\u544a\u5165\u53e3 -->\n      <view class="pet-records-section">\n        <view class="record-entry" bindtap="showPetRecords" data-pet-id="{{item._id}}" data-pet-name="{{item.name}}">\n          <text class="record-entry-icon">\U0001f4cb</text>\n          <text class="record-entry-text">\u81ea\u67e5\u8bb0\u5f55</text>\n          <text class="record-count-badge">{{item.recordCount or 0}}\u6761</text>\n          <text class="record-entry-arrow">\u203a</text>\n        </view>\n        <view class="record-entry" bindtap="showPetReports" data-pet-id="{{item._id}}" data-pet-name="{{item.name}}">\n          <text class="record-entry-icon">\U0001f4ca</text>\n          <text class="record-entry-text">\u5065\u5eb7\u62a5\u544a</text>\n          <text class="record-count-badge">{{item.reportCount or 0}}\u6761</text>\n          <text class="record-entry-arrow">\u203a</text>\n        </view>\n      </view>\n\n      <!-- \u5e95\u90e8\u64cd\u4f5c\u680f -->\n      <view class="pet-card-footer">'
c = c.replace(old, new)
f = open("profile.wxml", "w", encoding="utf-8")
f.write(c)
f.close()
print("Done")
