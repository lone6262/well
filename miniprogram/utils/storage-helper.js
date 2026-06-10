// storage-helper.js - Login state storage management utilities

const logger = require('./logger.js')
const log = logger.child('StorageHelper')

/**
 * Saves login state to WeChat storage
 * @param {Object} globalData - The app's globalData object
 */
function saveLoginState(globalData) {
  if (!globalData) {
    log.error('saveLoginState: globalData is required')
    return;
  }

  try {
    if (globalData.token) {
      wx.setStorageSync('token', globalData.token);
    }
    if (globalData.openid) {
      wx.setStorageSync('openid', globalData.openid);
    }
    if (globalData.userInfo) {
      wx.setStorageSync('userInfo', globalData.userInfo);
    }
    wx.setStorageSync('lastLoginTime', Date.now());
    wx.setStorageSync('isGuest', globalData.isGuest);

    log.info('Login state saved to storage')
  } catch (error) {
    log.error('Failed to save login state:', error)
  }
}

/**
 * Restores login state from WeChat storage into globalData
 * @param {Object} globalData - The app's globalData object
 * @returns {string|null} The restored openid, or null if not found
 */
function restoreLoginState(globalData) {
  if (!globalData) {
    log.error('restoreLoginState: globalData is required')
    return null;
  }

  log.info('Restoring login state from local storage')

  try {
    let restoredOpenid = null;

    // Restore openid
    const storedOpenid = wx.getStorageSync('openid');
    if (storedOpenid) {
      globalData.openid = storedOpenid;
      restoredOpenid = storedOpenid;
      log.info('Login state restored')
    }

    // Restore token
    const storedToken = wx.getStorageSync('token');
    if (storedToken) {
      globalData.token = storedToken;
      log.info('Token restored')
    }

    // Restore user info
    const storedUserInfo = wx.getStorageSync('userInfo');
    if (storedUserInfo) {
      globalData.userInfo = storedUserInfo;
      log.info('User info restored')
    }

    // Restore guest mode status
    const isGuest = wx.getStorageSync('isGuest');
    if (typeof isGuest === 'boolean') {
      globalData.isGuest = isGuest;
      log.info('Guest mode status restored:', isGuest)
    }

    // Restore location permission status
    const storedLocationPermission = wx.getStorageSync('locationPermission');
    if (storedLocationPermission) {
      globalData.locationPermission = storedLocationPermission;
      log.info('Location permission status restored:', storedLocationPermission)
    }

    // Restore location cache
    const cachedLatitude = wx.getStorageSync('cachedLatitude');
    const cachedLongitude = wx.getStorageSync('cachedLongitude');
    const cachedLocationTime = wx.getStorageSync('cachedLocationTime');

    if (cachedLatitude && cachedLongitude && cachedLocationTime) {
      const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
      const currentTime = Date.now();

      if ((currentTime - cachedLocationTime) < LOCATION_CACHE_DURATION) {
        globalData.latitude = cachedLatitude;
        globalData.longitude = cachedLongitude;
        globalData.locationUpdateTime = cachedLocationTime;
        log.info('Location cache restored')
      }
    }

    return restoredOpenid;
  } catch (error) {
    log.error('Failed to restore login state:', error)
    return null;
  }
}

/**
 * Clears all login-related storage
 */
function clearLoginState() {
  try {
    wx.removeStorageSync('token');
    wx.removeStorageSync('openid');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('lastLoginTime');
    wx.removeStorageSync('isGuest');
    log.info('Login state cleared from storage')
  } catch (error) {
    log.error('Failed to clear login state:', error)
  }
}

module.exports = {
  saveLoginState,
  restoreLoginState,
  clearLoginState
};
