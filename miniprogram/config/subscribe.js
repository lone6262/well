/**
 * 订阅消息模板 ID 配置（小程序端 requestSubscribeMessage 用）
 *
 * 微信模板 ID 绑定 AppID，非密钥；按微信小程序惯例，requestSubscribeMessage 需在
 * 前端拿到 tmplIds，故此处硬编码（与业界做法一致）。
 * 模板申请：微信公众平台 → 功能 → 订阅消息 → 「日记更新」
 *
 * ⚠️ 若 generatePetDiary 发送报 errcode 47003（模板参数不匹配），
 *    需核对模板详情的关键字类型/顺序，调整 generatePetDiary 的 data 字段名。
 */
module.exports = {
  // 「日记更新」一次性订阅模板（关键字：宠物名 + 日记摘要）
  DIARY_TEMPLATE_ID: 'JtfG4ESNBEWdPb5BbRQsgZvmqIVLrj9GJdZbQ2YDaIw'
};
