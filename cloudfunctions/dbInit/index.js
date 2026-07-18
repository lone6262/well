/**
 * 数据库完整初始化脚本
 * V1.5 重构版 — 将种子数据和索引配置拆分为独立模块
 *
 * 子模块:
 *   ./schemas.js  — 索引配置 + initCollectionWithData
 *   ./seed-data.js — 初始数据（医院、知识文章、报告模板）
 *
 * 管理员鉴权:
 *   优先从数据库 system_config 读取 ADMIN_SECRET
 *   数据库不可用时（首次初始化）回退到 ./common/secrets.js
 */

const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { RESPONSE_CODE } = require('./common/constants');
const { initCollectionWithData, printIndexGuide } = require('./schemas');
const {
  SAMPLE_PETS,
  INITIAL_HOSPITALS,
  getInitialKnowledgeArticles,
  getInitialReportTemplates,
  getInitialCouponTemplates,
} = require('./seed-data');
const FOOD_SAFETY_SEED = require('./food-safety-seed');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 解析 ADMIN_SECRET：数据库优先，本地 secrets.js 兜底
 * @returns {Promise<string>} 管理员密钥，解析失败返回空字符串
 */
async function resolveAdminSecret() {
  // 1. 优先从数据库 system_config 读取
  try {
    const { data } = await db
      .collection('system_config')
      .where({ key: 'admin_secret' })
      .limit(1)
      .get();
    if (data && data.length > 0 && data[0].value) {
      console.log('[dbInit] ✅ 从数据库 system_config 读取 ADMIN_SECRET');
      return data[0].value;
    }
  } catch (e) {
    // system_config 集合尚不存在（首次初始化），静默回退
    console.log('[dbInit] system_config 不可用，回退到本地 secrets.js');
  }

  // 2. 回退到本地 secrets.js
  try {
    const secrets = require('./common/secrets');
    const secret = secrets.ADMIN_SECRET || '';
    if (secret) {
      console.log('[dbInit] ✅ 从 secrets.js 读取 ADMIN_SECRET');
      return secret;
    }
  } catch (e) {
    console.error('[dbInit] secrets.js 加载失败:', e.message);
  }

  return '';
}

/**
 * 将 ADMIN_SECRET 持久化到 system_config 集合
 * 首次 dbInit 后，后续调用直接从数据库读取，不再依赖 secrets.js
 */
async function persistAdminSecret(secret) {
  try {
    // 检查是否已存在
    const { data } = await db
      .collection('system_config')
      .where({ key: 'admin_secret' })
      .limit(1)
      .get();
    if (data && data.length > 0) {
      console.log('[dbInit] system_config.admin_secret 已存在，跳过写入');
      return;
    }
    await db.collection('system_config').add({
      data: { key: 'admin_secret', value: secret, createdAt: new Date() },
    });
    console.log('[dbInit] ✅ ADMIN_SECRET 已写入 system_config 集合');
  } catch (e) {
    console.warn('[dbInit] ⚠️ ADMIN_SECRET 持久化失败（不影响初始化）:', e.message);
  }
}

/**
 * 构建 system_config 种子数据（全部密钥从 event 参数传入）
 * @param {object} event — 云函数调用参数，包含所有密钥
 */
function buildSystemConfigSeed(event) {
  return [
    { key: 'admin_secret', value: event.adminSecret || '' },
    { key: 'token_secret', value: event.tokenSecret || '' },
    { key: 'tencent_map_key', value: event.tencentMapKey || '' },
    { key: 'deepseek_api_key', value: event.deepseekApiKey || '' },
    { key: 'deepseek_base_url', value: event.deepseekBaseUrl || 'https://api.deepseek.com' },
    { key: 'deepseek_model', value: event.deepseekModel || 'deepseek-chat' },
    // 支付配置：默认 mock_pay=false（真实微信支付，安全默认）；本地测试传 event.mockPay=true 才开模拟
    // 安全：原硬编码 mock_pay=true，首次初始化会让所有订单免单（零收入），故改为安全默认 + 显式开启
    {
      _id: 'wechat_pay_config',
      mock_pay: event.mockPay === true,
      description: '支付配置（mock_pay=true 仅本地测试模拟支付）',
      updated_at: new Date(),
    },
    // Phase 1.5: Feature Flags（命名与开发计划 V5 对齐）
    {
      key: 'feature_flags',
      value: {
        enable_tools: true,
        enable_food_search: true,
        enable_share_card: false,
        enable_group: false,
        enable_promotion: false,
      },
    },
  ];
}

