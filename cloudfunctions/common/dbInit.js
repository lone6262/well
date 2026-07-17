/**
 * 数据库初始化脚本
 * 用于在微信小程序云开发控制台中初始化数据库集合和索引
 *
 * 使用方法：
 * 1. 在微信开发者工具中，创建一个临时云函数
 * 2. 将此代码复制到云函数的index.js中
 * 3. 部署云函数并在云端测试
 * 4. 确认集合创建成功后，可以删除临时云函数
 */

const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 创建数据库集合
 * 注意：微信小程序云开发的集合会在第一次插入数据时自动创建
 * 这里我们通过插入一条临时数据来创建集合，然后删除
 */
async function initCollections() {
  const collections = [
    'users',           // 用户表
    'pets',            // 宠物表
    'symptom_records', // 自查记录表
    'ai_cache',        // AI缓存表
    'orders',          // 订单表
    'hospitals'        // 医院表
  ];

  console.log('开始创建数据库集合...');

  for (let collectionName of collections) {
    try {
      // 尝试创建集合（通过插入临时数据）
      const tempData = {
        _temp: true,
        createdAt: new Date()
      };

      await db.collection(collectionName).add({
        data: tempData
      });

      // 删除临时数据
      const { data } = await db.collection(collectionName).where({
        _temp: true
      }).get();

      if (data.length > 0) {
        await db.collection(collectionName).doc(data[0]._id).remove();
      }

      console.log(`✅ 集合 ${collectionName} 创建成功`);

    } catch (error) {
      if (error.errCode === -1) {
        console.log(`⚠️  集合 ${collectionName} 已存在，跳过创建`);
      } else {
        console.error(`❌ 创建集合 ${collectionName} 失败:`, error);
      }
    }
  }
}

/**
 * 创建数据库索引
 * 注意：索引需要在云开发控制台的数据库界面手动创建
 * 或者使用云函数调用数据库管理API
 */
async function createIndexes() {
  console.log('准备创建数据库索引...');

  // 由于微信小程序云开发限制，索引需要在控制台手动创建
  // 以下是需要在控制台创建的索引列表

  const indexes = [
    {
      collection: 'users',
      indexes: [
        { name: 'openid_index', keys: { openid: 1 }, unique: true }
      ]
    },
    {
      collection: 'pets',
      indexes: [
        { name: 'user_id_index', keys: { user_id: 1 } }
      ]
    },
    {
      collection: 'symptom_records',
      indexes: [
        { name: 'user_id_created_index', keys: { user_id: 1, created_at: -1 } }
      ]
    },
    {
      collection: 'ai_cache',
      indexes: [
        { name: 'symptom_vector_index', keys: { symptom_vector: 1 } },
        { name: 'expire_at_index', keys: { expire_at: 1 } }
      ]
    },
    {
      collection: 'orders',
      indexes: [
        { name: 'user_id_index', keys: { user_id: 1 } },
        { name: 'transaction_id_index', keys: { transaction_id: 1 } }
      ]
    },
    {
      collection: 'point_transactions',
      indexes: [
        // 部分唯一索引：仅 order_id 非空时强制 (order_id, type) 唯一，防同一订单重复发放点数。
        // 控制台建索引时需配 partialFilterExpression: { order_id: { $ne: "" } }
        // （consume/refund 流水 order_id='' 不参与，否则空串互相冲突建不上）
        { name: 'order_type_unique', keys: { order_id: 1, type: 1 }, unique: true }
      ]
    },
    {
      collection: 'hospitals',
      indexes: [
        { name: 'location_index', keys: { location: '2dsphere' } },
        { name: 'is_24h_index', keys: { is_24h: 1 } }
      ]
    }
  ];

  console.log('⚠️  请在云开发控制台手动创建以下索引：');
  indexes.forEach(({ collection, indexes }) => {
    console.log(`\n📁 集合: ${collection}`);
    indexes.forEach(({ name, keys, unique }) => {
      console.log(`   - ${name}: ${JSON.stringify(keys)} ${unique ? '(唯一)' : ''}`);
    });
  });
}

/**
 * 设置数据库权限
 * 所有集合设置为仅云函数可读写
 */
function setupPermissions() {
  console.log('⚠️  请在云开发控制台手动设置数据库权限：');
  console.log('   1. 进入云开发控制台 → 数据库');
  console.log('   2. 对每个集合点击"权限设置"');
  console.log('   3. 选择"仅云函数可读写"或设置安全规则为：');
  console.log('   {');
  console.log('     "read": false,');
  console.log('     "write": false');
  console.log('   }');

  const collections = ['users', 'pets', 'symptom_records', 'ai_cache', 'orders', 'hospitals'];
  collections.forEach(collection => {
    console.log(`   📁 ${collection}`);
  });
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 开始初始化数据库...\n');

    // 1. 创建集合
    await initCollections();

    console.log('\n');

    // 2. 创建索引提示
    await createIndexes();

    console.log('\n');

    // 3. 权限设置提示
    setupPermissions();

    console.log('\n✅ 数据库初始化脚本执行完成！');
    console.log('⚠️  请按照提示在控制台完成索引创建和权限设置。');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
  }
}

// 导出主函数
exports.main = async (event, context) => {
  await main();
  return {
    code: 0,
    msg: '数据库初始化脚本执行完成',
    data: {}
  };
};