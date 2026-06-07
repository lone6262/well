/**
 * 数据库 Schema 和索引配置
 * dbInit 云函数的子模块
 */

/**
 * 数据库索引配置指引
 * 在微信云开发控制台 -> 数据库 -> 对应集合 -> 索引管理 中手动创建
 */
const INDEX_SPEC = [
  { collection: 'system_config', indexes: [
    { name: 'key_unique', fields: 'key', unique: true }
  ]},
  { collection: 'users', indexes: [
    { name: 'openid_unique', fields: 'openid', unique: true }
  ]},
  { collection: 'pets', indexes: [
    { name: 'user_id', fields: 'user_id (ASC)' },
    { name: 'user_id_petCode_unique', fields: 'user_id (ASC), petCode (ASC)', unique: true }
  ]},
  { collection: 'symptom_records', indexes: [
    { name: 'user_id', fields: 'user_id (ASC)' },
    { name: 'pet_id', fields: 'pet_id (ASC)' },
    { name: 'user_id_created_at', fields: 'user_id (ASC), created_at (DESC)' }
  ]},
  { collection: 'orders', indexes: [
    { name: 'out_trade_no_unique', fields: 'out_trade_no', unique: true },
    { name: 'user_id_created_at', fields: 'user_id (ASC), created_at (DESC)' },
    { name: 'transaction_id_unique', fields: 'transaction_id', unique: true },
    { name: 'status', fields: 'status (ASC)' }
  ]},
  { collection: 'members', indexes: [
    { name: 'user_id_unique', fields: 'user_id', unique: true },
    { name: 'expire_date', fields: 'expire_date (ASC)' },
    { name: 'status', fields: 'status (ASC)' }
  ]},
  { collection: 'ai_cache', indexes: [
    { name: 'symptoms_hash_unique', fields: 'symptoms_hash', unique: true },
    { name: 'expire_at', fields: 'expire_at (ASC)' }
  ]},
  { collection: 'invite_records', indexes: [
    { name: 'inviter_id_created_at', fields: 'inviter_id (ASC), created_at (DESC)' },
    { name: 'invitee_id', fields: 'invitee_id (ASC)' },
    { name: 'invitee_ip_created_at', fields: 'invitee_ip (ASC), created_at (DESC)' }
  ]},
  { collection: 'followup_records', indexes: [
    { name: 'record_id', fields: 'record_id (ASC)' },
    { name: 'user_id_status', fields: 'user_id (ASC), status (ASC)' },
    { name: 'status_created_at', fields: 'status (ASC), created_at (DESC)' }
  ]},
  { collection: 'knowledge_articles', indexes: [
    { name: 'category_sort_order', fields: 'category (ASC), sort_order (ASC)' },
    { name: 'status', fields: 'status (ASC)' }
  ]},
  { collection: 'rate_limits', indexes: [
    { name: 'openid_action_created_at', fields: 'openid (ASC), action (ASC), created_at (DESC)' }
  ]}
];

/**
 * 打印索引配置指引
 */
function printIndexGuide() {
  console.log('\n=== 数据库索引配置指引 ===');
  console.log('NOTE: 以下索引需在微信云开发控制台 -> 数据库 -> 对应集合 -> 索引管理 中手动创建');

  INDEX_SPEC.forEach(function(spec) {
    console.log('\n📋 ' + spec.collection + ':');
    spec.indexes.forEach(function(idx) {
      const tag = idx.unique ? ' [唯一]' : '';
      console.log('  - ' + idx.name + ': ' + idx.fields + tag);
    });
  });

  console.log('\n💡 请在微信云开发控制台手动创建以上索引');
}

/**
 * 初始化集合并添加初始数据
 */
async function initCollectionWithData(db, collectionName, initialData) {
  try {
    console.log('正在初始化集合: ' + collectionName);

    // 检查集合是否存在（不存在时会抛 -502005 错误）
    var collectionExists = true;
    try {
      const { data } = await db.collection(collectionName).limit(1).get();
      if (data.length > 0) {
        console.log('✅ 集合 ' + collectionName + ' 已有数据，跳过初始化');
        return { success: true, message: '集合已存在' };
      }
    } catch (e) {
      // 集合不存在时需要先创建
      if (e.message && e.message.indexOf('DATABASE_COLLECTION_NOT_EXIST') !== -1) {
        console.log('  集合 ' + collectionName + ' 不存在，正在创建...');
        collectionExists = false;
      } else {
        throw e;
      }
    }

    if (initialData.length > 0) {
      console.log('正在添加 ' + initialData.length + ' 条初始数据到 ' + collectionName + '...');
      const addPromises = initialData.map(function(item) {
        return db.collection(collectionName).add({ data: item });
      });
      await Promise.all(addPromises);
      console.log('✅ 集合 ' + collectionName + ' 初始化完成，添加了 ' + initialData.length + ' 条数据');
    } else {
      // 通过 add 一条临时数据来隐式创建集合，随后清理
      await db.collection(collectionName).add({
        data: { _temp: true, createdAt: new Date() }
      });
      const { data: tempData } = await db.collection(collectionName).where({ _temp: true }).get();
      if (tempData.length > 0) {
        await db.collection(collectionName).doc(tempData[0]._id).remove();
      }
      console.log('✅ 集合 ' + collectionName + ' 创建成功（空集合）');
    }

    return { success: true, message: '初始化成功' };
  } catch (error) {
    console.error('❌ 初始化集合 ' + collectionName + ' 失败:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { INDEX_SPEC, printIndexGuide, initCollectionWithData };
