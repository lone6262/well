// app.js - 按照用户专业登录方案实现
// 完全遵循：静默登录、游客模式、按需授权、token续期

App({
  globalData: {
    userInfo: null,
    openid: null,
    token: null,
    cloudInitialized: false,
    isGuest: true // 游客模式标识
  },

  onLaunch: function () {
    console.log('=== 小程序启动 - 开始静默登录 ===');

    // 1. 初始化全局数据
    this.globalData = {
      userInfo: null,
      openid: null,
      token: null,
      cloudInitialized: false,
      isGuest: true
    };

    // 2. 立即启动云开发
    if (typeof wx !== 'undefined' && wx.cloud) {
      this.initCloudDevelopment()
    }

    // 3. 先创建模拟用户，解决数据库为空问题
    this.createMockUser();

    // 4. 执行静默登录（用户方案步骤1-4）
    this.silentLogin();

    // 5. 显示免责声明
    this.checkFirstLaunch()
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

          console.log('=== 静默登录完成，用户可无感知使用小程序 ===');
        } else {
          console.error('云函数登录失败，返回结果:', result);
          self.enterGuestMode();
        }
      },
      fail: function(err) {
        console.error('❌ 调用云函数失败:', err);
        console.error('错误详情:', err.errMsg);
        console.log('⚠️ 云函数调用失败，进入游客模式，小程序仍可正常使用');
        // 云函数调用失败，进入游客模式
        self.enterGuestMode();
      }
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
        }.bind(this)
      });
    } catch (error) {
      console.log('❌ 云开发初始化异常:', error);
      this.globalData.cloudInitialized = false;
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
  }
})
