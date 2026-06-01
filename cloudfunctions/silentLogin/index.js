// 静默登录云函数 - 使用云开发内置openid + HMAC签名Token
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// Token签名密钥（生产环境应使用环境变量）
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'well_pet_health_token_secret_2025';
const TOKEN_EXPIRE_DAYS = 7;

/**
 * 创建HMAC-SHA256签名
 */
function createSignature(payload, secret) {
  return crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * 生成签名的Token（格式: base64(header.payload).signature）
 */
function generateToken(openid, userId) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    openid: openid,
    userId: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRE_DAYS * 24 * 60 * 60
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSignature(`${headerB64}.${payloadB64}`, TOKEN_SECRET);

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * 验证Token（导出供其他云函数使用）
 */
function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;

    // 验证签名
    const expectedSig = createSignature(`${headerB64}.${payloadB64}`, TOKEN_SECRET);
    if (signature !== expectedSig) return null;

    // 解码payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // 检查过期
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * 静默登录云函数
 * 直接使用云开发内置的WX Context获取openid
 */
exports.main = async (event) => {
  try {
    console.log('=== 静默登录开始 ===');

    // 直接从context获取openid（云开发内置）
    const { OPENID } = cloud.getWXContext();

    console.log('获取openid成功:', OPENID);

    // 查找或创建用户（使用user_id字段与其他云函数保持一致）
    const userResult = await db.collection('users').where({
      user_id: OPENID
    }).get();

    let userData;
    let isNewUser = false;

    if (userResult.data.length === 0) {
      // 新用户，创建记录
      userData = {
        user_id: OPENID,
        nickName: '宠物主人',
        avatarUrl: '',
        createTime: new Date(),
        updateTime: new Date(),
        isMember: false,
        lastLoginTime: new Date(),
        loginCount: 1
      };

      const addResult = await db.collection('users').add({
        data: userData
      });

      userData._id = addResult._id;
      isNewUser = true;

      console.log('创建新用户成功:', userData._id);
    } else {
      // 老用户，更新登录信息
      userData = userResult.data[0];
      userData.lastLoginTime = new Date();
      userData.loginCount = (userData.loginCount || 0) + 1;

      await db.collection('users').doc(userData._id).update({
        data: {
          lastLoginTime: userData.lastLoginTime,
          loginCount: userData.loginCount,
          updateTime: new Date()
        }
      });

      console.log('用户登录成功:', userData._id);
    }

    // 生成HMAC签名的Token（替代Base64编码）
    const token = generateToken(OPENID, userData._id);

    console.log('生成签名Token成功');

    return {
      code: 0,
      msg: isNewUser ? '登录成功（新用户）' : '登录成功',
      data: {
        token: token,
        openid: OPENID,
        userId: userData._id,
        userInfo: {
          nickName: userData.nickName,
          avatarUrl: userData.avatarUrl,
          isMember: userData.isMember
        },
        isNewUser: isNewUser
      }
    };

  } catch (error) {
    console.error('静默登录失败:', error);
    return {
      code: -1,
      msg: '登录失败: ' + error.message,
      data: {},
      error: error.toString()
    };
  }
};

// 导出verifyToken供其他云函数使用
exports.verifyToken = verifyToken;
