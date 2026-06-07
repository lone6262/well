/**
 * 报告生成引擎
 * 支持 DeepSeek AI 生成 + 模板回退
 *
 * 生成流程：缓存 → DeepSeek API → 模板回退
 *
 * 使用方式：
 *   const reportEngine = require('./report-engine');
 *   const result = await reportEngine.generateReport(db, symptomRecord, petInfo);
 */

const crypto = require('crypto');
const https = require('https');

const {
  AGE_THRESHOLD,
  AGE_RANGES,
  CACHE_TTL,
  COLLECTIONS,
  REPORT_SOURCE,
  SERVER_CONFIG,
  AI_CONFIG
} = require('./constants');

// ============================================
// 工具函数
// ============================================

/**
 * 生成确定性缓存 key
 */
function generateCacheKey(symptomIds, petType, ageRange) {
  if (!Array.isArray(symptomIds) || symptomIds.length === 0) {
    throw new Error('symptomIds must be a non-empty array');
  }
  if (!petType || !ageRange) {
    throw new Error('petType and ageRange are required');
  }

  const sorted = [...symptomIds].sort();
  const raw = sorted.join(',') + ':' + petType + ':' + ageRange;
  return crypto.createHash('md5').update(raw, 'utf8').digest('hex');
}

/**
 * 根据月龄判断年龄段
 */
function getAgeRange(ageMonths, petType) {
  if (typeof ageMonths !== 'number' || ageMonths < 0) {
    return AGE_RANGES.ADULT;
  }

  if (ageMonths < AGE_THRESHOLD.KITTEN) {
    return AGE_RANGES.YOUNG;
  }

  const seniorThreshold = petType === 'dog'
    ? AGE_THRESHOLD.SENIOR_DOG
    : AGE_THRESHOLD.SENIOR_CAT;

  if (ageMonths > seniorThreshold) {
    return AGE_RANGES.SENIOR;
  }

  return AGE_RANGES.ADULT;
}

// ============================================
// 缓存操作
// ============================================

/**
 * 查询缓存
 */
async function getCache(db, cacheKey) {
  const cacheResult = await db.collection(COLLECTIONS.AI_CACHE).where({
    symptoms_hash: cacheKey
  }).orderBy('created_at', 'desc').limit(1).get();

  if (cacheResult.data && cacheResult.data.length > 0) {
    const cached = cacheResult.data[0];
    if (cached.expire_at && new Date(cached.expire_at) > new Date()) {
      // 更新命中计数
      try {
        await db.collection(COLLECTIONS.AI_CACHE).doc(cached._id).update({
          data: { hit_count: (cached.hit_count || 0) + 1 }
        });
      } catch (_) {}

      return cached;
    }
  }
  return null;
}

/**
 * 写入缓存
 */
async function setCache(db, cacheKey, content, source, petInfo, ageRange, riskLevel) {
  const now = new Date();

  // 概率性清理过期缓存（1% 概率）
  if (Math.random() < AI_CONFIG.CACHE_CLEANUP_PROBABILITY) {
    cleanExpiredCache(db).catch(function() {});
  }

  const expireAt = new Date(now.getTime() + CACHE_TTL);

  const cacheDoc = {
    symptoms_hash: cacheKey,
    pet_type: petInfo.type,
    age_range: ageRange,
    risk_level: riskLevel,
    report_content: content,
    source: source,
    hit_count: 0,
    created_at: now,
    expire_at: expireAt
  };

  const addResult = await db.collection(COLLECTIONS.AI_CACHE).add({ data: cacheDoc });
  return addResult._id;
}

/**
 * 清理过期缓存
 */
async function cleanExpiredCache(db) {
  try {
    const result = await db.collection(COLLECTIONS.AI_CACHE)
      .where({ expire_at: db.command.lt(new Date()) })
      .remove();
    if (result.stats && result.stats.removed > 0) {
      console.log('[cache] 清理了 ' + result.stats.removed + ' 条过期缓存');
    }
  } catch (_) {}
}

// ============================================
// DeepSeek AI 调用
// ============================================

/**
 * 调用 DeepSeek Chat API
 *
 * @param {string} prompt - 用户提示词
 * @returns {string} AI 返回的文本
 */
