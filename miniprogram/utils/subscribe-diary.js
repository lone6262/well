/**
 * 日记订阅消息合规助手（Phase 3 §6.1）
 *
 * 合规要点（qw-2）：wx.requestSubscribeMessage 必须在用户「主动点击」的交互期间调用，
 * 禁止在 onLoad/onShow 自动弹，禁止用"立即领取/否则丢失"等诱导话术。
 * 各页面在按钮 bindtap 里调 requestDiarySubscribe(app) 即可。
 *
 * 一次性订阅机制：用户每 accept 一次 → 调 saveUserProfile(diary_subscribe_accept)
 * 服务端 diary_subscribe_quota +1；generatePetDiary 定时任务发送时 -1，43101 归零。
 */
var log = require('./logger.js').child('DiarySubscribe');
var subscribeConfig = require('../config/subscribe.js');

/**
 * 拉起日记订阅授权弹窗（必须在用户点击事件里调用）
 * @param {object} app - getApp() 实例（取 token）
 */
function requestDiarySubscribe(app) {
  var tmplId = subscribeConfig.DIARY_TEMPLATE_ID;
  if (!tmplId) {
    log.warn('未配置 DIARY_TEMPLATE_ID，跳过订阅');
    return;
  }
  var token = (app && app.globalData && app.globalData.token) || '';

  wx.requestSubscribeMessage({
    tmplIds: [tmplId],
    success: function (res) {
      if (res[tmplId] === 'accept') {
        wx.cloud.callFunction({
          name: 'saveUserProfile',
          data: { action: 'diary_subscribe_accept', token: token },
          success: function (r) {
            if (r.result && r.result.code === 0) {
              log.info('日记订阅 accept，配额 +1');
              wx.showToast({ title: '已开启明日提醒', icon: 'success' });
            } else {
              log.warn('配额累加返回非 0:', r.result);
            }
          },
          fail: function (err) {
            log.warn('配额累加请求失败:', err);
          }
        });
      }
      // reject / ban 静默，不纠缠
    },
    fail: function () {
      // 用户关闭授权弹窗或接口不可用，静默
    }
  });
}

module.exports = {
  requestDiarySubscribe: requestDiarySubscribe
};
