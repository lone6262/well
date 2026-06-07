/**
 * 宠物管理流程集成测试
 * 模拟 savePet → getPetList → deletePet 完整调用链
 * TDD: RED → GREEN → REFACTOR
 */
const crypto = require('crypto');

// ===== 测试框架 =====
let passed = 0, failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) { passed++; }
  else { failed++; errors.push(`FAIL: ${message}`); console.error(`  ✗ ${message}`); }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { passed++; }
  else {
    failed++;
    const msg = `${message} - 期望: ${JSON.stringify(expected)}, 实际: ${JSON.stringify(actual)}`;
    errors.push(`FAIL: ${msg}`);
    console.error(`  ✗ ${msg}`);
  }
}

function summary(name) {
  const total = passed + failed;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${name}: ${passed}/${total} 通过, ${failed} 失败`);
}

// ===== 辅助函数 =====
function healthStatus(pet) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const hasRecentVaccine = pet.vaccine_date && new Date(pet.vaccine_date) >= thirtyDaysAgo;
  const hasRecentDeworming = pet.deworm_date && new Date(pet.deworm_date) >= thirtyDaysAgo;
  if (hasRecentVaccine && hasRecentDeworming) return 'good';
  return 'warning';
}

// ===== Mock 数据库 =====
function createMockDb() {
  const pets = [];
  return {
    pets,
    collection(name) {
      if (name === 'pets') {
        const self = this;
        return {
          add: async (doc) => {
            const pet = { _id: 'pet_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), ...doc.data };
            self.pets.push(pet);
            return { _id: pet._id };
          },
          where: function(query) {
            const filtered = self.pets.filter(p => p._openid === query._openid);
            return {
              get: async () => ({ data: filtered }),
              orderBy: () => ({ get: async () => ({ data: filtered }) }),
              remove: async () => {
                const before = self.pets.length;
                // 从数组中移除匹配项
                for (let i = self.pets.length - 1; i >= 0; i--) {
                  if (self.pets[i]._openid === query._openid) self.pets.splice(i, 1);
                }
                return { stats: { removed: before - self.pets.length } };
              }
            };
          },
          doc: function(id) {
            const pet = self.pets.find(p => p._id === id);
            return {
              get: async () => ({ data: pet || {} }),
              update: async (updateDoc) => {
                const idx = self.pets.findIndex(p => p._id === id);
                if (idx >= 0) {
                  self.pets[idx] = { ...self.pets[idx], ...updateDoc.data };
                }
                return { stats: { updated: idx >= 0 ? 1 : 0 } };
              },
              remove: async () => {
                const idx = self.pets.findIndex(p => p._id === id);
                if (idx >= 0) { self.pets.splice(idx, 1); return { stats: { removed: 1 } }; }
                return { stats: { removed: 0 } };
              }
            };
          }
        };
      }
      return {
        add: async () => ({ _id: 'mock_' + Date.now() }),
        where: () => ({ get: async () => ({ data: [] }) }),
        doc: () => ({ get: async () => ({ data: {} }), update: async () => ({}), remove: async () => ({}) })
      };
    },
    command: {
      gte: (d) => ({ $gte: d }),
      in: (arr) => ({ $in: arr })
    }
  };
}

// ===== 云函数逻辑 =====

async function savePetHandler(db, openid, petData) {
  // 参数验证
  if (!petData.name || petData.name.trim() === '') {
    return { code: -1, msg: '宠物名称不能为空' };
  }
  if (!petData.type) {
    return { code: -1, msg: '请选择宠物类型' };
  }

  const { petId, ...data } = petData;

  if (petId) {
    // 更新已有宠物
    const existResult = await db.collection('pets').doc(petId).get();
    if (!existResult.data || !existResult.data._id) {
      return { code: 404, msg: '宠物不存在' };
    }
    await db.collection('pets').doc(petId).update({ data });
    return { code: 0, msg: '更新成功', data: { petId } };
  }

  // 新增
  const addResult = await db.collection('pets').add({
    data: { ...data, _openid: openid, createdAt: new Date() }
  });
  return { code: 0, msg: '添加成功', data: { petId: addResult._id } };
}

async function getPetListHandler(db, openid) {
  const result = await db.collection('pets').where({ _openid: openid }).orderBy('createdAt', 'desc').get();

  const petsWithHealth = (result.data || []).map(pet => ({
    ...pet,
    healthStatus: healthStatus(pet)
  }));

  return { code: 0, data: petsWithHealth };
}

async function deletePetHandler(db, openid, petId) {
  if (!petId) {
    return { code: -1, msg: '缺少宠物ID' };
  }

  const existResult = await db.collection('pets').doc(petId).get();
  if (!existResult.data || !existResult.data._id) {
    return { code: 404, msg: '宠物不存在' };
  }

  await db.collection('pets').doc(petId).remove();
  return { code: 0, msg: '删除成功' };
}

// ========== 测试套件 ==========

console.log('\n=== 1. 创建宠物 ===');

async function runTests() {
  let db = createMockDb();

  let result = await savePetHandler(db, 'user_001', {
    name: '旺财',
    type: 'dog',
    breed: '金毛',
    age: 36
  });

  assertEqual(result.code, 0, '创建宠物 - code=0');
  assert(result.data.petId, '创建宠物返回 petId');
  assert(db.pets.length === 1, '数据库有1只宠物');
  assertEqual(db.pets[0].name, '旺财', '名称正确');
  assertEqual(db.pets[0].type, 'dog', '类型正确');
  assertEqual(db.pets[0]._openid, 'user_001', '归属正确');

  console.log('\n=== 2. 创建多只宠物 ===');

  await savePetHandler(db, 'user_001', { name: '小白', type: 'cat', breed: '英短', age: 24 });
  assert(db.pets.length === 2, '数据库有2只宠物');

  // 另一个用户的宠物
  await savePetHandler(db, 'user_002', { name: '阿福', type: 'dog', breed: '柴犬', age: 12 });
  assert(db.pets.length === 3, '数据库有3只宠物');

  console.log('\n=== 3. 获取宠物列表 + 健康状态 ===');

  let list = await getPetListHandler(db, 'user_001');
  assertEqual(list.code, 0, '获取列表 - code=0');
  assert(list.data.length === 2, 'user_001 有2只宠物');
  assert(list.data[0].hasOwnProperty('healthStatus'), '返回数据包含 healthStatus');

  // 给宠物设置近期疫苗和驱虫日期
  const today = new Date().toISOString().split('T')[0];
  await db.collection('pets').doc(db.pets[0]._id).update({
    data: { vaccine_date: today, deworm_date: today }
  });

  list = await getPetListHandler(db, 'user_001');
  // 检查 healthStatus 计算
  const updatedPet = list.data.find(p => p.name === '旺财');
  assert(updatedPet !== undefined, '旺财在列表中');
  assertEqual(updatedPet.healthStatus, 'good', '有疫苗+驱虫 → healthStatus=good');

  console.log('\n=== 4. 更新宠物信息 ===');

  result = await savePetHandler(db, 'user_001', {
    petId: db.pets[0]._id,
    name: '旺财（已绝育）',
    type: 'dog',
    breed: '金毛',
    age: 40
  });

  assertEqual(result.code, 0, '更新宠物 - code=0');
  assertEqual(result.data.petId, db.pets[0]._id, '更新返回原 petId');
  assert(db.pets.length === 3, '更新不新增记录');
  assertEqual(db.pets[0].name, '旺财（已绝育）', '名称已更新');
  assertEqual(db.pets[0].age, 40, '年龄已更新');

  console.log('\n=== 5. 参数验证 ===');

  // 空名称
  result = await savePetHandler(db, 'user_001', { name: '', type: 'dog' });
  assertEqual(result.code, -1, '空名称 - code=-1');
  assert(result.msg.includes('名称'), '空名称提示');

  // 空名称（空格）
  result = await savePetHandler(db, 'user_001', { name: '   ', type: 'dog' });
  assertEqual(result.code, -1, '空格名称 - code=-1');

  // 无类型
  result = await savePetHandler(db, 'user_001', { name: 'test' });
  assertEqual(result.code, -1, '无类型 - code=-1');

  console.log('\n=== 6. 删除宠物 ===');

  const petToDelete = db.pets[2]; // user_002 的阿福
  result = await deletePetHandler(db, 'user_002', petToDelete._id);
  assertEqual(result.code, 0, '删除宠物 - code=0');
  assert(db.pets.length === 2, '删除后剩余2只');

  // 重复删除
  result = await deletePetHandler(db, 'user_002', petToDelete._id);
  assertEqual(result.code, 404, '重复删除 - code=404');

  // 无效 ID
  result = await deletePetHandler(db, 'user_001', '');
  assertEqual(result.code, -1, '空 petId - code=-1');

  console.log('\n=== 7. 用户隔离验证 ===');

  // user_002 不能看到 user_001 的宠物
  list = await getPetListHandler(db, 'user_002');
  assertEqual(list.data.length, 0, 'user_002 删除后无宠物');

  // user_001 仍有2只
  list = await getPetListHandler(db, 'user_001');
  assertEqual(list.data.length, 2, 'user_001 仍有2只');

  console.log('\n=== 8. 完整 CRUD 循环 ===');

  db = createMockDb();
  // Create
  const createResult = await savePetHandler(db, 'user_cycle', { name: '测试宠物', type: 'cat', age: 6 });
  const petId = createResult.data.petId;
  assert(db.pets.length === 1, 'CRUD-C: 创建成功');

  // Read
  const listResult = await getPetListHandler(db, 'user_cycle');
  assertEqual(listResult.data[0].name, '测试宠物', 'CRUD-R: 读取成功');

  // Update
  await savePetHandler(db, 'user_cycle', { petId, name: '更新后名称', type: 'cat', age: 8 });
  assertEqual(db.pets[0].name, '更新后名称', 'CRUD-U: 更新成功');

  // Delete
  const delResult = await deletePetHandler(db, 'user_cycle', petId);
  assertEqual(delResult.code, 0, 'CRUD-D: 删除成功');
  assert(db.pets.length === 0, 'CRUD-D: 数据清空');

  summary('pet-flow.test.js');
  console.log('预期: ~18 tests\n');

  if (failed > 0) {
    console.error('\n❌ 失败详情:');
    errors.forEach(e => console.error(`  ${e}`));
    process.exit(1);
  }
}

runTests();