function callDeepSeekAPI(systemPrompt, userPrompt) {
  const apiKey = SERVER_CONFIG.DEEPSEEK_API_KEY;
  const baseUrl = SERVER_CONFIG.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = SERVER_CONFIG.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey || apiKey === 'sk-xxx') {
    console.warn('[deepseek] API Key 未配置，跳过 AI 生成');
    return Promise.reject(new Error('DeepSeek API Key not configured'));
  }

  const body = JSON.stringify({
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: AI_CONFIG.TEMPERATURE,
    max_tokens: AI_CONFIG.MAX_TOKENS,
    response_format: { type: 'json_object' }
  });

  // 解析 base URL 的 hostname 和 path
  const urlObj = new URL(baseUrl);
  const path = '/v1/chat/completions';

  const options = {
    hostname: urlObj.hostname,
    port: AI_CONFIG.API_PORT,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
      'Content-Length': Buffer.byteLength(body)
    },
    timeout: AI_CONFIG.TIMEOUT_MS
  };

  return new Promise(function(resolve, reject) {
    const req = https.request(options, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          const result = JSON.parse(data);
          if (result.error) {
            reject(new Error('DeepSeek API error: ' + result.error.message));
            return;
          }
          const content = result.choices && result.choices[0] && result.choices[0].message
            ? result.choices[0].message.content
            : '';
          resolve(content);
        } catch (e) {
          reject(new Error('Failed to parse DeepSeek response: ' + e.message));
        }
      });
    });

    req.on('error', function(err) { reject(err); });
    req.setTimeout(AI_CONFIG.TIMEOUT_MS, function() {
      req.destroy(new Error('DeepSeek API timeout'));
    });
    req.write(body);
    req.end();
  });
}

/**
 * 校验 AI 返回的报告结构是否完整
 */
function validateReportStructure(report) {
  if (!report || typeof report !== 'object') return false;

  // 必须包含 risk_summary
  if (!report.risk_summary || typeof report.risk_summary !== 'string') return false;

  // home_care 必须是非空数组
  if (!Array.isArray(report.home_care) || report.home_care.length === 0) return false;

  return true;
}

/**
 * 使用 DeepSeek 生成报告
 */
async function generateLLMReport(symptomRecord, petInfo) {
  const petTypeName = petInfo.type === 'cat' ? '猫咪' : (petInfo.type === 'dog' ? '狗狗' : '宠物');
  const ageDisplay = petInfo.age ? petInfo.age + '个月' : '未知';
  const symptomsDisplay = Array.isArray(symptomRecord.symptom_names)
    ? symptomRecord.symptom_names.join('、')
    : String(symptomRecord.symptom_names || '未知症状');

  const riskDisplay = { low: '低风险', mid: '中等风险', high: '高风险' };
  const riskText = riskDisplay[symptomRecord.risk_level] || '未知风险';

  const systemPrompt = [
    '你是一位资深的宠物健康顾问，擅长猫狗常见疾病的症状分析和护理指导。',
    '请根据用户提供的宠物信息和症状，生成一份详细的宠物健康评估报告。',
    '你必须严格使用 JSON 格式返回，不要添加任何 markdown 标记或额外说明。',
    '报告内容要专业但通俗易懂，让宠物主人能看懂并采取正确行动。',
    '所有内容用中文书写。'
  ].join('\n');

  const userPrompt = [
    '请为以下宠物生成一份健康评估报告：',
    '',
    '【宠物信息】',
    '类型：' + petTypeName,
    '年龄：' + ageDisplay,
    '品种：' + (petInfo.breed || '未知'),
    '名字：' + (petInfo.name || petTypeName),
    '',
    '【症状信息】',
    '症状：' + symptomsDisplay,
    '风险等级：' + riskText,
    '主人描述：' + (symptomRecord.description || '无额外描述'),
    '',
    '请严格按以下 JSON 格式返回（不要加 markdown 代码块标记）：',
    '{',
    '  "risk_summary": "一段200字左右的风险概述，说明当前症状可能的原因和整体风险判断",',
    '  "symptom_analysis": [',
    '    { "name": "症状名称", "explanation": "该症状的可能原因和机制解释，100字左右" }',
    '  ],',
    '  "home_care": [',
    '    "具体的家庭护理建议，每条30-50字，至少5条"',
    '  ],',
    '  "observation_indicators": [',
    '    "需要观察的指标，如体温、食欲、精神状态等，至少4条"',
    '  ],',
    '  "escalation_signals": [',
    '    "需要立即就医的信号，至少4条"',
    '  ],',
    '  "vet_recommendation": {',
    '    "needed": true或false,',
    '    "urgency": "low或medium或high",',
    '    "what_to_tell_vet": "就诊时需要告知兽医的关键信息，100字左右"',
    '    "preparation": "就诊前的准备工作，如禁食、收集样本等"',
    '    "estimated_cost": "预估费用范围"',
    '    "recommended_checkup": "建议的检查项目"',
    '    "time_sensitivity": "就诊时间紧迫性说明"',
    '    "home_remedies_to_avoid": ["不建议在家尝试的偏方或药物"]',
    '  },',
    '  "common_misconceptions": [',
    '    { "myth": "常见误解", "fact": "正确认识" }',
    '  ],',
    '  "disclaimer": "本报告由AI根据公开医学资料生成，仅供参考，不具备医疗诊断效力。所有治疗决策请咨询执业兽医师。"',
    '  "recovery_timeline": "预计恢复时间范围",',
    '  "dietary_advice": "饮食建议",',
    '  "environment_advice": "环境调整建议"',
    '}'
  ].join('\n');

  console.log('[deepseek] 开始调用 AI 生成报告...');

  const rawContent = await callDeepSeekAPI(systemPrompt, userPrompt);

  console.log('[deepseek] AI 返回内容长度: ' + rawContent.length);

  // 解析 JSON（去除可能的 markdown 代码块标记）
  let cleanedContent = rawContent.trim();
  if (cleanedContent.startsWith('```')) {
    cleanedContent = cleanedContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const report = JSON.parse(cleanedContent);

  if (!validateReportStructure(report)) {
    throw new Error('AI 返回的报告结构不完整');
  }

  // 确保 disclaimer 存在
  if (!report.disclaimer) {
    report.disclaimer = '本报告由AI根据公开医学资料生成，仅供参考，不具备医疗诊断效力。所有治疗决策请咨询执业兽医师。';
  }

  return report;
}

// ============================================
// 模板回退
// ============================================

/**
 * 从数据库选择报告模板
 */
async function selectTemplate(db, riskLevel, petType) {
  const collection = db.collection(COLLECTIONS.REPORT_TEMPLATES);

  // 1. 尝试精确匹配宠物类型
  let result = await collection.where({
    symptoms_key: 'general',
    pet_type: petType,
    risk_level: riskLevel
  }).get();

  // 2. 回退到通用类型
  if (!result.data || result.data.length === 0) {
    result = await collection.where({
      symptoms_key: 'general',
      pet_type: 'all',
      risk_level: riskLevel
    }).get();
  }

  if (!result.data || result.data.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * result.data.length);
  const template = result.data[index];
  return template.content ? { ...template.content } : null;
}

/**
 * 深拷贝并替换占位符
 */
function fillTemplate(obj, variables) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return obj.replace(/\{\{(\w+)\}\}/g, function(match, key) {
      return Object.prototype.hasOwnProperty.call(variables, key)
        ? String(variables[key])
        : match;
    });
  }

  if (Array.isArray(obj)) {
    return obj.map(function(item) { return fillTemplate(item, variables); });
  }

  if (typeof obj === 'object') {
    const result = {};
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = fillTemplate(obj[keys[i]], variables);
    }
    return result;
  }

  return obj;
}

