const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
exports.main = async () => {
  const openid = 'oVXBX3c29b5ZTKPTcknbS2F9TJi8';
  const mRes = await db.collection('members').where({ user_id: openid }).limit(1).get();
  const member = mRes.data && mRes.data[0];
  return { code: 0, data: { member: member ? { type: member.type, used: member.report_credits_used, total: member.report_credits_total } : null } };
};
