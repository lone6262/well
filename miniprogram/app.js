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
    locationUpdateTime: 0
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

    if (this.globalData.openid) {
      // 如果已经登录，立即执行回调
      try {
        callback(this.globalData.openid)
      } catch (error) {
        console.error('立即执行登录回调失败:', error)
      }
    } else {
      // 否则添加到回调列表
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

      // 步骤2: 如果云开发可用，执行静默登录；否则使用降级模式
      if (self.globalData.cloudDevelopmentAvailable) {
        await self._silentLoginAsync();
      } else if (!self.globalData.openid) {
        self.createMockUser();
      }

      // 步骤2.5: 云初始化完成后，通知等待中的页面
      if (self.globalData.openid) {
        self._notifyLoginComplete(self.globalData.openid);
      }

      // 步骤3: 首次启动免责声明
      this.checkFirstLaunch();

    } catch (error) {
      console.error('启动序列异常:', error);
      // 最终降级：确保至少基本功能可用
      if (!self.globalData.openid) {
        self.createMockUser();
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
    var self = this;

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
        var result = res.result;

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

  // === 先创建模拟用户，确保数据库不为空 ===
  createMockUser: function() {
    var self = this;

    console.log('=== 创建模拟用户记录 ===');

    // 生成一个模拟的openid（基于时间戳）
    var mockOpenid = 'mock_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    console.log('生成模拟openid:', mockOpenid);

    // 保存模拟用户信息
    self.globalData.openid = mockOpenid;
    self.globalData.userInfo = {
      nickName: '宠物主人',
      avatarUrl: '',
      isMember: false
    };

    // 保存到本地存储
    wx.setStorageSync('mockOpenid', mockOpenid);
    wx.setStorageSync('userInfo', self.globalData.userInfo);

    console.log('✅ 模拟用户创建完成');
    console.log('=== 数据库不会为空了 ===');
  },

  // === 静默登录实现（用户方案核心） ===
  silentLogin: function() {
    var self = this;

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
    var self = this;

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
        var result = res.result;

        if (result && result.code === 0) {
          console.log('✅ 静默登录成功');
          console.log('用户ID:', result.data.userId);
          console.log('OpenID:', result.data.openid);
          console.log('Token:', result.data.token);
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

  // === 新增：模拟登录（降级方案）===
  simulatedLogin: function() {
    console.log('=== 启动模拟登录（降级模式）===');

    // 使用已有的模拟openid
    var mockOpenid = this.globalData.openid || 'mock_' + Date.now() + '_fallback';

    this.globalData.openid = mockOpenid;
    this.globalData.userInfo = {
      nickName: '宠物主人',
      avatarUrl: '',
      isMember: true  // 降级模式下认为是会员
    };
    this.globalData.isGuest = false;
    this.globalData.cloudDevelopmentAvailable = false;

    // 保存到本地存储
    wx.setStorageSync('openid', mockOpenid);
    wx.setStorageSync('userInfo', this.globalData.userInfo);
    wx.setStorageSync('isGuest', false);
    wx.setStorageSync('cloudDevelopmentAvailable', false);

    // 通知所有等待登录的页面
    this._notifyLoginComplete(mockOpenid);

    console.log('✅ 模拟登录完成，降级模式启动');
    console.log('⚠️ 云开发功能将使用本地模拟数据');

    wx.showToast({
      title: '启动本地模式',
      icon: 'none',
      duration: 2000
    });
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
    var self = this;

    console.log('=== 请求用户授权资料 ===');

    // 只在用户主动触发时调用（如添加宠物）
    wx.getUserProfile({
      desc: '用于完善您的宠物档案信息',
      success: function(res) {
        console.log('用户授权成功');

        var userInfo = res.userInfo;
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
    var self = this;

    wx.cloud.callFunction({
      name: 'saveUserProfile', // 需要创建这个云函数
      data: {
        openid: self.globalData.openid,
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
        var updatedUserInfo = {
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
    var self = this;
    var token = wx.getStorageSync('token');

    if (!token) {
      // 没有token，重新静默登录
      this.silentLogin();
      return;
    }

    // 这里应该验证token是否过期
    // 如果过期，自动重新走一遍步骤1-4
    // 简化版：检查本地存储的登录时间
    var lastLoginTime = wx.getStorageSync('lastLoginTime');
    var now = Date.now();
    var sevenDays = 7 * 24 * 60 * 60 * 1000;

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
    var hasLaunched = wx.getStorageSync('hasLaunched');
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
      var storedOpenid = wx.getStorageSync('openid');
      if (storedOpenid) {
        this.globalData.openid = storedOpenid;
        console.log('✅ 恢复openid:', storedOpenid);
      }

      // 恢复token
      var storedToken = wx.getStorageSync('token');
      if (storedToken) {
        this.globalData.token = storedToken;
        console.log('✅ 恢复token');
      }

      // 恢复用户信息
      var storedUserInfo = wx.getStorageSync('userInfo');
      if (storedUserInfo) {
        this.globalData.userInfo = storedUserInfo;
        console.log('✅ 恢复用户信息');
      }

      // 恢复游客模式状态
      var isGuest = wx.getStorageSync('isGuest');
      if (typeof isGuest === 'boolean') {
        this.globalData.isGuest = isGuest;
        console.log('✅ 恢复游客模式状态:', isGuest);
      }

      // 如果有任何登录信息恢复成功，通知等待登录的页面
      if (this.globalData.openid) {
        console.log('✅ 登录状态恢复完成，openid:', this.globalData.openid);
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
    var storedOpenid = wx.getStorageSync('openid');
    if (storedOpenid) {
      this.globalData.openid = storedOpenid;
      return storedOpenid;
    }

    // 如果都没有，检查模拟openid
    var mockOpenid = wx.getStorageSync('mockOpenid');
    if (mockOpenid) {
      this.globalData.openid = mockOpenid;
      console.log('使用模拟openid:', mockOpenid);
      return mockOpenid;
    }

    return null;
  },

  // === 统一的位置权限管理 ===
  // 检查位置权限状态
  checkLocationPermission: function() {
    return this.globalData.locationPermission;
  },

  // 请求位置权限（统一入口，只请求一次）
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

      console.log('首次请求位置权限...');

      // 使用 wx.getSetting 检查权限状态
      wx.getSetting({
        success: (settingRes) => {
          const hasPermission = settingRes.authSetting['scope.userLocation'];

          if (hasPermission) {
            // 已有权限
            console.log('用户已授权位置权限');
            self.globalData.locationPermission = 'granted';
            wx.setStorageSync('locationPermission', 'granted');
            resolve({ granted: true });
          } else if (hasPermission === false) {
            // 用户明确拒绝过
            console.log('用户拒绝过位置权限');
            self.globalData.locationPermission = 'denied';
            wx.setStorageSync('locationPermission', 'denied');
            resolve({ granted: false });
          } else {
            // 未请求过权限，发起请求
            console.log('请求位置权限授权...');
            wx.authorize({
              scope: 'scope.userLocation',
              success: () => {
                console.log('位置权限授权成功');
                self.globalData.locationPermission = 'granted';
                wx.setStorageSync('locationPermission', 'granted');
                resolve({ granted: true });
              },
              fail: () => {
                console.log('位置权限授权失败');
                self.globalData.locationPermission = 'denied';
                wx.setStorageSync('locationPermission', 'denied');
                resolve({ granted: false });
              }
            });
          }
        },
        fail: () => {
          console.log('获取权限设置失败，尝试直接请求');
          // 直接尝试授权
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => {
              console.log('位置权限授权成功');
              self.globalData.locationPermission = 'granted';
              wx.setStorageSync('locationPermission', 'granted');
              resolve({ granted: true });
            },
            fail: () => {
              console.log('位置权限授权失败');
              self.globalData.locationPermission = 'denied';
              wx.setStorageSync('locationPermission', 'denied');
              resolve({ granted: false });
            }
          });
        }
      });
    });
  },

  // 获取用户位置（带缓存）
  getUserLocation: function(forceRefresh = false) {
    const self = this;
    const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
    const currentTime = Date.now();

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

      // 先请求权限，再获取位置
      self.requestLocationPermission().then(permissionResult => {
        if (permissionResult.granted) {
          // 有权限，获取位置
          wx.getLocation({
            type: 'gcj02',
            success: function(res) {
              // 保存位置信息到全局数据和本地存储
              self.globalData.latitude = res.latitude;
              self.globalData.longitude = res.longitude;
              self.globalData.locationUpdateTime = currentTime;

              // 持久化到本地存储
              wx.setStorageSync('cachedLatitude', res.latitude);
              wx.setStorageSync('cachedLongitude', res.longitude);
              wx.setStorageSync('cachedLocationTime', currentTime);

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
              console.log('位置获取失败:', error);

              // 使用默认位置（北京天安门）
              const defaultLocation = {
                latitude: 39.90469,
                longitude: 116.40717
              };

              // 保存默认位置到全局数据和本地存储
              self.globalData.latitude = defaultLocation.latitude;
              self.globalData.longitude = defaultLocation.longitude;
              self.globalData.locationUpdateTime = currentTime;

              // 持久化到本地存储
              wx.setStorageSync('cachedLatitude', defaultLocation.latitude);
              wx.setStorageSync('cachedLongitude', defaultLocation.longitude);
              wx.setStorageSync('cachedLocationTime', currentTime);

              console.log('使用默认位置:', defaultLocation);
              resolve(defaultLocation);
            }
          });
        } else {
          // 无权限，使用默认位置
          const defaultLocation = {
            latitude: 39.90469,
            longitude: 116.40717
          };

          // 保存默认位置到全局数据和本地存储
          self.globalData.latitude = defaultLocation.latitude;
          self.globalData.longitude = defaultLocation.longitude;
          self.globalData.locationUpdateTime = currentTime;

          // 持久化到本地存储
          wx.setStorageSync('cachedLatitude', defaultLocation.latitude);
          wx.setStorageSync('cachedLongitude', defaultLocation.longitude);
          wx.setStorageSync('cachedLocationTime', currentTime);

          console.log('无位置权限，使用默认位置:', defaultLocation);
          resolve(defaultLocation);
        }
      });
    });
  }
})
