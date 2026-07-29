/**
 * generatePetDiary — 每日为活跃用户生成宠物日记（定时 00:30 北京时间触发）
 *
 * 关键策略（修订版 §4.2）：
 * - 单实例分批 + 批内并发 10（避免串行超时）
 * - 仅近 14 天活跃用户（users.last_active_at）—— 不遍历历史全量
 * - 确定性灰度 hash(openid)%100<rollout；control 组不生成（H1 基线）
 * - 唯一索引 {user_id,date} 兜底幂等
 * - callDeepSeekAPI 纯文本润色（responseFormat:null），失败模板兜底
 * - filterSensitive 过滤（care 语境豁免医学术语）
 */
const cloud = require('wx-server-sdk');
const { COLLECTIONS, SERVER_CONFIG, warmupConfig } = require('./common/constants');
const { createLogger } = require('./common/logger');
const { callDeepSeekAPI } = require('./common/report-engine');
const { filterSensitive } = require('./common/sensitiveWords');
const { cnDateStr, cnYesterdayRange } = require('./common/date-cn');
const templates = require('./diary-templates');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const logger = createLogger('generatePetDiary');

const ACTIVE_DAYS = 14;
const CONCURRENCY = 10;
const DIARY_AI_TIMEOUT_MS = 8000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// === 确定性灰度分组（同一 openid 永远落同一组）===
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
function inTreatment(userId, rolloutPercent) {
  return hashStr(userId) % 100 < rolloutPercent;
}

function pickMood(templateKey) {
  const moods = { welcome: 'excited', care: 'grateful', learn: 'curious', daily: 'happy' };
  return moods[templateKey] || 'happy';
}

function selectTemplateKey(isFirst, symptomCount, knowledgeCount) {
  if (isFirst) return 'welcome';
  if (symptomCount > 0) return 'care';
  if (knowledgeCount > 0) return 'learn';
  return 'daily';
}

function fillTemplate(text, vars) {
  return text.replace(/\{(\w+)\}/g, function (m, key) {
    return vars[key] !== undefined ? String(vars[key]) : m;
  });
}

function daysSince(dateStr) {
  if (!dateStr) return 1;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(1, Math.floor(diff / ONE_DAY_MS));
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('AI timeout'));
      }, ms);
    })
  ]);
}

async function generateForPet(pet, aiEnabled) {
  const userId = pet.user_id;
  if (!userId) return { skipped: true };
  const today = cnDateStr();

  // 幂等：先查（唯一索引是最终兜底）
  const exists = await db
    .collection(COLLECTIONS.PET_MOMENTS)
    .where({ user_id: userId, date: today })
    .limit(1)
    .get();
  if (exists.data && exists.data.length > 0) return { skipped: true };

  // 昨日行为（UTC+8 边界）
  const yr = cnYesterdayRange();
  const symptomRes = await db
    .collection(COLLECTIONS.SYMPTOM_RECORDS)
    .where({ user_id: userId, created_at: _.gte(yr.start).lt(yr.end) })
    .limit(1)
    .get();
  const knowledgeCount = await db
    .collection(COLLECTIONS.ANALYTICS_EVENTS)
    .where({
      user_id: userId,
      event_name: 'knowledge_view',
      created_at: _.gte(yr.start).lt(yr.end)
    })
    .count();

  const isFirst =
    (await db.collection(COLLECTIONS.PET_MOMENTS).where({ user_id: userId }).count()).total === 0;

  const templateKey = selectTemplateKey(isFirst, symptomRes.data.length, knowledgeCount.total);
  const tags = pet.personality_tags || [];
  const templateText = templates.pick(templateKey, pet.type, tags);

  const symptomNames = symptomRes.data[0] && symptomRes.data[0].symptom_names;
  const vars = {
    pet_name: pet.name || (pet.type === 'cat' ? '猫咪' : '狗狗'),
    pet_type: pet.type === 'cat' ? '猫咪' : '狗狗',
    symptoms: symptomNames
      ? Array.isArray(symptomNames)
        ? symptomNames.join('、')
        : String(symptomNames)
      : '',
    days: daysSince(pet.created_at)
  };

  let content = fillTemplate(templateText, vars);
  let aiUsed = false;

  // AI 润色（welcome 不调 AI 控成本）
  if (aiEnabled && templateKey !== 'welcome') {
    try {
      const systemPrompt =
        '你是一只' +
        vars.pet_type +
        '，用第一人称写一句100字以内的日记。语气温暖、可爱、自然，不要说"作为一只猫/狗"之类的话，直接输出日记正文。';
      const polished = await withTimeout(
        callDeepSeekAPI(systemPrompt, content, {
          temperature: 0.8,
          maxTokens: 200,
          responseFormat: null
        }),
        DIARY_AI_TIMEOUT_MS
      );
      if (polished && polished.length >= 10 && polished.length <= 200) {
        content = polished;
        aiUsed = true;
      }
    } catch (e) {
      logger.warn('AI 润色失败，用模板: ' + e.message);
    }
  }

  // 敏感词过滤（care 语境豁免癌症/肿瘤）
  content = filterSensitive(content, templateKey);

  // 写入（唯一索引兜底重复）
  try {
    await db.collection(COLLECTIONS.PET_MOMENTS).add({
      data: {
        user_id: userId,
        pet_id: pet._id,
        date: today,
        content: content,
        type: 'diary',
        source: 'auto',
        mood: pickMood(templateKey),
        template_used: templateKey,
        is_first: isFirst,
        diary_cohort: 'treatment',
        ai_used: aiUsed,
        created_at: new Date()
      }
    });
  } catch (e) {
    const msg = (e && e.message) || '';
    if (e.errCode === -502001 || /duplicate|already exists|E11000/i.test(msg)) {
      return { skipped: true };
    }
    throw e;
  }

  // 订阅消息（Phase 1 配额默认 0 直接 return；Phase 3 完善配额机制）
  await trySendDiarySubscribe(userId, content);
  return { ok: true };
}

