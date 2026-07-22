// 生成邀请小程序码云函数
// 用 wxacode.getUnlimited 生成「带邀请码作 scene」的小程序码，上传云存储返回 fileID，
// 供邀请海报前端 canvas drawImage 绘制。扫码后 scene 即邀请码，复用 processInviteReward 结算链路。
const cloud = require('wx-server-sdk');
const { COLLECTIONS, RESPONSE_CODE, warmupConfig } = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 小程序码生成参数
const QR_PAGE = 'pages/index/index'; // 扫码落地页（不带前导 /，不能带参数）
const QR_WIDTH = 280;
const QR_CLOUD_PREFIX = 'qrcode/';
// envVersion cascade：release（正式版码，已发布则任何用户可扫）→ trial（体验版码，测试期/未发布兜底）
const QR_ENV_VERSIONS = ['release', 'trial'];

/**
 * 调 wxacode.getUnlimited 生成小程序码 buffer
 * 逐个 envVersion 尝试，取首个返回 buffer 且无 errCode 的结果；全部失败返回 null
 */
async function generateQrcodeBuffer(scene) {
  for (const envVersion of QR_ENV_VERSIONS) {
    try {
      const res = await cloud.openapi.wxacode.getUnlimited({
        scene: scene,
        page: QR_PAGE,
        width: QR_WIDTH,
        envVersion: envVersion,
      });
      if (res && res.buffer && !res.errCode) {
        console.log('[getInviteQrcode] 生成成功, envVersion=' + envVersion);
        return res.buffer;
      }
      console.warn(
        '[getInviteQrcode] envVersion=' + envVersion + ' 返回异常:',
        res && (res.errCode || res.errmsg)
      );
    } catch (e) {
      // 该版本失败（如 release 要求小程序已正式发布），试下一个
      console.warn('[getInviteQrcode] envVersion=' + envVersion + ' 异常:', e.message);
    }
  }
  return null;
}

/**
 * 生成邀请小程序码
 * @param {object} event
 * @param {string} event.inviteCode - 邀请码（16 位 hex），作为小程序码 scene
 * @returns {object} { fileId }
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const inviteCode = event && event.inviteCode;

  if (!OPENID) {
    return { code: RESPONSE_CODE.UNAUTHORIZED, msg: '用户未登录', data: {} };
  }
  if (!inviteCode) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少邀请码', data: {} };
  }

  try {
    // 1. 校验邀请码归属当前用户
    const recordRes = await db
      .collection(COLLECTIONS.INVITE_RECORDS)
      .where({ inviter_id: OPENID, invite_code: inviteCode })
      .limit(1)
      .get();
    if (!recordRes.data || recordRes.data.length === 0) {
      return { code: RESPONSE_CODE.ERROR, msg: '邀请码无效', data: {} };
    }
    const record = recordRes.data[0];

    // 2. 命中缓存：已有 qr_fileid 直接返回（失效由前端 getImageInfo 失败降级兜底）
    if (record.qr_fileid) {
      return {
        code: RESPONSE_CODE.SUCCESS,
        msg: '小程序码获取成功（缓存）',
        data: { fileId: record.qr_fileid },
      };
    }

    // 3. 生成小程序码 buffer（release→trial cascade）
    const buffer = await generateQrcodeBuffer(inviteCode);
    if (!buffer) {
      return { code: RESPONSE_CODE.SERVER_ERROR, msg: '小程序码生成失败', data: {} };
    }

    // 4. 上传云存储拿 fileID
    const uploadRes = await cloud.uploadFile({
      cloudPath: QR_CLOUD_PREFIX + inviteCode + '.png',
      fileContent: buffer,
    });
    const fileId = uploadRes.fileID;

    // 5. 回写缓存 qr_fileid（best-effort，失败不影响本次返回）
    try {
      await db
        .collection(COLLECTIONS.INVITE_RECORDS)
        .doc(record._id)
        .update({
          data: { qr_fileid: fileId, updated_at: new Date() },
        });
    } catch (updErr) {
      console.warn('[getInviteQrcode] 缓存回写失败:', updErr.message);
    }

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '小程序码生成成功',
      data: { fileId: fileId },
    };
  } catch (error) {
    console.error('[getInviteQrcode] 失败:', error.message);
    return { code: RESPONSE_CODE.SERVER_ERROR, msg: '小程序码生成失败', data: {} };
  }
};