/**
 * 模板回退生成
 */
async function generateTemplateReport(db, symptomRecord, petInfo) {
  const template = await selectTemplate(db, symptomRecord.risk_level, petInfo.type);

  if (!template) {
    return null;
  }

  const petTypeName = petInfo.type === 'cat' ? '猫咪' : '狗狗';
  const variables = {
    symptom_name: Array.isArray(symptomRecord.symptom_names)
      ? symptomRecord.symptom_names.join('、')
      : String(symptomRecord.symptom_names || ''),
    pet_type_name: petTypeName,
    pet_name: petInfo.name || petTypeName
  };

  return fillTemplate(template, variables);
}

// ============================================
// 主入口
// ============================================

/**
 * 完整报告生成流程
 * 1. 查缓存 → 2. DeepSeek AI → 3. 模板回退 → 4. 写缓存
 *
 * @param {object} db - 云数据库实例
 * @param {object} symptomRecord - { symptoms, symptom_names, risk_level, description }
 * @param {object} petInfo - { type, age, name, breed }
 * @returns {{ content: object, source: string, cacheHit: boolean, cacheId: string|null }}
 */
async function generateReport(db, symptomRecord, petInfo) {
  // 1. 判断年龄段 & 生成缓存 key
  const ageRange = getAgeRange(petInfo.age, petInfo.type);
  const cacheKey = generateCacheKey(symptomRecord.symptoms, petInfo.type, ageRange);

  // 2. 查缓存
  const cached = await getCache(db, cacheKey);
  if (cached) {
    console.log('[report] 命中缓存, cacheId=' + cached._id);
    return {
      content: cached.report_content,
      source: REPORT_SOURCE.CACHE,
      cacheHit: true,
      cacheId: cached._id
    };
  }

  // 3. 尝试 DeepSeek AI 生成
  let content = null;
  let source = REPORT_SOURCE.TEMPLATE;

  try {
    content = await generateLLMReport(symptomRecord, petInfo);
    source = REPORT_SOURCE.LLM;
    console.log('[report] DeepSeek AI 生成成功');
  } catch (err) {
    console.warn('[report] DeepSeek 生成失败，回退模板模式: ' + err.message);

    // 4. 模板回退
    content = await generateTemplateReport(db, symptomRecord, petInfo);

    if (!content) {
      throw new Error(
        '报告生成失败：AI 不可用且无匹配模板 (risk=' + symptomRecord.risk_level +
        ', type=' + petInfo.type + ')'
      );
    }
    source = REPORT_SOURCE.TEMPLATE;
  }

  // 5. 写入缓存
  let cacheId = null;
  try {
    cacheId = await setCache(db, cacheKey, content, source, petInfo, ageRange, symptomRecord.risk_level);
  } catch (err) {
    console.warn('[report] 缓存写入失败（不影响返回）: ' + err.message);
  }

  return {
    content: content,
    source: source,
    cacheHit: false,
    cacheId: cacheId
  };
}

module.exports = {
  generateCacheKey,
  getAgeRange,
  selectTemplate,
  fillTemplate,
  generateReport,
  cleanExpiredCache
};
