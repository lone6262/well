// storage-helper.js - Login state storage management utilities

/**
 * Saves login state to WeChat storage
 * @param {Object} globalData - The app's globalData object
 */
function saveLoginState(globalData) {
  if (!globalData) {
    console.error('saveLoginState: globalData is required');
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
    
    console.log('✅ Login state saved to storage');
  } catch (error) {
    console.error('❌ Failed to save login state:', error);
  }
}

/**
 * Restores login state from WeChat storage into globalData
 * @param {Object} globalData - The app's globalData object
 * @returns {string|null} The restored openid, or null if not found
 */
function restoreLoginState(globalData) {
  if (!globalData) {
    console.error('restoreLoginState: globalData is required');
    return null;
  }

  console.log('=== Restoring login state from local storage ===');

  try {
    let restoredOpenid = null;

    // Restore openid
    const storedOpenid = wx.getStorageSync('openid');
    if (storedOpenid) {
      globalData.openid = storedOpenid;
      restoredOpenid = storedOpenid;
      console.log('✅ Login state restored');
    }

    // Restore token
    const storedToken = wx.getStorageSync('token');
    if (storedToken) {
      globalData.token = storedToken;
      console.log('✅ Token restored');
    }

    // Restore user info
    const storedUserInfo = wx.getStorageSync('userInfo');
    if (storedUserInfo) {
      globalData.userInfo = storedUserInfo;
      console.log('✅ User info restored');
    }

    // Restore guest mode status
    const isGuest = wx.getStorageSync('isGuest');
    if (typeof isGuest === 'boolean') {
      globalData.isGuest = isGuest;
      console.log('✅ Guest mode status restored:', isGuest);
    }

    // Restore location permission status
    const storedLocationPermission = wx.getStorageSync('locationPermission');
    if (storedLocationPermission) {
      globalData.locationPermission = storedLocationPermission;
      console.log('✅ Location permission status restored:', storedLocationPermission);
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
        console.log('✅ Location cache restored');
      }
    }

    return restoredOpenid;
  } catch (error) {
    console.error('❌ Failed to restore login state:', error);
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
    console.log('✅ Login state cleared from storage');
  } catch (error) {
    console.error('❌ Failed to clear login state:', error);
  }
}

module.exports = {
  saveLoginState,
  restoreLoginState,
  clearLoginState
};
