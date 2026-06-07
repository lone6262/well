/**
 * 电话号码工具模块
 * 提供电话字符串的格式化和提取功能
 */

/**
 * 提取单个电话号码（多个号码用分隔符分开时只取第一个）
 * @param {string} phone - 原始电话字符串
 * @returns {string} 清理后的电话号码，若无效则返回空字符串
 */
function extractSinglePhone(phone) {
  if (!phone) return '';
  let telStr = phone.toString();
  // 多个号码可能用分号、逗号、斜杠、顿号等分隔，只取第一个
  let parts = telStr.split(/[;；,，/\\、\n\r|]/);
  let first = (parts[0] || '').trim();
  // 清理：只保留数字、+、-、空格
  let cleaned = first.replace(/[^0-9+\-\s]/g, '').trim();
  return (cleaned && cleaned.length >= 7) ? cleaned : '';
}

module.exports = {
  extractSinglePhone: extractSinglePhone
};
