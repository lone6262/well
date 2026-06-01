/**
 * 敏感词配置
 * 集中管理所有需要过滤的敏感词汇
 *
 * 使用方式:
 *   const { checkSensitiveWords } = require('../../config/sensitiveWords.js')
 *   const result = checkSensitiveWords(userInput)
 *   if (result.hasSensitive) {
 *     wx.showToast({ title: result.message })
 *     return
 *   }
 */

// 医疗相关敏感词（用户不应自行诊断用药）
const MEDICAL_SENSITIVE_WORDS = [
  '激素',
  '抗生素',
  '处方药',
  '剧毒',
  '致命',
  '癌症',
  '肿瘤',
  '安乐死',
  '人药',
  '自行用药',
  '自己开药',
  '自己打针',
  '毒药',
  '老鼠药',
  '禁用药物'
];

// 非法/有害内容关键词
const HARMFUL_CONTENT_KEYWORDS = [
  '赌博',
  '赌场',
  '博彩',
  '诈骗',
  '传销',
  '色情',
  '毒品',
  '枪支',
  '暴力'
];

/**
 * 检查文本是否包含敏感词
 * @param {string} text - 待检查文本
 * @returns {{ hasSensitive: boolean, message: string, matchedWord: string }}
 */
function checkSensitiveWords(text) {
  if (!text || typeof text !== 'string') {
    return { hasSensitive: false, message: '', matchedWord: '' };
  }

  const allSensitiveWords = [...MEDICAL_SENSITIVE_WORDS, ...HARMFUL_CONTENT_KEYWORDS];

  for (let i = 0; i < allSensitiveWords.length; i++) {
    const word = allSensitiveWords[i];
    if (text.indexOf(word) !== -1) {
      return {
        hasSensitive: true,
        message: generateMessage(word),
        matchedWord: word
      };
    }
  }

  return { hasSensitive: false, message: '', matchedWord: '' };
}

/**
 * 根据敏感词类型生成提示信息
 * @param {string} word
 * @returns {string}
 */
function generateMessage(word) {
  if (MEDICAL_SENSITIVE_WORDS.includes(word)) {
    return '为保障宠物安全，请勿自行使用药物或进行诊断，建议立即咨询专业兽医。';
  }
  if (HARMFUL_CONTENT_KEYWORDS.includes(word)) {
    return '描述中包含不当内容，请修改后重新提交。';
  }
  return '描述中包含敏感词汇，请修改后重新提交。';
}

/**
 * 获取所有敏感词列表
 * @returns {string[]}
 */
function getAllSensitiveWords() {
  return [...MEDICAL_SENSITIVE_WORDS, ...HARMFUL_CONTENT_KEYWORDS];
}

module.exports = {
  MEDICAL_SENSITIVE_WORDS,
  HARMFUL_CONTENT_KEYWORDS,
  checkSensitiveWords,
  getAllSensitiveWords
};
