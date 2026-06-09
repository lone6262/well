// 数据埋点 — 记录关键业务事件到 analytics_events 集合
// 供运营分析和数据看板使用
const cloud = require('wx-server-sdk');
const {
  COLLECTIONS,
  RESPONSE_CODE,
  warmupConfig,
} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 支持的事件列表
 * 每个事件有固定的字段要求，确保数据一致性
 */
const VALID_EVENTS = {
  // === 支付相关 ===
  pay_success: {
    description: '支付成功',
    requiredFields: ['order_id', 'order_type', 'amount'],
  },
  pay_cancel: {
    description: '取消支付',
    requiredFields: ['order_id', 'order_type'],
  },
  pay_fail: {
    description: '支付失败',
    requiredFields: ['order_id', 'order_type', 'error_msg'],
  },

  // === 会员相关 ===
  member_renew: {
    description: '会员续费成功',
    requiredFields: ['member_type', 'channel'], // channel: auto | manual | recall
  },
  member_expire: {
    description: '会员到期',
    requiredFields: ['member_type', 'expire_date'],
  },
  member_upgrade: {
    description: '会员升级',
    requiredFields: ['from_type', 'to_type'],
  },
  member_auto_renew_switch: {
    description: '自动续费开关变化',
    requiredFields: ['enabled'], // boolean
  },

  // === 家庭会员 ===
  family_member_add: {
    description: '添加家庭成员',
    requiredFields: ['member_id'],
  },
  family_member_remove: {
    description: '移除家庭成员',
    requiredFields: ['member_id', 'target_user_id'],
  },

  // === 优惠券 ===
  coupon_receive: {
    description: '领取优惠券',
    requiredFields: ['coupon_id', 'scene'], // scene: new_user | invite | ...
  },
  coupon_use: {
    description: '使用优惠券',
    requiredFields: ['coupon_id', 'order_id', 'discount_amount'],
  },
  coupon_expire: {
    description: '优惠券过期',
    requiredFields: ['coupon_id'],
  },

  // === 退款 ===
  refund_request: {
    description: '申请退款',
    requiredFields: ['order_id', 'reason'],
  },
  refund_complete: {
    description: '退款完成',
    requiredFields: ['order_id', 'refund_amount'],
  },

  // === 邀请 ===
  invite_sent: {
    description: '发起邀请',
    requiredFields: [],
  },
  invite_success: {
    description: '邀请成功（被邀请人完成自查）',
    requiredFields: ['invitee_id'],
  },

  // === 报告 ===
  report_generate: {
    description: '生成 AI 报告',
    requiredFields: ['source'], // source: template | llm | cache
  },
};

/**
 * 记录埋点事件
 *
 * @param {string} eventName  - 事件名（VALID_EVENTS 中的 key）
 * @param {object} properties - 事件属性（必须包含对应 requiredFields）
 * @returns {object} { code, msg, data: { eventId } }
 */
exports.main = async (event, context) => {
  await warmupConfig(db);
  const { OPENID } = cloud.getWXContext();
  const { eventName, properties = {} } = event;

  // 参数校验
  if (!eventName) {
    return { code: RESPONSE_CODE.ERROR, msg: '缺少事件名', data: {} };
  }

  const eventDef = VALID_EVENTS[eventName];
  if (!eventDef) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: `未知事件: ${eventName}`,
      data: { validEvents: Object.keys(VALID_EVENTS) },
    };
  }

  // 校验必填字段
  const missingFields = (eventDef.requiredFields || []).filter(
    f => properties[f] === undefined && properties[f] !== 0
  );
  if (missingFields.length > 0) {
    return {
      code: RESPONSE_CODE.ERROR,
      msg: `事件 ${eventName} 缺少必填字段: ${missingFields.join(', ')}`,
      data: {},
    };
  }

  try {
    const now = new Date();
    const eventRecord = {
      event_name: eventName,
      user_id: OPENID || properties.user_id || '',
      properties: {
        ...properties,
      },
      client_timestamp: properties.client_timestamp || null,
      server_timestamp: now,
      created_at: now,
    };

    const result = await db.collection(COLLECTIONS.ANALYTICS_EVENTS).add({
      data: eventRecord,
    });

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '事件已记录',
      data: { eventId: result._id, eventName },
    };
  } catch (error) {
    console.error(`[trackEvent] 记录事件 ${eventName} 失败:`, error.message);
    // 埋点失败不应阻断业务，静默返回
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '事件记录失败',
      data: {},
    };
  }
};
