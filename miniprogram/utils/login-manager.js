// login-manager.js - Login flow management utilities

const logger = require('./logger.js')
const log = logger.child('LoginManager')

/**
 * Creates a login manager instance
 * @param {Object} app - The app instance (containing globalData and methods)
 * @returns {Object} Login manager with methods for login operations
 */
function createLoginManager(app) {
  return {
    /**
     * Performs silent login flow
     */
    silentLogin: function() {
      log.info('=== Starting silent login ===');

      wx.login({
        success: (res) => {
          if (res.code) {
            log.info('Code obtained successfully:', res.code);
            this.callSilentLoginCloudFunction(res.code);
          } else {
            log.error('wx.login failed:', res.errMsg);
            this.enterGuestMode();
          }
        },
        fail: (err) => {
          log.error('wx.login exception:', err);
          this.enterGuestMode();
        }
      });
    },

    /**
     * Calls the silent login cloud function
     * @param {string} code - The wx.login code
     * @param {Function} resolveCallback - Optional callback for completion
     */
    callSilentLoginCloudFunction: function(code, resolveCallback) {
      log.info('=== Preparing to call silentLogin cloud function ===');

      if (!app.globalData.cloudDevelopmentAvailable) {
        log.info('⚠️ Cloud development unavailable, using simulated login');
        this.simulatedLogin();
        if (resolveCallback) resolveCallback();
        return;
      }

      wx.cloud.callFunction({
        name: 'silentLogin',
        data: { code: code },
        success: (res) => {
          log.info('Cloud function called successfully, response:', res);
          const result = res.result;

          if (result && result.code === 0) {
            log.info('✅ Silent login successful');
            log.info('Is new user:', result.data.isNewUser);
            log.info('Guest mode:', !result.data.userInfo.isMember);

            // Save login information
            app.globalData.token = result.data.token;
            app.globalData.openid = result.data.openid;
            app.globalData.userInfo = result.data.userInfo;
            app.globalData.isGuest = !result.data.userInfo.isMember;

            wx.setStorageSync('token', result.data.token);
            wx.setStorageSync('openid', result.data.openid);
            wx.setStorageSync('userInfo', result.data.userInfo);
            wx.setStorageSync('lastLoginTime', Date.now());

            // Notify all waiting pages
            app._notifyLoginComplete(result.data.openid);

            log.info('=== Silent login complete, user can use app seamlessly ===');
          } else {
            log.error('Cloud function login failed, result:', result);
            this.enterGuestMode();
          }
          if (resolveCallback) resolveCallback();
        },
        fail: (err) => {
          log.error('❌ Cloud function call failed:', err);
          log.error('Error details:', err.errMsg);
          log.info('⚠️ Cloud function call failed, entering degraded mode, app still usable');

          app.globalData.cloudDevelopmentAvailable = false;
          this.simulatedLogin();
          if (resolveCallback) resolveCallback();
        }
      });
    },

    /**
     * Enters guest mode (when cloud development is unavailable)
     */
    enterGuestMode: function() {
      log.info('=== Entering guest mode ===');

      app.globalData.isGuest = true;
      app.globalData.userInfo = {
        nickName: '宠物主人',
        avatarUrl: '',
        isMember: false
      };

      wx.setStorageSync('isGuest', true);
    },

    /**
     * Enters offline mode (when network is unavailable)
     */
    enterOfflineMode: function() {
      log.info('=== Entering offline mode ===');

      app.globalData.userInfo = {
        nickName: '宠物主人',
        avatarUrl: '',
        isMember: false
      };
      app.globalData.isGuest = true;
      app.globalData.cloudDevelopmentAvailable = false;

      wx.setStorageSync('isGuest', true);
      wx.setStorageSync('cloudDevelopmentAvailable', false);

      wx.showToast({
        title: '网络不可用，部分功能受限',
        icon: 'none',
        duration: 3000
      });

      // Notify waiting pages (openid is empty)
      app._notifyLoginComplete('');
    },

    /**
     * Simulated login (deprecated, use enterOfflineMode instead)
     */
    simulatedLogin: function() {
      this.enterOfflineMode();
    },

    /**
     * Checks if token needs refresh and refreshes if needed
     */
    refreshTokenIfNeeded: function() {
      const token = wx.getStorageSync('token');

      if (!token) {
        this.silentLogin();
        return;
      }

      const lastLoginTime = wx.getStorageSync('lastLoginTime');
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      if (now - lastLoginTime > sevenDays) {
        log.info('Token expired, re-logging in');
        this.silentLogin();
      }
    },

    /**
     * Requests user authorization for profile information
     * @param {Function} callback - Callback function with authorization result
     */
    requestUserAuthorization: function(callback) {
      log.info('=== Requesting user profile authorization ===');

      wx.getUserProfile({
        desc: '用于完善您的宠物档案信息',
        success: (res) => {
          log.info('User authorization successful');

          const userInfo = res.userInfo;
          log.info('User profile obtained:', userInfo);

          this.saveUserProfile(userInfo, callback);
        },
        fail: (err) => {
          log.info('User denied authorization:', err);
          if (callback) {
            callback({ success: false, isGuest: true });
          }
        }
      });
    },

    /**
     * Saves user profile to backend
     * @param {Object} userInfo - User profile information
     * @param {Function} callback - Callback function with save result
     */
    saveUserProfile: function(userInfo, callback) {
      wx.cloud.callFunction({
        name: 'saveUserProfile',
        data: {
          userInfo: {
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl,
            gender: userInfo.gender,
            country: userInfo.country,
            province: userInfo.province
          }
        },
        success: (res) => {
          log.info('User profile saved successfully');

          const updatedUserInfo = {
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl,
            isMember: true
          };

          app.globalData.userInfo = updatedUserInfo;
          app.globalData.isGuest = false;

          wx.setStorageSync('userInfo', updatedUserInfo);
          wx.setStorageSync('isGuest', false);

          if (callback) {
            callback({ success: true, userInfo: updatedUserInfo });
          }
        },
        fail: (err) => {
          log.error('Failed to save user profile:', err);
          if (callback) {
            callback({ success: false, error: err });
          }
        }
      });
    }
  };
}

module.exports = { createLoginManager };
