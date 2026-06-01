// 删除自查记录云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { openid, recordId } = event;

  if (!openid || !recordId) {
    return { code: -1, msg: '参数不完整' };
  }

  try {
    // 查询记录确认归属
    const record = await db.collection('symptom_records').doc(recordId).get();
    if (!record.data) {
      return { code: 404, msg: '记录不存在' };
    }
    if (record.data.user_id !== openid) {
      return { code: 401, msg: '无权删除此记录' };
    }

    // 删除记录
    await db.collection('symptom_records').doc(recordId).remove();
    return { code: 0, msg: '删除成功' };
  } catch (err) {
    return { code: 500, msg: '删除失败: ' + err.message };
  }
};
