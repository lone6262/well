// app.js - 按照用户专业登录方案实现
// 完全遵循：静默登录、游客模式、按需授权、token续期

App({
  globalData: {
    userInfo: null,
    openid: null,
    token: null,
    cloudInitialized: false,
    cloudDevelopmentAvailable: true, // 新增：云开发是否可用
    isGuest: true, // 游客模式标识
    loginCallbacks: [], // 登录完成回调函数列表
    // 新增：位置权限管理
    locationPermission: 'unknown', // unknown/granted/denied
    latitude: null,
    longitude: null,
    locationUpdateTime: 0,
    // Phase 4: 邀请系统
    pendingInviteCode: null,
    currentInviteCode: null
  },

  // 注册登录完成回调
  onLoginComplete(callback) {
    // 安全检查：确保 callback 是函数
    if (typeof callback !== 'function') {
      console.error('onLoginComplete 需要传入函数作为参数')
      return
    }

    // 确保 loginCallbacks 存在
    if (!this.globalData.loginCallbacks) {
      this.globalData.loginCallbacks = []
    }

    // 需要 openid 和 token 都存在才立即执行回调
    // 避免缓存恢复了 openid 但 token 为 null 时，导致云函数鉴权失败
    if (this.globalData.openid && this.globalData.token) {
      try {
        callback(this.globalData.openid)
      } catch (error) {
        console.error('立即执行登录回调失败:', error)
      }
    } else {
      // 加入队列，等静默登录完成后统一触发
      this.globalData.loginCallbacks.push(callback)
    }
  },

  // 触发登录完成回调
  _notifyLoginComplete(openid) {
    // 安全检查：确保 loginCallbacks 存在且为数组
    if (!this.globalData.loginCallbacks || !Array.isArray(this.globalData.loginCallbacks)) {
      console.warn('loginCallbacks 不存在或不是数组，跳过回调执行')
      return
    }

    // 执行所有回调
    this.globalData.loginCallbacks.forEach(callback => {
      try {
        callback(openid)
      } catch (error) {
        console.error('登录回调执行失败:', error)
      }
    })

    // 清空回调列表
    this.globalData.loginCallbacks = []
  },

  onLaunch: function () {
    console.log('=== 小程序启动 - 开始静默登录 ===');

    // 1. 从本地存储恢复登录状态（同步操作，优先级最高）
    this.restoreLoginState();

    // 2. 重置全局数据（保留 loginCallbacks 和已恢复的登录状态）
    this.globalData.userInfo = this.globalData.userInfo || null;
    this.globalData.token = null;
    this.globalData.cloudInitialized = false;
    if (!this.globalData.loginCallbacks) {
      this.globalData.loginCallbacks = [];
    }

    // 3. 启动链：云开发初始化 → 静默登录 → 首次启动检查
    this._startupSequence();
  },

  /**
   * 启动序列 — 使用Promise链保证正确顺序
   * 替代之前的多个setTimeout竞态方案
   */
  _startupSequence: async function() {
    const self = this;

    try {
      // 步骤1: 初始化云开发
      if (typeof wx !== 'undefined' && wx.cloud) {
        await self._initCloudAsync();
      }

      // 步骤2: 如果云开发可用，执行静默登录；否则进入离线模式
      if (self.globalData.cloudDevelopmentAvailable) {
        await self._silentLoginAsync();
      } else if (!self.globalData.openid) {
        self.enterOfflineMode();
      }

      // 步骤2.5: 云初始化完成后，通知等待中的页面
      if (self.globalData.openid) {
        self._notifyLoginComplete(self.globalData.openid);
      }

      // 步骤3: 首次启动免责声明
      this.checkFirstLaunch();

    } catch (error) {
      console.error('启动序列异常:', error);
      // 最终降级：进入离线模式
      if (!self.globalData.openid) {
        self.enterOfflineMode();
      }
    }
  },

  /**
   * Promise化云开发初始化
   */
  _initCloudAsync: function() {
    const self = this;
    console.log('=== 开始初始化云开发 ===');

    try {
      // wx.cloud.init 是同步方法，不支持 success/fail 回调
      wx.cloud.init({
        env: 'cloud1-d8gdi44zqfec250b5',
        traceUser: true
      });
      console.log('✅ 云开发初始化完成');
      self.globalData.cloudInitialized = true;
      self.globalData.cloudDevelopmentAvailable = true;
    } catch (error) {
      console.log('❌ 云开发初始化异常:', error);
      self.globalData.cloudInitialized = false;
      self.globalData.cloudDevelopmentAvailable = false;
    }

    return Promise.resolve();
  },

  /**
   * Promise化静默登录
   */
  _silentLoginAsync: function() {
    const self = this;
    return new Promise(function(resolve) {
      console.log('=== 开始静默登录 ===');

      wx.login({
        success: function(res) {
          if (res.code) {
            console.log('获取code成功');
            self._callLoginWithCallback(res.code, resolve);
          } else {
            console.error('wx.login失败:', res.errMsg);
            self.enterGuestMode();
            resolve();
          }
        },
        fail: function(err) {
          console.error('wx.login异常:', err);
          self.enterGuestMode();
          resolve();
        }
      });
    });
  },

  /**
   * 调用登录云函数（带完成回调的版本）
   */
  _callLoginWithCallback: function(code, resolveCallback) {
    let self = this;

    if (!this.globalData.cloudDevelopmentAvailable) {
      console.log('⚠️ 云开发不可用，使用模拟登录');
      this.simulatedLogin();
      if (resolveCallback) resolveCallback();
      return;
    }

    wx.cloud.callFunction({
      name: 'silentLogin',
      data: { code: code },
      success: function(res) {
        let result = res.result;

        if (result && result.code === 0) {
          console.log('✅ 静默登录成功');

          self.globalData.token = result.data.token;
          self.globalData.openid = result.data.openid;
          self.globalData.userInfo = result.data.userInfo;
          self.globalData.isGuest = !result.data.userInfo.isMember;

          wx.setStorageSync('token', result.data.token);
          wx.setStorageSync('openid', result.data.openid);
          wx.setStorageSync('userInfo', result.data.userInfo);
          wx.setStorageSync('lastLoginTime', Date.now());

          self._notifyLoginComplete(result.data.openid);
        } else {
          console.error('云函数登录失败');
          self.enterGuestMode();
        }
        if (resolveCallback) resolveCallback();
      },
      fail: function(err) {
        console.error('❌ 调用云函数失败:', err);
        self.globalData.cloudDevelopmentAvailable = false;
        self.simulatedLogin();
        if (resolveCallback) resolveCallback();
      }
    });
  },

  // === 游客模式（云开发不可用时的降级方案）===
  // 注意：降级模式下 isMember 始终为 false，用户需要网络恢复后重新登录才能使用会员功能
  enterOfflineMode: function() {
    console.log('=== 进入离线模式 ===');

    // 不创建 mock openid，保持 openid 为空
    this.globalData.userInfo = {
      nickName: '宠物主人',
      avatarUrl: '',
      isMember: false
    };
    this.globalData.isGuest = true;
    this.globalData.cloudDevelopmentAvailable = false;

    wx.setStorageSync('isGuest', true);
    wx.setStorageSync('cloudDevelopmentAvailable', false);

    wx.showToast({
      title: '网络不可用，部分功能受限',
      icon: 'none',
      duration: 3000
    });

    // 通知等待登录的页面（openid 为空）
    this._notifyLoginComplete('');
  },

  // === 静默登录实现（用户方案核心） ===
  silentLogin: function() {
    let self = this;

    console.log('=== 开始静默登录 ===');

    // 步骤1：wx.login() 获取code
    wx.login({
      success: function(res) {
        if (res.code) {
          console.log('获取code成功:', res.code);

          // 步骤2-4：调用云函数完成后续步骤
          self.callSilentLoginCloudFunction(res.code);
        } else {
          console.error('wx.login失败:', res.errMsg);
          // 登录失败，进入游客模式
          self.enterGuestMode();
        }
      },
      fail: function(err) {
        console.error('wx.login异常:', err);
        // 登录失败，进入游客模式
        self.enterGuestMode();
      }
    });
  },

  // 调用静默登录云函数
  callSilentLoginCloudFunction: function(code) {
    let self = this;

    console.log('=== 准备调用silentLogin云函数 ===');

    // 检查云开发是否可用
    if (!this.globalData.cloudDevelopmentAvailable) {
      console.log('⚠️ 云开发不可用，使用模拟登录');
      this.simulatedLogin();
      return;
    }

    wx.cloud.callFunction({
      name: 'silentLogin',
      data: { code: code },
      success: function(res) {
        console.log('云函数调用成功，响应:', res);
        let result = res.result;

        if (result && result.code === 0) {
          console.log('✅ 静默登录成功');
          console.log('是否新用户:', result.data.isNewUser);
          console.log('游客模式:', !result.data.userInfo.isMember);

          // 保存登录信息
          self.globalData.token = result.data.token;
          self.globalData.openid = result.data.openid;
          self.globalData.userInfo = result.data.userInfo;
          self.globalData.isGuest = !result.data.userInfo.isMember;

          // 步骤4：前端存储token
          wx.setStorageSync('token', result.data.token);
          wx.setStorageSync('openid', result.data.openid);
          wx.setStorageSync('userInfo', result.data.userInfo);
          wx.setStorageSync('lastLoginTime', Date.now());

          // 通知所有等待登录的页面
          self._notifyLoginComplete(result.data.openid);

          console.log('=== 静默登录完成，用户可无感知使用小程序 ===');
        } else {
          console.error('云函数登录失败，返回结果:', result);
          self.enterGuestMode();
        }
      },
      fail: function(err) {
        console.error('❌ 调用云函数失败:', err);
        console.error('错误详情:', err.errMsg);
        console.log('⚠️ 云函数调用失败，进入降级模式，小程序仍可正常使用');

        // 标记云开发不可用
        self.globalData.cloudDevelopmentAvailable = false;

        // 进入降级模式
        self.simulatedLogin();
      }
    });
  },

  // === 模拟登录（已废弃，由 enterOfflineMode 替代）===
  // 保留空函数引用以兼容旧调用点
  simulatedLogin: function() {
    this.enterOfflineMode();
  },

  // === 游客模式实现 ===
  enterGuestMode: function() {
    console.log('=== 进入游客模式 ===');

    this.globalData.isGuest = true;
    this.globalData.userInfo = {
      nickName: '宠物主人',
      avatarUrl: '',
      isMember: false
    };

    // 游客模式也能使用基本功能
    wx.setStorageSync('isGuest', true);
  },

  // === 按需授权实现（用户方案步骤5） ===
  requestUserAuthorization: function(callback) {
    let self = this;

    console.log('=== 请求用户授权资料 ===');

    // 只在用户主动触发时调用（如添加宠物）
    wx.getUserProfile({
      desc: '用于完善您的宠物档案信息',
      success: function(res) {
        console.log('用户授权成功');

        let userInfo = res.userInfo;
        console.log('获取用户资料:', userInfo);

        // 加密数据发后端解密保存（调用专门的云函数）
        self.saveUserProfile(userInfo, callback);
      },
      fail: function(err) {
        console.log('用户拒绝授权:', err);
        // 用户拒绝授权，继续游客模式
        if (callback) {
          callback({ success: false, isGuest: true });
        }
      }
    });
  },

  // 保存用户资料到后端
  saveUserProfile: function(userInfo, callback) {
    let self = this;

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
      success: function(res) {
        console.log('用户资料保存成功');

        // 更新本地用户信息
        let updatedUserInfo = {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl,
          isMember: true
        };

        self.globalData.userInfo = updatedUserInfo;
        self.globalData.isGuest = false;

        wx.setStorageSync('userInfo', updatedUserInfo);
        wx.setStorageSync('isGuest', false);

        if (callback) {
          callback({ success: true, userInfo: updatedUserInfo });
        }
      },
      fail: function(err) {
        console.error('保存用户资料失败:', err);
        if (callback) {
          callback({ success: false, error: err });
        }
      }
    });
  },

  // === Token续期实现 ===
  refreshTokenIfNeeded: function() {
    let self = this;
    let token = wx.getStorageSync('token');

    if (!token) {
      // 没有token，重新静默登录
      this.silentLogin();
      return;
    }

    // 这里应该验证token是否过期
    // 如果过期，自动重新走一遍步骤1-4
    // 简化版：检查本地存储的登录时间
    let lastLoginTime = wx.getStorageSync('lastLoginTime');
    let now = Date.now();
    let sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (now - lastLoginTime > sevenDays) {
      console.log('Token过期，重新登录');
      this.silentLogin();
    }
  },

  // === 检查请求权限 ===
  checkRequestPermission: function() {
    // 每次请求时检测，如果401则自动续期
    this.refreshTokenIfNeeded();
  },

  // === 云开发初始化 ===
  initCloudDevelopment: function() {
    console.log('=== 开始初始化云开发 ===');
    console.log('云环境: cloud1-d8gdi44zqfec250b5');

    try {
      wx.cloud.init({
        env: 'cloud1-d8gdi44zqfec250b5',
        traceUser: true,
        success: function() {
          console.log('✅ 云开发初始化成功');
          this.globalData.cloudInitialized = true;
        }.bind(this),
        fail: function(err) {
          console.log('❌ 云开发初始化失败:', err);
          this.globalData.cloudInitialized = false;

          // 云开发初始化失败时，确保降级模式可以工作
          console.log('⚠️ 进入云开发降级模式，使用模拟数据');

          // 通知其他页面云开发不可用
          this.globalData.cloudDevelopmentAvailable = false;
        }.bind(this)
      });
    } catch (error) {
      console.log('❌ 云开发初始化异常:', error);
      this.globalData.cloudInitialized = false;
      this.globalData.cloudDevelopmentAvailable = false;

      // 异常时也要确保降级模式
      console.log('⚠️ 云开发异常，确保降级模式可用');
    }
  },

  // === 免责声明 ===
  checkFirstLaunch: function() {
    let hasLaunched = wx.getStorageSync('hasLaunched');
    if (!hasLaunched) {
      wx.showModal({
        title: '重要提示',
        content: '本工具仅为宠物健康风险评估参考，不能替代执业兽医的专业诊断与治疗。使用本工具即表示您已了解并同意此免责声明。',
        showCancel: false,
        confirmText: '我已了解',
        success: function() {
          wx.setStorageSync('hasLaunched', true);
        }
      });
    }
  },

  // === 恢复登录状态 ===
  restoreLoginState: function() {
    console.log('=== 从本地存储恢复登录状态 ===');

    try {
      // 恢复openid
      let storedOpenid = wx.getStorageSync('openid');
      if (storedOpenid) {
        this.globalData.openid = storedOpenid;
        console.log('✅ 登录状态已恢复');
      }

      // 恢复token
      let storedToken = wx.getStorageSync('token');
      if (storedToken) {
        this.globalData.token = storedToken;
        console.log('✅ 恢复token');
      }

      // 恢复用户信息
      let storedUserInfo = wx.getStorageSync('userInfo');
      if (storedUserInfo) {
        this.globalData.userInfo = storedUserInfo;
        console.log('✅ 恢复用户信息');
      }

      // 恢复游客模式状态
      let isGuest = wx.getStorageSync('isGuest');
      if (typeof isGuest === 'boolean') {
        this.globalData.isGuest = isGuest;
        console.log('✅ 恢复游客模式状态:', isGuest);
      }

      // 如果有任何登录信息恢复成功，通知等待登录的页面
      if (this.globalData.openid) {
        console.log('✅ 登录状态恢复完成');
        // 注意：不在这里通知回调，等 _startupSequence 中云初始化完成后再通知
        // 避免在云开发未初始化时触发云函数调用
      }

      // 恢复位置权限状态
      const storedLocationPermission = wx.getStorageSync('locationPermission');
      if (storedLocationPermission) {
        this.globalData.locationPermission = storedLocationPermission;
        console.log('✅ 恢复位置权限状态:', storedLocationPermission);
      }

      // 恢复位置缓存
      const cachedLatitude = wx.getStorageSync('cachedLatitude');
      const cachedLongitude = wx.getStorageSync('cachedLongitude');
      const cachedLocationTime = wx.getStorageSync('cachedLocationTime');

      if (cachedLatitude && cachedLongitude && cachedLocationTime) {
        const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
        const currentTime = Date.now();

        if ((currentTime - cachedLocationTime) < LOCATION_CACHE_DURATION) {
          this.globalData.latitude = cachedLatitude;
          this.globalData.longitude = cachedLongitude;
          this.globalData.locationUpdateTime = cachedLocationTime;
          console.log('✅ 恢复位置缓存信息');
        }
      }
    } catch (error) {
      console.error('❌ 恢复登录状态失败:', error);
    }
  },

  // === 统一的登录状态检查方法 ===
  isLoggedIn: function() {
    return !!this.globalData.openid;
  },

  // === 统一的获取openid方法 ===
  getOpenid: function() {
    // 如果内存中有，直接返回
    if (this.globalData.openid) {
      return this.globalData.openid;
    }

    // 尝试从本地存储获取
    let storedOpenid = wx.getStorageSync('openid');
    if (storedOpenid) {
      this.globalData.openid = storedOpenid;
      return storedOpenid;
    }

    // 没有 openid，返回 null（不再使用 mock openid）
    return null;
  },

  // === 统一的位置权限管理 ===
  // 检查位置权限状态
  checkLocationPermission: function() {
    return this.globalData.locationPermission;
  },

  // 请求位置权限（统一入口，只请求一次）
  // 不使用 wx.authorize（新版基础库会挂起），改为 wx.getSetting 检查 + 标记状态
  requestLocationPermission: function() {
    const self = this;

    return new Promise(function(resolve) {
      // 如果已经授权过，直接返回
      if (self.globalData.locationPermission === 'granted') {
        console.log('位置权限已授予，跳过请求');
        resolve({ granted: true });
        return;
      }

      // 如果已经拒绝过，不重复请求
      if (self.globalData.locationPermission === 'denied') {
        console.log('位置权限已拒绝，不重复请求');
        resolve({ granted: false });
        return;
      }

      console.log('首次请求位置权限，通过 wx.getSetting 检查...');

      // 超时保护：4秒内必须出结果，否则视为未授权
      var permissionTimeout = setTimeout(function() {
        console.log('权限检查超时，标记为 unknown 允许尝试 getLocation');
        resolve({ granted: true, firstTime: true });
      }, 4000);

      wx.getSetting({
        success: function(settingRes) {
          clearTimeout(permissionTimeout);
          var hasPermission = settingRes.authSetting['scope.userLocation'];

          if (hasPermission) {
            // 已有权限
            console.log('用户已授权位置权限');
            self.globalData.locationPermission = 'granted';
            wx.setStorageSync('locationPermission', 'granted');
            resolve({ granted: true });
          } else if (hasPermission === false) {
            // 用户明确拒绝过，引导去设置页
            console.log('用户拒绝过位置权限');
            self.globalData.locationPermission = 'denied';
            wx.setStorageSync('locationPermission', 'denied');
            resolve({ granted: false });
          } else {
            // 未请求过权限，标记为首次，由 wx.getLocation 触发系统弹窗
            console.log('首次请求位置权限，将交由 wx.getLocation 触发授权弹窗');
            resolve({ granted: true, firstTime: true });
          }
        },
        fail: function() {
          clearTimeout(permissionTimeout);
          console.log('获取权限设置失败，允许尝试 wx.getLocation');
          resolve({ granted: true, firstTime: true });
        }
      });
    });
  },

  // 获取用户位置（带缓存）
  // 首次请求时直接通过 wx.getLocation 触发系统授权弹窗（不依赖 wx.authorize）
  getUserLocation: function(forceRefresh) {
    const self = this;
    const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
    const currentTime = Date.now();

    if (forceRefresh === undefined) forceRefresh = false;

    return new Promise(function(resolve) {
      // 如果有缓存位置且未过期，直接返回
      if (!forceRefresh &&
          self.globalData.latitude &&
          self.globalData.longitude &&
          self.globalData.locationUpdateTime &&
          (currentTime - self.globalData.locationUpdateTime) < LOCATION_CACHE_DURATION) {

        console.log('使用缓存位置信息');
        resolve({
          latitude: self.globalData.latitude,
          longitude: self.globalData.longitude
        });
        return;
      }

      // 先检查权限状态（不调用 wx.authorize）
      self.requestLocationPermission().then(function(permissionResult) {
        if (!permissionResult.granted) {
          // 明确被拒绝过，使用默认位置
          var defaultLocation = self._resolveDefaultLocation(currentTime);
          console.log('无位置权限，使用默认位置:', defaultLocation);
          resolve(defaultLocation);
          return;
        }

        // 有权限或首次请求 → 直接调用 wx.getLocation
        // 首次请求时 wx.getLocation 会自动弹出系统授权窗口
        console.log('调用 wx.getLocation 获取位置...' + (permissionResult.firstTime ? '（首次，将弹出授权）' : ''));

        var locationTimeout = setTimeout(function() {
          console.log('wx.getLocation 超时，使用默认位置');
          resolve(self._resolveDefaultLocation(currentTime));
        }, 5000);

        wx.getLocation({
          type: 'gcj02',
          success: function(res) {
            clearTimeout(locationTimeout);
            self._saveLocation(res.latitude, res.longitude, currentTime);

            // 首次授权成功，更新权限状态
            if (permissionResult.firstTime) {
              self.globalData.locationPermission = 'granted';
              wx.setStorageSync('locationPermission', 'granted');
              console.log('首次位置授权成功');
            }

            console.log('位置获取成功:', {
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
            clearTimeout(locationTimeout);
            console.log('位置获取失败:', error);

            // 首次请求失败说明用户拒绝了授权
            if (permissionResult.firstTime) {
              self.globalData.locationPermission = 'denied';
              wx.setStorageSync('locationPermission', 'denied');
              console.log('用户拒绝了位置授权');
            }

            resolve(self._resolveDefaultLocation(currentTime));
          }
        });
      });
    });
  },

  // 保存位置信息到全局数据和本地存储
  _saveLocation: function(latitude, longitude, timestamp) {
    this.globalData.latitude = latitude;
    this.globalData.longitude = longitude;
    this.globalData.locationUpdateTime = timestamp;

    wx.setStorageSync('cachedLatitude', latitude);
    wx.setStorageSync('cachedLongitude', longitude);
    wx.setStorageSync('cachedLocationTime', timestamp);
  },

  // 获取默认位置（深圳市民中心）并缓存
  _resolveDefaultLocation: function(timestamp) {
    var defaultLocation = {
      latitude: 22.543099,
      longitude: 114.057868
    };

    this._saveLocation(defaultLocation.latitude, defaultLocation.longitude, timestamp);
    return defaultLocation;
  }
})
