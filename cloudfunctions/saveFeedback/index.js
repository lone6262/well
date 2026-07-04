// 反馈保存云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 保存用户反馈
 */
exports.main = async (event) => {
  const { type, content, images, contact, openid, createTime, status } = event;

  try {
    console.log('[saveFeedback] 开始保存反馈');

    // 验证必填字段
    if (!type || !content) {
      return {
        code: -1,
        msg: '反馈类型和内容不能为空',
        data: {}
      };
    }

    // 验证 openid
    if (!openid) {
      return {
        code: -2,
        msg: '用户未登录',
        data: {}
      };
    }

    // 构建反馈数据
    const feedbackData = {
      type: type,                    // 反馈类型：bug/suggestion/report/member/other
      content: content,               // 问题描述
      images: images || [],           // 图片列表
      contact: contact || {},         // 联系方式
      openid: openid,                 // 用户openid
      status: status || 'pending',    // 状态：pending/processing/resolved
      createTime: createTime || new Date(), // 创建时间
      updateTime: new Date()          // 更新时间
    };

    // 保存到数据库
    const result = await db.collection('feedbacks').add({
      data: feedbackData
    });

    console.log('[saveFeedback] 反馈保存成功:', result._id);

    return {
      code: 0,
      msg: '提交成功',
      data: {
        feedbackId: result._id
      }
    };

  } catch (error) {
    console.error('[saveFeedback] 保存失败:', error);
    return {
      code: -1,
      msg: '提交失败，请稍后重试',
      data: {}
    };
  }
};