// Phase 1 stub：配额机制（多触点累加 + 按返回码校准）在 Phase 3 完善
async function trySendDiarySubscribe(userId, content) {
  try {
    const u = await db.collection(COLLECTIONS.USERS).where({ user_id: userId }).limit(1).get();
    if (!u.data || u.data.length === 0) return;
    const quota = u.data[0].diary_subscribe_quota || 0;
    if (quota <= 0) return;
    // TODO Phase 3: cloud.openapi.subscribeMessage.send + 配额 -1 / 失败(43101)归零
  } catch (e) {
    // 静默
  }
}

exports.main = async (event, context) => {
  await warmupConfig(db);
  const rollout = Number(SERVER_CONFIG.DIARY_ROLLOUT_PERCENT || 0);
  const aiEnabled = rollout > 0;

  // 近 14 天活跃用户
  const cutoff = new Date(Date.now() - ACTIVE_DAYS * ONE_DAY_MS);
  const activeUsers = await db
    .collection(COLLECTIONS.USERS)
    .where({ last_active_at: _.gte(cutoff) })
    .field({ user_id: true })
    .limit(2000)
    .get();
  const userIds = activeUsers.data.map((u) => u.user_id).filter(Boolean);
  logger.info('活跃用户数：' + userIds.length + '，rollout=' + rollout);

  if (userIds.length === 0) {
    return { code: 0, data: { ok: 0, skipped: 0, errors: 0, active: 0 } };
  }

  // 拉这些用户的 pets（分页，每页 1000）
  let allPets = [];
  for (let i = 0; i < userIds.length; i += 1000) {
    const chunk = userIds.slice(i, i + 1000);
    const r = await db.collection(COLLECTIONS.PETS).where({ user_id: _.in(chunk) }).limit(1000).get();
    allPets = allPets.concat(r.data);
  }

  let ok = 0;
  let skipped = 0;
  let errors = 0;
  for (let i = 0; i < allPets.length; i += CONCURRENCY) {
    const batch = allPets.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(function (pet) {
        if (!inTreatment(pet.user_id, rollout)) return Promise.resolve({ skipped: true });
        return generateForPet(pet, aiEnabled).catch(function (e) {
          logger.error('生成失败 ' + pet.user_id + ': ' + e.message);
          return { err: true };
        });
      })
    );
    results.forEach(function (r) {
      if (r.ok) ok++;
      else if (r.skipped) skipped++;
      else errors++;
    });
  }

  logger.info('完成 ok=' + ok + ' skipped=' + skipped + ' err=' + errors);
  return { code: 0, data: { ok: ok, skipped: skipped, errors: errors, active: userIds.length } };
};
