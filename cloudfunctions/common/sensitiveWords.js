/**
 * 敏感词过滤（云函数侧）
 *
 * 词库源自 miniprogram/config/sensitiveWords.js（前端），此处为云函数副本，
 * 供 generatePetDiary 等 AI 内容生成场景使用。词库更新需同步两端并跑 sync-common.sh。
 *
 * 使用方式：
 *   const { filterSensitive } = require('./common/sensitiveWords');
 *   const cleaned = filterSensitive(aiGeneratedText, 'care');
 */

// 医疗相关敏感词（与前端 MEDICAL_SENSITIVE_WORDS 保持一致）
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
  '禁用药物',
];

// 非法/有害内容关键词（与前端 HARMFUL_CONTENT_KEYWORDS 保持一致）
const HARMFUL_CONTENT_KEYWORDS = [
  '赌博',
  '赌场',
  '博彩',
  '诈骗',
  '传销',
  '色情',
  '毒品',
  '枪支',
  '暴力',
];

// care 语境下豁免的医学合理术语（症状护理日记中提及病情是正常表达）
const CARE_EXEMPT = new Set(['癌症', '肿瘤']);

const ALL_WORDS = MEDICAL_SENSITIVE_WORDS.concat(HARMFUL_CONTENT_KEYWORDS);

/**
 * 将文本中的敏感词替换为 **。
 * @param {string} text - 待过滤文本
 * @param {string} [context] - 生成语境（'care'/'daily'/'welcome'/'learn'）；'care' 时豁免 CARE_EXEMPT
 * @returns {string} 过滤后文本
 */
function filterSensitive(text, context) {
  if (!text || typeof text !== 'string') return '';
  let out = text;
  for (let i = 0; i < ALL_WORDS.length; i++) {
    const w = ALL_WORDS[i];
    if (context === 'care' && CARE_EXEMPT.has(w)) continue;
    if (out.indexOf(w) !== -1) {
      out = out.split(w).join('**');
    }
  }
  return out;
}

module.exports = {
  filterSensitive,
  MEDICAL_SENSITIVE_WORDS,
  HARMFUL_CONTENT_KEYWORDS,
};
