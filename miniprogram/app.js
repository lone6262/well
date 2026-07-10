// app.js - 按照用户专业登录方案实现
// 完全遵循：静默登录、游客模式、按需授权、token续期

const { TOAST_DURATION, CACHE_DURATION } = require('./utils/constants.js')
const logger = require('./utils/logger.js')
const log = logger.child('App')

// 生产环境静默大部分日志，仅保留 warn 和 error
// 正式版环境为 'release'，开发版为 'develop'，体验版为 'trial'
try {
  var accountInfo = wx.getAccountInfoSync()
  var envVersion = accountInfo.miniProgram.envVersion
  if (envVersion === 'release') {
    logger.setLevel('warn')
  } else {
    logger.setLevel('debug')
  }
} catch (e) {
  logger.setLevel('debug')
}

App({
  globalData: {
    userInfo: null,
    openid: null,
    token: null,
    cloudInitialized: false,
    cloudDevelopmentAvailable: true, // 新增：云开发是否可用
    isGuest: true, // 游客模式标识
    loginCallbacks: [], // 登录完成回调函数列表
    MAX_LOGIN_CALLBACKS: 50, // 回调队列最大数量，防止内存泄漏
    // 新增：位置权限管理
    locationPermission: 'unknown', // unknown/granted/denied
    latitude: null,
    longitude: null,
    locationUpdateTime: 0,
    // Phase 4: 邀请系统
    pendingInviteCode: null,
    currentInviteCode: null,
    // Phase 1.5: Feature Flags（从 system_config 加载，失败用默认值）
    // 命名与开发计划 V5 对齐：enable_tools / enable_food_search / enable_share_card / enable_group / enable_promotion
    featureFlags: {
      enable_tools: true,
      enable_food_search: true,
      enable_share_card: false,
      enable_group: false,
      enable_promotion: false
    },
    // Phase 1.5: 用户来源标记（默认 direct=直接打开无参数；search/gzh/share/xhs 由 scene 与 query 识别）
    userSource: 'direct'
  },

  // 注册登录完成回调
  onLoginComplete(callback) {
    // 安全检查：确保 callback 是函数
    if (typeof callback !== 'function') {
      log.error('onLoginComplete 需要传入函数作为参数')
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
        log.error('立即执行登录回调失败:', error)
      }
    } else {
      // 加入队列，等静默登录完成后统一触发
      // 防止回调队列无限增长导致内存泄漏
      if (this.globalData.loginCallbacks.length >= this.globalData.MAX_LOGIN_CALLBACKS) {
        log.warn('登录回调队列已满，丢弃最早的回调')
        this.globalData.loginCallbacks.shift()
      }
      this.globalData.loginCallbacks.push(callback)
    }
  },

  // 触发登录完成回调
  _notifyLoginComplete(openid) {
    // 安全检查：确保 loginCallbacks 存在且为数组
    if (!this.globalData.loginCallbacks || !Array.isArray(this.globalData.loginCallbacks)) {
      log.warn('loginCallbacks 不存在或不是数组，跳过回调执行')
      return
    }

    // 执行所有回调
    this.globalData.loginCallbacks.forEach(callback => {
      try {
        callback(openid)
      } catch (error) {
        log.error('登录回调执行失败:', error)
      }
    })

    // 清空回调列表
    this.globalData.loginCallbacks = []
  },

  onLaunch: function () {
    log.info('小程序启动 - 开始静默登录')

    // Phase 1.5: 解析启动参数获取用户来源
    this._captureUserSource();

    // 1. 从本地存储恢复登录状态（同步操作，优先级最高）
    this.restoreLoginState();

    // 2. 重置全局数据（保留 loginCallbacks 和已恢复的登录状态）
    this.globalData.userInfo = this.globalData.userInfo || null;
    // 修复：保留从缓存恢复的 token，不要强制清空
    // 静默登录是异步的，在等待期间页面仍需使用缓存的 token
    if (!this.globalData.token) {
      this.globalData.token = null;
    }
    this.globalData.cloudInitialized = false;
    if (!this.globalData.loginCallbacks) {
      this.globalData.loginCallbacks = [];
    }

    // 3. 启动链：云开发初始化 → 静默登录 → 首次启动检查
    this._startupSequence();
  },

  // Phase 1.5: 错误日志 — 未捕获异常自动上报
  onError: function(msg) {
    log.error('onError:', msg);
    this._reportError('onError', msg, '');
  },

  // Phase 1.5: 错误日志 — 未处理的 Promise 拒绝
  onUnhandledRejection: function(res) {
    log.error('onUnhandledRejection:', res);
    var msg = (res && res.reason) ? String(res.reason) : 'Unknown rejection';
    var stack = (res && res.reason && res.reason.stack) ? res.reason.stack : '';
    this._reportError('onUnhandledRejection', msg, stack);
  },

  /**
   * Phase 1.5: 静默上报错误到 error_logs（经 trackEvent 路由）
   */
  _reportError: function(type, message, stack) {
    // 获取当前页面路径
    var pages = getCurrentPages();
    var currentPage = pages.length > 0 ? pages[pages.length - 1].route : 'unknown';

    // 采集设备信息（getSystemInfoSync 同步且安全，try/catch 兜底）
    var sys = {};
    try {
      var s = wx.getSystemInfoSync();
      sys = {
        brand: s.brand || '',
        model: s.model || '',
        system: s.system || '',
        platform: s.platform || ''
      };
    } catch (e) {
      sys = {};
    }

    // 脱敏：移除手机号 / openid / token 等敏感信息，避免错误上报泄露 PII
    const sanitizeErr = function(s) {
      return String(s)
        .replace(/1[3-9]\d{9}/g, '1**********')
        .replace(/(openid|token|phoneNumber)\s*[:=]?\s*[\w._-]+/gi, '$1=***')
        .substring(0, 500);
    };

    var properties = {
      function: 'miniprogram',
      operation: type,
      error_message: sanitizeErr(message),
      error_type: type,
      stack: stack ? sanitizeErr(stack) : '',
      page: currentPage,
      brand: sys.brand,
      model: sys.model,
      system: sys.system,
      platform: sys.platform,
      client_timestamp: new Date().toISOString()
    };

    // 静默上报，失败也忽略
    if (this.globalData.cloudDevelopmentAvailable) {
      wx.cloud.callFunction({
        name: 'trackEvent',
        data: { eventName: 'app_error', properties: properties },
        fail: function() { /* 静默忽略 */ }
      });
    }
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

      // 步骤3: 首次启动免责声明
      this.checkFirstLaunch();

      // 步骤4: 超时保护 — 30秒后清空回调队列，防止内存泄漏
      setTimeout(function() {
        if (self.globalData.loginCallbacks && self.globalData.loginCallbacks.length > 0) {
          log.warn('登录回调队列超时，清空未执行的回调:', self.globalData.loginCallbacks.length)
          self.globalData.loginCallbacks = []
        }
      }, 30000)

    // 步骤5: Phase 1.5 — 加载 Feature Flags（不阻塞启动）
    self._loadFeatureFlags();

    } catch (error) {
      log.error('启动序列异常:', error);
      // 最终降级：进入离线模式
      if (!self.globalData.openid) {
        self.enterOfflineMode();
      }
    }
  },

  /**
   * Phase 1.5: 解析启动参数，获取用户来源
   */
  _captureUserSource: function() {
    try {
      var options = wx.getLaunchOptionsSync();
      var scene = options.scene;
      var query = options.query || {};

      if (query.source) {
        // 统一小写，兼容 source=XHS / source=Xhs 等大小写差异（小红书引流等带参场景）
        this.globalData.userSource = String(query.source).toLowerCase();
      } else if (query.invite_code) {
        this.globalData.userSource = 'invite';
      } else if (scene === 1001 || scene === 1011) {
        this.globalData.userSource = 'search';
      } else if (scene === 1007 || scene === 1008 || scene === 1014 || scene === 1044) {
        this.globalData.userSource = 'share';
      } else if (scene === 1058 || scene === 1035) {
        this.globalData.userSource = 'gzh';
      } else {
        // 无参数直接打开（非搜索/分享/公众号入口），区别于真正的微信搜索
        this.globalData.userSource = 'direct';
      }

      log.info('用户来源:', this.globalData.userSource, 'scene:', scene);
    } catch (e) {
      log.warn('获取启动参数失败:', e);
    }
  },

  /**
   * Phase 1.5: 直接从数据库读取 feature_flags
   */
  _loadFeatureFlags: function() {
    var self = this;
    if (!this.globalData.cloudDevelopmentAvailable) return;

    try {
      var db = wx.cloud.database();
      db.collection('system_config').where({ key: 'feature_flags' }).limit(1).get({
        success: function(res) {
          if (res.data && res.data.length > 0) {
            var raw = res.data[0].value;
            var flags = (typeof raw === 'string') ? JSON.parse(raw) : (raw || {});
            self.globalData.featureFlags = Object.assign({}, self.globalData.featureFlags, flags);
            log.info('Feature Flags 加载成功:', self.globalData.featureFlags);
          }
        },
        fail: function(err) {
          log.warn('Feature Flags 加载失败，使用默认值:', err);
        }
      });
    } catch (e) {
      log.warn('Feature Flags 加载异常:', e);
    }
  },

  /**
   * Phase 1.5: 获取 Feature Flag 值
   */
  getFeatureFlag: function(key) {
    return !!this.globalData.featureFlags[key];
  },

  /**
   * Promise化云开发初始化
   */
  _initCloudAsync: function() {
    const self = this;
    log.info('开始初始化云开发')

    try {
      // wx.cloud.init 是同步方法，不支持 success/fail 回调
      wx.cloud.init({
        env: 'cloud1-d8gdi44zqfec250b5',
        traceUser: true
      });
      log.info('云开发初始化完成')
      self.globalData.cloudInitialized = true;
      self.globalData.cloudDevelopmentAvailable = true;
    } catch (error) {
      log.error('云开发初始化异常:', error);
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
      log.info('开始静默登录')

      wx.login({
        success: function(res) {
          if (res.code) {
            log.info('获取code成功')
            self._callLoginWithCallback(res.code, resolve);
          } else {
            log.error('wx.login失败:', res.errMsg);
            self.enterGuestMode();
            resolve();
          }
        },
        fail: function(err) {
          log.error('wx.login异常:', err);
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
      log.warn('云开发不可用，使用模拟登录')
      this.simulatedLogin();
      if (resolveCallback) resolveCallback();
      return;
    }

    wx.cloud.callFunction({
      name: 'silentLogin',
      data: { code: code, source: self.globalData.userSource },
      success: function(res) {
        let result = res.result;

        if (result && result.code === 0) {
          log.info('静默登录成功')

          // 调试：打印从服务器返回的完整用户信息
          log.info('静默登录 - 服务器返回的用户信息:', result.data.userInfo)

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
          log.error('云函数登录失败')
          self.enterGuestMode();
        }
        if (resolveCallback) resolveCallback();
      },
      fail: function(err) {
        log.error('调用云函数失败:', err);
        self.globalData.cloudDevelopmentAvailable = false;
        self.simulatedLogin();
        if (resolveCallback) resolveCallback();
      }
    });
  },

  // === 游客模式（云开发不可用时的降级方案）===
  // 注意：降级模式下 isMember 始终为 false，用户需要网络恢复后重新登录才能使用会员功能
  enterOfflineMode: function() {
    log.info('进入离线模式')

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
      duration: TOAST_DURATION.LONG
    });

    // 通知等待登录的页面（openid 为空）
    this._notifyLoginComplete('');
  },

  // === 静默登录（委托给 _silentLoginAsync）===
  // 保留为公共 API 供外部页面调用（如 pet/profile.js）
  silentLogin: function() {
    var self = this;
    this._silentLoginAsync().then(function() {
      log.info('silentLogin 委托完成');
    });
  },

  // === 模拟登录（已废弃，由 enterOfflineMode 替代）===
  // 保留空函数引用以兼容旧调用点
  simulatedLogin: function() {
    this.enterOfflineMode();
  },

  // === 游客模式实现 ===
  enterGuestMode: function() {
    log.info('进入游客模式')

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

    log.info('请求用户授权资料')

    // 只在用户主动触发时调用（如添加宠物）
    wx.getUserProfile({
      desc: '用于完善您的宠物档案信息',
      success: function(res) {
        log.info('用户授权成功')

        let userInfo = res.userInfo;
        log.info('获取用户资料:', userInfo)

        // 加密数据发后端解密保存（调用专门的云函数）
        self.saveUserProfile(userInfo, callback);
      },
      fail: function(err) {
        log.warn('用户拒绝授权:', err)
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
        log.info('用户资料保存成功')

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
        log.error('保存用户资料失败:', err)
        if (callback) {
          callback({ success: false, error: err });
        }
      }
    });
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
    log.info('从本地存储恢复登录状态')

    try {
      // 恢复openid
      let storedOpenid = wx.getStorageSync('openid');
      if (storedOpenid) {
        this.globalData.openid = storedOpenid;
        log.info('登录状态已恢复')
      }

      // 恢复token
      let storedToken = wx.getStorageSync('token');
      if (storedToken) {
        this.globalData.token = storedToken;
        log.info('恢复token')
      }

      // 恢复用户信息
      let storedUserInfo = wx.getStorageSync('userInfo');
      if (storedUserInfo) {
        this.globalData.userInfo = storedUserInfo;
        log.info('恢复用户信息')
      }

      // 恢复游客模式状态
      let isGuest = wx.getStorageSync('isGuest');
      if (typeof isGuest === 'boolean') {
        this.globalData.isGuest = isGuest;
        log.info('恢复游客模式状态:', isGuest)
      }

      // 如果有任何登录信息恢复成功，通知等待登录的页面
      if (this.globalData.openid) {
        log.info('登录状态恢复完成')
        // 注意：不在这里通知回调，等 _startupSequence 中云初始化完成后再通知
        // 避免在云开发未初始化时触发云函数调用
      }

      // 恢复位置权限状态
      const storedLocationPermission = wx.getStorageSync('locationPermission');
      if (storedLocationPermission) {
        this.globalData.locationPermission = storedLocationPermission;
        log.info('恢复位置权限状态:', storedLocationPermission)
      }

      // 恢复位置缓存
      const cachedLatitude = wx.getStorageSync('cachedLatitude');
      const cachedLongitude = wx.getStorageSync('cachedLongitude');
      const cachedLocationTime = wx.getStorageSync('cachedLocationTime');

      if (cachedLatitude && cachedLongitude && cachedLocationTime) {
        const LOCATION_CACHE_DURATION = CACHE_DURATION.LOCATION;
        const currentTime = Date.now();

        if ((currentTime - cachedLocationTime) < LOCATION_CACHE_DURATION) {
          this.globalData.latitude = cachedLatitude;
          this.globalData.longitude = cachedLongitude;
          this.globalData.locationUpdateTime = cachedLocationTime;
          log.info('恢复位置缓存信息')
        }
      }
    } catch (error) {
      log.error('恢复登录状态失败:', error)
    }
  },

  // === 统一的登录状态检查方法 ===
  // 需要同时检查 openid 和 token，避免有 openid 但 token 无效的情况
  isLoggedIn: function() {
    return !!(this.globalData.openid && this.globalData.token);
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
        log.info('位置权限已授予，跳过请求')
        resolve({ granted: true });
        return;
      }

      // 如果已经拒绝过，不重复请求
      if (self.globalData.locationPermission === 'denied') {
        log.info('位置权限已拒绝，不重复请求')
        resolve({ granted: false });
        return;
      }

      log.info('首次请求位置权限，通过 wx.getSetting 检查...')

      // 超时保护：4秒内必须出结果，否则视为未授权
      var permissionTimeout = setTimeout(function() {
        log.warn('权限检查超时，标记为 unknown 允许尝试 getLocation')
        resolve({ granted: true, firstTime: true });
      }, 4000);

      wx.getSetting({
        success: function(settingRes) {
          clearTimeout(permissionTimeout);
          var hasPermission = settingRes.authSetting['scope.userLocation'];

          if (hasPermission) {
            // 已有权限
            log.info('用户已授权位置权限')
            self.globalData.locationPermission = 'granted';
            wx.setStorageSync('locationPermission', 'granted');
            resolve({ granted: true });
          } else if (hasPermission === false) {
            // 用户明确拒绝过，引导去设置页
            log.info('用户拒绝过位置权限')
            self.globalData.locationPermission = 'denied';
            wx.setStorageSync('locationPermission', 'denied');
            resolve({ granted: false });
          } else {
            // 未请求过权限，标记为首次，由 wx.getLocation 触发系统弹窗
            log.info('首次请求位置权限，将交由 wx.getLocation 触发授权弹窗')
            resolve({ granted: true, firstTime: true });
          }
        },
        fail: function() {
          clearTimeout(permissionTimeout);
          log.warn('获取权限设置失败，允许尝试 wx.getLocation')
          resolve({ granted: true, firstTime: true });
        }
      });
    });
  },

  // 获取用户位置（带缓存）
  // 首次请求时直接通过 wx.getLocation 触发系统授权弹窗（不依赖 wx.authorize）
  getUserLocation: function(forceRefresh) {
    const self = this;
    const LOCATION_CACHE_DURATION = CACHE_DURATION.LOCATION;
    const currentTime = Date.now();

    if (forceRefresh === undefined) forceRefresh = false;

    return new Promise(function(resolve) {
      // 如果有缓存位置且未过期，直接返回
      if (!forceRefresh &&
          self.globalData.latitude &&
          self.globalData.longitude &&
          self.globalData.locationUpdateTime &&
          (currentTime - self.globalData.locationUpdateTime) < LOCATION_CACHE_DURATION) {

        log.info('使用缓存位置信息')
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
          log.info('无位置权限，使用默认位置:', defaultLocation)
          resolve(defaultLocation);
          return;
        }

        // 有权限或首次请求 → 直接调用 wx.getLocation
        // 首次请求时 wx.getLocation 会自动弹出系统授权窗口
        log.info('调用 wx.getLocation 获取位置...' + (permissionResult.firstTime ? '（首次，将弹出授权）' : ''))

        var locationTimeout = setTimeout(function() {
          log.warn('wx.getLocation 超时，使用默认位置')
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
              log.info('首次位置授权成功')
            }

            log.info('位置获取成功:', {
              latitude: res.latitude,
              longitude: res.longitude,
              accuracy: res.accuracy
            })

            resolve({
              latitude: res.latitude,
              longitude: res.longitude
            });
          },
          fail: function(error) {
            clearTimeout(locationTimeout);
            log.error('位置获取失败:', error)

            // 首次请求失败说明用户拒绝了授权
            if (permissionResult.firstTime) {
              self.globalData.locationPermission = 'denied';
              wx.setStorageSync('locationPermission', 'denied');
              log.info('用户拒绝了位置授权')
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