async function main(configSeed) {
  console.log('🚀 开始完整数据库初始化...\n');

  const results = { success: [], failed: [] };

  try {
    // 集合初始化清单: [集合名, 初始数据, 日志标签]
    const collections = [
      ['system_config', configSeed, '含全部密钥配置'],
      ['pets', SAMPLE_PETS, '含示例数据'],
      ['symptom_records', [], ''],
      ['orders', [], ''],
      ['ai_cache', [], ''],
      ['hospitals', INITIAL_HOSPITALS, '含初始数据'],
      ['members', [], ''],
      ['knowledge_articles', getInitialKnowledgeArticles(), '含初始文章'],
      ['invite_records', [], ''],
      ['followup_records', [], ''],
      ['report_templates', getInitialReportTemplates(), '含基础模板'],
      ['rate_limits', [], ''],
      ['audit_logs', [], ''],
      // V1.5 新增集合
      ['user_points', [], 'V1.5 点数余额'],
      ['point_transactions', [], 'V1.5 点数交易流水'],
      ['user_coupons', [], 'V1.5 用户优惠券'],
      ['coupons', getInitialCouponTemplates(), 'V1.5 优惠券模板（含种子数据）'],
      ['refund_records', [], 'V1.5 退款记录'],
      ['member_renew_log', [], 'V1.5 续费日志'],
      ['bill_check_logs', [], 'V1.5 对账差异记录'],
      ['analytics_events', [], 'V1.5 埋点事件'],
      ['error_logs', [], 'V1.5 错误日志'],
      // V2.0 冷启动工具集合
      ['food_safety', FOOD_SAFETY_SEED, '25条食物安全种子数据'],
    ];

    for (const [name, data, label] of collections) {
      const tag = label ? ` (${label})` : '';
      console.log(`=== 初始化 ${name} 集合${tag} ===`);
      const result = await initCollectionWithData(db, name, data);
      if (result.success) {
        results.success.push(name);
      } else {
        results.failed.push({ name: name, error: result.error });
      }
    }

    // 验证 users 集合（由静默登录自动创建）
    console.log('\n=== 验证 users 集合 ===');
    try {
      const { data: usersData } = await db.collection('users').limit(1).get();
      console.log(
        usersData.length > 0 ? '✅ users 集合已有数据' : '⚠️  users 集合为空，但应该已有用户数据'
      );
      results.success.push('users');
    } catch (error) {
      console.log('⚠️  无法验证users集合:', error.message);
    }

    // 输出汇总
    console.log('\n=== 初始化结果汇总 ===');
    console.log(`✅ 成功初始化: ${results.success.length} 个集合`);
    results.success.forEach((name) => {
      console.log(`   ✓ ${name}`);
    });

    if (results.failed.length > 0) {
      console.log(`\n❌ 初始化失败: ${results.failed.length} 个集合`);
      results.failed.forEach((item) => {
        console.log(`   ✗ ${item.name}: ${item.error}`);
      });
    }

    // 数据验证
    console.log('\n=== 数据验证 ===');
    try {
      const verifyList = [
        'hospitals',
        'pets',
        'symptom_records',
        'knowledge_articles',
        'report_templates',
        'system_config',
      ];
      for (const name of verifyList) {
        const count = (await db.collection(name).count()).total;
        console.log(`✅ ${name} 集合记录数: ${count}`);
      }
    } catch (error) {
      console.log('⚠️  数据验证时出错:', error.message);
    }

    // 打印索引配置
    printIndexGuide();

    console.log('\n🎉 数据库初始化完成！');

    return {
      code: RESPONSE_CODE.SUCCESS,
      msg: '数据库初始化完成',
      data: {
        success: results.success,
        failed: results.failed,
        total: results.success.length + results.failed.length,
      },
    };
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    return {
      code: RESPONSE_CODE.SERVER_ERROR,
      msg: '数据库初始化失败',
      data: { results: results },
    };
  }
}

/**
 * 重置模式：清空所有用户数据集合，保留 system_config，再重新初始化种子数据
 */
