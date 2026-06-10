// location-manager.js - Location management utilities

const logger = require('./logger.js')
const log = logger.child('LocationManager')

/**
 * Creates a location manager instance
 * @param {Function} getGlobalData - Function that returns the app's globalData
 * @returns {Object} Location manager with methods for location operations
 */
function createLocationManager(getGlobalData) {
  const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  const DEFAULT_LOCATION = {
    latitude: 22.543099,  // 深圳市民中心
    longitude: 114.057868
  };

  return {
    /**
     * Gets user location with permission request and caching
     * @param {boolean} forceRefresh - Force refresh even if cache is valid
     * @returns {Promise<{latitude: number, longitude: number}>}
     */
    getUserLocation: function(forceRefresh = false) {
      const globalData = getGlobalData();
      const currentTime = Date.now();

      return new Promise(function(resolve) {
        // If cached location exists and is valid, return it
        if (!forceRefresh &&
            globalData.latitude &&
            globalData.longitude &&
            globalData.locationUpdateTime &&
            (currentTime - globalData.locationUpdateTime) < LOCATION_CACHE_DURATION) {

          log.info('Using cached location');
          resolve({
            latitude: globalData.latitude,
            longitude: globalData.longitude
          });
          return;
        }

        // Request permission first, then get location
        this.requestLocationPermission().then(permissionResult => {
          if (permissionResult.granted) {
            // Has permission, get location
            wx.getLocation({
              type: 'gcj02',
              success: function(res) {
                // Save location to global data and storage
                globalData.latitude = res.latitude;
                globalData.longitude = res.longitude;
                globalData.locationUpdateTime = currentTime;

                wx.setStorageSync('cachedLatitude', res.latitude);
                wx.setStorageSync('cachedLongitude', res.longitude);
                wx.setStorageSync('cachedLocationTime', currentTime);

                log.info('Location obtained:', {
                  latitude: res.latitude,
                  longitude: res.longitude,
                  accuracy: res.accuracy
                });

                resolve({
                  latitude: res.latitude,
                  longitude: res.longitude
                });
              },
              fail: function(error) {
                log.info('Location acquisition failed:', error);

                // Use default location
                globalData.latitude = DEFAULT_LOCATION.latitude;
                globalData.longitude = DEFAULT_LOCATION.longitude;
                globalData.locationUpdateTime = currentTime;

                wx.setStorageSync('cachedLatitude', DEFAULT_LOCATION.latitude);
                wx.setStorageSync('cachedLongitude', DEFAULT_LOCATION.longitude);
                wx.setStorageSync('cachedLocationTime', currentTime);

                log.info('Using default location:', DEFAULT_LOCATION);
                resolve(DEFAULT_LOCATION);
              }
            });
          } else {
            // No permission, use default location
            globalData.latitude = DEFAULT_LOCATION.latitude;
            globalData.longitude = DEFAULT_LOCATION.longitude;
            globalData.locationUpdateTime = currentTime;

            wx.setStorageSync('cachedLatitude', DEFAULT_LOCATION.latitude);
            wx.setStorageSync('cachedLongitude', DEFAULT_LOCATION.longitude);
            wx.setStorageSync('cachedLocationTime', currentTime);

            log.info('No location permission, using default location:', DEFAULT_LOCATION);
            resolve(DEFAULT_LOCATION);
          }
        });
      }.bind(this));
    },

    /**
     * Requests location permission from user
     * @returns {Promise<{granted: boolean}>}
     */
    requestLocationPermission: function() {
      const globalData = getGlobalData();

      return new Promise(function(resolve) {
        // If already granted, return immediately
        if (globalData.locationPermission === 'granted') {
          log.info('Location permission already granted, skipping request');
          resolve({ granted: true });
          return;
        }

        // If already denied, don't request again
        if (globalData.locationPermission === 'denied') {
          log.info('Location permission already denied, not requesting again');
          resolve({ granted: false });
          return;
        }

        log.info('Requesting location permission for first time...');

        // Check permission status using wx.getSetting
        wx.getSetting({
          success: (settingRes) => {
            const hasPermission = settingRes.authSetting['scope.userLocation'];

            if (hasPermission) {
              // Already has permission
              log.info('User already granted location permission');
              globalData.locationPermission = 'granted';
              wx.setStorageSync('locationPermission', 'granted');
              resolve({ granted: true });
            } else if (hasPermission === false) {
              // User explicitly denied before
              log.info('User denied location permission before');
              globalData.locationPermission = 'denied';
              wx.setStorageSync('locationPermission', 'denied');
              resolve({ granted: false });
            } else {
              // First time requesting permission
              log.info('Requesting location permission authorization...');
              wx.authorize({
                scope: 'scope.userLocation',
                success: () => {
                  log.info('Location permission granted');
                  globalData.locationPermission = 'granted';
                  wx.setStorageSync('locationPermission', 'granted');
                  resolve({ granted: true });
                },
                fail: () => {
                  log.info('Location permission denied');
                  globalData.locationPermission = 'denied';
                  wx.setStorageSync('locationPermission', 'denied');
                  resolve({ granted: false });
                }
              });
            }
          },
          fail: () => {
            log.info('Failed to get permission settings, trying direct request');
            // Try direct authorization
            wx.authorize({
              scope: 'scope.userLocation',
              success: () => {
                log.info('Location permission granted');
                globalData.locationPermission = 'granted';
                wx.setStorageSync('locationPermission', 'granted');
                resolve({ granted: true });
              },
              fail: () => {
                log.info('Location permission denied');
                globalData.locationPermission = 'denied';
                wx.setStorageSync('locationPermission', 'denied');
                resolve({ granted: false });
              }
            });
          }
        });
      });
    }
  };
}

module.exports = { createLocationManager };
