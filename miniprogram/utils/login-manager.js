// login-manager.js - Login flow management utilities

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
      console.log('=== Starting silent login ===');

      wx.login({
        success: (res) => {
          if (res.code) {
            console.log('Code obtained successfully:', res.code);
            this.callSilentLoginCloudFunction(res.code);
          } else {
            console.error('wx.login failed:', res.errMsg);
            this.enterGuestMode();
          }
        },
        fail: (err) => {
          console.error('wx.login exception:', err);
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
      console.log('=== Preparing to call silentLogin cloud function ===');

      if (!app.globalData.cloudDevelopmentAvailable) {
        console.log('⚠️ Cloud development unavailable, using simulated login');
        this.simulatedLogin();
        if (resolveCallback) resolveCallback();
        return;
      }

      wx.cloud.callFunction({
        name: 'silentLogin',
        data: { code: code },
        success: (res) => {
          console.log('Cloud function called successfully, response:', res);
          const result = res.result;

          if (result && result.code === 0) {
            console.log('✅ Silent login successful');
            console.log('Is new user:', result.data.isNewUser);
            console.log('Guest mode:', !result.data.userInfo.isMember);

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

            console.log('=== Silent login complete, user can use app seamlessly ===');
          } else {
            console.error('Cloud function login failed, result:', result);
            this.enterGuestMode();
          }
          if (resolveCallback) resolveCallback();
        },
        fail: (err) => {
          console.error('❌ Cloud function call failed:', err);
          console.error('Error details:', err.errMsg);
          console.log('⚠️ Cloud function call failed, entering degraded mode, app still usable');

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
      console.log('=== Entering guest mode ===');

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
      console.log('=== Entering offline mode ===');

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
        console.log('Token expired, re-logging in');
        this.silentLogin();
      }
    },

    /**
     * Requests user authorization for profile information
     * @param {Function} callback - Callback function with authorization result
     */
    requestUserAuthorization: function(callback) {
      console.log('=== Requesting user profile authorization ===');

      wx.getUserProfile({
        desc: '用于完善您的宠物档案信息',
        success: (res) => {
          console.log('User authorization successful');

          const userInfo = res.userInfo;
          console.log('User profile obtained:', userInfo);

          this.saveUserProfile(userInfo, callback);
        },
        fail: (err) => {
          console.log('User denied authorization:', err);
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
          console.log('User profile saved successfully');

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
          console.error('Failed to save user profile:', err);
          if (callback) {
            callback({ success: false, error: err });
          }
        }
      });
    }
  };
}

module.exports = { createLoginManager };
