/**
 * 数据库完整初始化脚本 - 修复版
 * 解决集合为空的问题，添加初始数据
 */

const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 创建集合并添加初始数据
 */
async function initCollectionWithData(collectionName, initialData = []) {
  try {
    console.log(`正在初始化集合: ${collectionName}`);

    // 检查集合是否已有数据
    const { data } = await db.collection(collectionName).limit(1).get();

    if (data.length > 0) {
      console.log(`✅ 集合 ${collectionName} 已有数据，跳过初始化`);
      return { success: true, message: '集合已存在' };
    }

    // 如果有初始数据，添加初始数据
    if (initialData.length > 0) {
      console.log(`正在添加 ${initialData.length} 条初始数据到 ${collectionName}...`);

      const addPromises = initialData.map(item =>
        db.collection(collectionName).add({ data: item })
      );

      await Promise.all(addPromises);
      console.log(`✅ 集合 ${collectionName} 初始化完成，添加了 ${initialData.length} 条数据`);

    } else {
      // 没有初始数据，创建空集合（添加一条临时数据然后删除）
      await db.collection(collectionName).add({
        data: { _temp: true, createdAt: new Date() }
      });

      // 删除临时数据
      const { data: tempData } = await db.collection(collectionName).where({ _temp: true }).get();
      if (tempData.length > 0) {
        await db.collection(collectionName).doc(tempData[0]._id).remove();
      }

      console.log(`✅ 集合 ${collectionName} 创建成功（空集合）`);
    }

    return { success: true, message: '初始化成功' };

  } catch (error) {
    console.error(`❌ 初始化集合 ${collectionName} 失败:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * 初始医院数据
 */
const INITIAL_HOSPITALS = [
  {
    name: "爱心宠物医院",
    address: "北京市朝阳区望京街道阜通东大街6号",
    phone: "010-64781234",
    location: { latitude: 39.996259, longitude: 116.480936 },
    is_24h: true,
    services: ["急诊", "疫苗接种", "体检", "手术"],
    rating: 4.8,
    created_at: new Date()
  },
  {
    name: "宠物中心医院",
    address: "北京市海淀区中关村大街27号",
    phone: "010-62567890",
    location: { latitude: 39.982259, longitude: 116.317896 },
    is_24h: true,
    services: ["急诊", "住院", "手术", "实验室检查"],
    rating: 4.9,
    created_at: new Date()
  },
  {
    name: "萌宠宠物诊所",
    address: "北京市丰台区方庄芳古园一区8号",
    phone: "010-67681234",
    location: { latitude: 39.872259, longitude: 116.437896 },
    is_24h: false,
    services: ["疫苗接种", "体检", "洗澡美容"],
    rating: 4.6,
    created_at: new Date()
  },
  {
    name: "北京宠物医院",
    address: "北京市东城区建国门内大街8号",
    phone: "010-65281234",
    location: { latitude: 39.912259, longitude: 116.417896 },
    is_24h: true,
    services: ["急诊", "手术", "住院", "专家门诊"],
    rating: 4.7,
    created_at: new Date()
  },
  {
    name: "和谐宠物医院",
    address: "北京市西城区西单北大街120号",
    phone: "010-66081234",
    location: { latitude: 39.912259, longitude: 116.377896 },
    is_24h: false,
    services: ["疫苗接种", "体检", "营养咨询"],
    rating: 4.5,
    created_at: new Date()
  }
];

/**
 * 主初始化函数
 */
async function main() {
  console.log('🚀 开始完整数据库初始化...\n');

  const results = {
    success: [],
    failed: []
  };

  try {
    // 1. 初始化pets集合（添加示例数据）
    console.log('=== 初始化 pets 集合（含示例数据）===');
    const samplePets = [
      {
        user_id: 'sample_user_1',
        name: '小白',
        type: 'cat',
        breed: '英国短毛猫',
        age: 2,
        weight: 4.5,
        gender: 'male',
        vaccine_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15天前
        deworm_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10天前
        created_at: new Date()
      },
      {
        user_id: 'sample_user_1',
        name: '大黄',
        type: 'dog',
        breed: '金毛寻回犬',
        age: 3,
        weight: 28.0,
        gender: 'male',
        vaccine_date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), // 40天前
        deworm_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5天前
        created_at: new Date()
      }
    ];

    const petsResult = await initCollectionWithData('pets', samplePets);
    if (petsResult.success) {
      results.success.push('pets');
    } else {
      results.failed.push({ name: 'pets', error: petsResult.error });
    }

    // 2. 初始化symptom_records集合（空）
    console.log('\n=== 初始化 symptom_records 集合 ===');
    const symptomRecordsResult = await initCollectionWithData('symptom_records', []);
    if (symptomRecordsResult.success) {
      results.success.push('symptom_records');
    } else {
      results.failed.push({ name: 'symptom_records', error: symptomRecordsResult.error });
    }

    // 3. 初始化orders集合（空）
    console.log('\n=== 初始化 orders 集合 ===');
    const ordersResult = await initCollectionWithData('orders', []);
    if (ordersResult.success) {
      results.success.push('orders');
    } else {
      results.failed.push({ name: 'orders', error: ordersResult.error });
    }

    // 4. 初始化ai_cache集合（空）
    console.log('\n=== 初始化 ai_cache 集合 ===');
    const aiCacheResult = await initCollectionWithData('ai_cache', []);
    if (aiCacheResult.success) {
      results.success.push('ai_cache');
    } else {
      results.failed.push({ name: 'ai_cache', error: aiCacheResult.error });
    }

    // 5. 初始化hospitals集合（添加初始数据）
    console.log('\n=== 初始化 hospitals 集合（含初始数据）===');
    const hospitalsResult = await initCollectionWithData('hospitals', INITIAL_HOSPITALS);
    if (hospitalsResult.success) {
      results.success.push('hospitals');
    } else {
      results.failed.push({ name: 'hospitals', error: hospitalsResult.error });
    }

    // 6. 验证users集合
    console.log('\n=== 验证 users 集合 ===');
    try {
      const { data: usersData } = await db.collection('users').limit(1).get();
      if (usersData.length > 0) {
        console.log('✅ users 集合已有数据');
        results.success.push('users');
      } else {
        console.log('⚠️  users 集合为空，但应该已有用户数据');
      }
    } catch (error) {
      console.log('⚠️  无法验证users集合:', error.message);
    }

    // 输出结果汇总
    console.log('\n=== 初始化结果汇总 ===');
    console.log(`✅ 成功初始化: ${results.success.length} 个集合`);
    results.success.forEach(name => console.log(`   ✓ ${name}`));

    if (results.failed.length > 0) {
      console.log(`\n❌ 初始化失败: ${results.failed.length} 个集合`);
      results.failed.forEach(({ name, error }) => {
        console.log(`   ✗ ${name}: ${error}`);
      });
    }

    // 验证数据
    console.log('\n=== 数据验证 ===');
    try {
      const hospitalsCount = (await db.collection('hospitals').count()).total;
      console.log(`✅ hospitals 集合记录数: ${hospitalsCount}`);

      const petsCount = (await db.collection('pets').count()).total;
      console.log(`✅ pets 集合记录数: ${petsCount}`);

      const symptomRecordsCount = (await db.collection('symptom_records').count()).total;
      console.log(`✅ symptom_records 集合记录数: ${symptomRecordsCount}`);

    } catch (error) {
      console.log('⚠️  数据验证时出错:', error.message);
    }

    console.log('\n🎉 数据库初始化完成！');

    return {
      code: 0,
      msg: '数据库初始化完成',
      data: {
        success: results.success,
        failed: results.failed,
        total: results.success.length + results.failed.length
      }
    };

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    return {
      code: -1,
      msg: '数据库初始化失败',
      data: {
        error: error.message,
        results: results
      }
    };
  }
}

// 导出主函数
exports.main = async (event, context) => {
  return await main();
};