async function resetAllData(db, configSeed) {
  console.log('🗑️ 开始清空所有数据...\n');

  // 需要清空的集合（用户数据 + 缓存 + 日志）
  const userCollections = [
    'users',
    'pets',
    'symptom_records',
    'ai_cache',
    'orders',
    'members',
    'invite_records',
    'followup_records',
    'rate_limits',
    'audit_logs',
    'hospitals',
    'knowledge_articles',
    'report_templates',
    // V1.5 新增
    'user_points',
    'point_transactions',
    'user_coupons',
    'coupons',
    'refund_records',
    'member_renew_log',
    'bill_check_logs',
    'analytics_events',
    'error_logs',
  ];

  const results = { cleared: [], failed: [] };

  for (const name of userCollections) {
    try {
      // 微信云数据库限制：每次最多删 100 条，需要循环
      let totalRemoved = 0;
      let hasMore = true;
      while (hasMore) {
        const { data } = await db.collection(name).limit(100).get();
        if (data.length === 0) {
          hasMore = false;
          continue;
        }
        const removePromises = data.map(function (doc) {
          return db.collection(name).doc(doc._id).remove();
        });
        await Promise.all(removePromises);
        totalRemoved += data.length;
        if (data.length < 100) {
          hasMore = false;
        }
      }
      console.log('✅ ' + name + ' 已清空（删除 ' + totalRemoved + ' 条）');
      results.cleared.push({ name: name, removed: totalRemoved });
    } catch (e) {
      // 集合不存在时跳过
      if (e.message && e.message.indexOf('DATABASE_COLLECTION_NOT_EXIST') !== -1) {
        console.log('⏭️ ' + name + ' 集合不存在，跳过');
        results.cleared.push({ name: name, removed: 0 });
      } else {
        console.error('❌ 清空 ' + name + ' 失败:', e.message);
        results.failed.push({ name: name, error: e.message });
      }
    }
  }

  // 单独处理 system_config：保留密钥配置，删除其他
  try {
    const { data } = await db.collection('system_config').get();
    const keysToKeep = [
      'admin_secret',
      'token_secret',
      'tencent_map_key',
      'deepseek_api_key',
      'deepseek_base_url',
      'deepseek_model',
    ];
    for (const doc of data) {
      if (!keysToKeep.includes(doc.key)) {
        await db.collection('system_config').doc(doc._id).remove();
      }
    }
    console.log('✅ system_config 已清理（保留密钥配置）');
    results.cleared.push({ name: 'system_config', removed: '保留密钥' });
  } catch (e) {
    console.log('⏭️ system_config 不存在或清理失败');
  }

  console.log('\n🧹 清空完成！开始重新初始化种子数据...\n');

  // 重新初始化
  const initResult = await main(configSeed);

  return {
    code: RESPONSE_CODE.SUCCESS,
    msg: '数据重置完成',
    data: {
      reset: results,
      init: initResult.data,
    },
  };
}

exports.main = async function (event, context) {
  const providedSecret = event && event.adminSecret;

  // 1. 解析 ADMIN_SECRET：数据库优先，首次调用时用 event.adminSecret
  const dbSecret = await resolveAdminSecret();
  const ADMIN_SECRET = dbSecret || providedSecret;

  if (!ADMIN_SECRET) {
    console.error('[dbInit] 无法获取 ADMIN_SECRET（数据库无记录且 event 未提供）');
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '首次调用需传入 adminSecret，后续调用自动从数据库读取',
      data: {},
    };
  }

  // 2. 恒定时间比较鉴权
  const providedBuf = Buffer.from(providedSecret || '');
  const expectedBuf = Buffer.from(ADMIN_SECRET || '');
  const valid =
    providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);
  if (!valid) {
    console.error('[dbInit] adminSecret 验证失败');
    return {
      code: RESPONSE_CODE.ERROR,
      msg: 'Access denied: dbInit requires valid admin authorization',
      data: {},
    };
  }

  // 3. 重置模式需要二次确认（防止误操作清空全库）
  if (event && event.mode === 'reset' && event.confirm !== true) {
    console.error('[dbInit] 重置模式需要二次确认');
    return {
      code: RESPONSE_CODE.ERROR,
      msg: '重置模式需要设置 confirm: true 以二次确认',
      data: {},
    };
  }

  // 4. 构建密钥种子数据（仅首次需要，后续 system_config 已有数据会跳过）
  const configSeed = buildSystemConfigSeed(event);

  // 5. 重置模式：清空所有数据后重新初始化
  if (event && event.mode === 'reset') {
    return await resetAllData(db, configSeed);
  }

  // 6. 正常模式：执行初始化
  return await main(configSeed);
};
