// 管理端额度诊断（需管理员 Token）— 查询指定 user_id 的会员报告额度
// 安全修复：原版本硬编码 openid 且无鉴权（任意调用方可查他人额度），
// 现改为管理员 Token 鉴权 + user_id 参数化，不再泄露特定用户数据。
const cloud = require('wx-server-sdk');
const { verifyAdminToken } = require('./common/admin-auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  // 1. 管理员鉴权
  if (!verifyAdminToken(event.token)) {
    return { code: -1, msg: '无权限' };
  }

  // 2. 参数化查询目标用户（不再硬编码 openid）
  const openid = event.user_id;
  if (!openid) {
    return { code: -1, msg: 'user_id 不能为空' };
  }

  const mRes = await db.collection('members').where({ user_id: openid }).limit(1).get();
  const member = mRes.data && mRes.data[0];
  return {
    code: 0,
    data: {
      member: member
        ? {
            type: member.type,
            used: member.report_credits_used,
            total: member.report_credits_total,
          }
        : null,
    },
  };
};
