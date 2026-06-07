/**
 * 症状评估流程集成测试
 * 模拟 submitSymptom → 风险评估 → 记录创建 的完整调用链
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

// ===== 核心规则引擎 =====
const HIGH_RISK_SYMPTOMS = ['seizure', 'coma', 'dyspnea', 'bleeding', 'hematuria', 'paralysis', 'collapse', 'cyanosis'];
const MID_RISK_KEYWORDS = ['反复', '持续', '加重', '多次', '不断', '频繁', '越来越', '恶化', '未见好转', '超过'];
const SPECIFIC_SYMPTOMS = { VOMIT_GROUP: ['vomit', 'diarrhea', 'fever'], LETHARGY: 'lethargy' };

function evaluateRisk(symptomIds, description) {
  const symptomCount = symptomIds.length;

  const hasHighRisk = symptomIds.some(id => HIGH_RISK_SYMPTOMS.includes(id));
  if (hasHighRisk) {
    return { riskLevel: 'high', action: 'emergency' };
  }

  let isMidRisk = false;
  if (symptomCount >= 3 && symptomIds.some(id => SPECIFIC_SYMPTOMS.VOMIT_GROUP.includes(id))) {
    isMidRisk = true;
  } else if (symptomCount >= 3 && MID_RISK_KEYWORDS.some(kw => (description || '').includes(kw))) {
    isMidRisk = true;
  } else if (symptomCount >= 4) {
    isMidRisk = true;
  } else if (symptomIds.includes(SPECIFIC_SYMPTOMS.LETHARGY) && symptomCount >= 2) {
    isMidRisk = true;
  }

  if (isMidRisk) return { riskLevel: 'mid', action: 'hospital_list' };
  return { riskLevel: 'low', action: 'home' };
}

// ===== Mock 数据库 =====
function createMockDb() {
  const records = [];
  return {
    records,
    collection(name) {
      if (name === 'symptom_records') {
        return {
          add: async (doc) => {
            const record = { _id: 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), ...doc.data };
            records.push(record);
            return { _id: record._id };
          },
          where: () => ({
            orderBy: () => ({
              limit: () => ({ get: async () => ({ data: records }) })
            }),
            get: async () => ({ data: records })
          })
        };
      }
      if (name === 'pets') {
        return {
          where: () => ({
            get: async () => ({ data: [{ _id: 'pet_1', name: '旺财', type: 'dog', age: 36 }] })
          })
        };
      }
      return {
        add: async () => ({ _id: 'mock_' + Date.now() }),
        where: () => ({ get: async () => ({ data: [] }) })
      };
    },
    command: { gte: (d) => ({ $gte: d }) }
  };
}

// ===== 模拟 submitSymptom 云函数逻辑 =====
async function submitSymptomHandler(db, openid, { symptomIds, description, petId }) {
  // 1. 参数验证
  if (!symptomIds || !Array.isArray(symptomIds) || symptomIds.length === 0) {
    return { code: -1, msg: '请至少选择一个症状' };
  }
  if (symptomIds.length > 20) {
    return { code: -1, msg: '症状数量不能超过20个' };
  }
  if (description && description.length > 500) {
    return { code: -1, msg: '描述不能超过500字' };
  }

  // 2. 风险评估
  const risk = evaluateRisk(symptomIds, description);

  // 3. 保存记录
  const recordData = {
    _openid: openid,
    petId: petId || '',
    symptoms: symptomIds,
    description: description || '',
    riskLevel: risk.riskLevel,
    action: risk.action,
    createdAt: new Date()
  };

  let recordId;
  try {
    const addResult = await db.collection('symptom_records').add({ data: recordData });
    recordId = addResult._id;
  } catch (err) {
    return { code: 500, msg: '记录保存失败' };
  }

  return {
    code: 0,
    msg: '评估完成',
    data: {
      recordId,
      riskLevel: risk.riskLevel,
      action: risk.action
    }
  };
}

// ========== 测试套件 ==========

console.log('\n=== 1. 正常流程：提交低风险症状 ===');

async function runTests() {
  let db = createMockDb();
  let result = await submitSymptomHandler(db, 'user_001', {
    symptomIds: ['cough', 'sneeze'],
    description: '狗狗有点咳嗽',
    petId: 'pet_1'
  });

  assertEqual(result.code, 0, '低风险提交 - code=0');
  assertEqual(result.data.riskLevel, 'low', '低风险 - riskLevel=low');
  assertEqual(result.data.action, 'home', '低风险 - action=home');
  assert(typeof result.data.recordId === 'string', '返回 recordId');
  assert(db.records.length === 1, '数据库有1条记录');
  assertEqual(db.records[0].riskLevel, 'low', '数据库记录中 riskLevel=low');

  console.log('\n=== 2. 中风险流程 ===');

  db = createMockDb();
  result = await submitSymptomHandler(db, 'user_001', {
    symptomIds: ['vomit', 'diarrhea', 'lethargy'],
    description: '反复呕吐',
    petId: 'pet_1'
  });

  assertEqual(result.code, 0, '中风险 - code=0');
  assertEqual(result.data.riskLevel, 'mid', '中风险 - riskLevel=mid');
  assertEqual(result.data.action, 'hospital_list', '中风险 - action=hospital_list');
  assert(db.records.length === 1, '记录创建成功');

  console.log('\n=== 3. 高风险流程 ===');

  db = createMockDb();
  result = await submitSymptomHandler(db, 'user_001', {
    symptomIds: ['seizure'],
    description: '狗狗突然抽搐',
    petId: 'pet_1'
  });

  assertEqual(result.code, 0, '高风险 - code=0');
  assertEqual(result.data.riskLevel, 'high', '高风险 - riskLevel=high');
  assertEqual(result.data.action, 'emergency', '高风险 - action=emergency');

  console.log('\n=== 4. 参数验证 ===');

  // 空症状
  result = await submitSymptomHandler(db, 'user_001', { symptomIds: [], description: '', petId: 'pet_1' });
  assertEqual(result.code, -1, '空症状 - code=-1');
  assert(result.msg.includes('至少选择一个'), '空症状 - 提示选择');

  // 无症状字段
  result = await submitSymptomHandler(db, 'user_001', { description: '', petId: 'pet_1' });
  assertEqual(result.code, -1, '无symptomIds字段 - code=-1');

  // null symptoms
  result = await submitSymptomHandler(db, 'user_001', { symptomIds: null, description: '' });
  assertEqual(result.code, -1, 'symptomIds=null - code=-1');

  // 症状过多
  const tooMany = Array.from({ length: 21 }, (_, i) => `symptom_${i}`);
  result = await submitSymptomHandler(db, 'user_001', { symptomIds: tooMany, description: '' });
  assertEqual(result.code, -1, '>20个症状 - code=-1');

  // 描述过长
  result = await submitSymptomHandler(db, 'user_001', {
    symptomIds: ['cough'],
    description: 'x'.repeat(501)
  });
  assertEqual(result.code, -1, '描述>500字 - code=-1');

  console.log('\n=== 5. 用户隔离 ===');

  db = createMockDb();
  await submitSymptomHandler(db, 'user_A', { symptomIds: ['cough'] });
  await submitSymptomHandler(db, 'user_B', { symptomIds: ['vomit', 'diarrhea', 'lethargy'] });

  assert(db.records.length === 2, '两次提交创建2条记录');
  assertEqual(db.records[0]._openid, 'user_A', '记录A归属 user_A');
  assertEqual(db.records[1]._openid, 'user_B', '记录B归属 user_B');
  assert(db.records[0].riskLevel !== db.records[1].riskLevel, '不同症状得到不同风险等级');

  console.log('\n=== 6. 数据完整性 ===');

  db = createMockDb();
  await submitSymptomHandler(db, 'user_001', {
    symptomIds: ['cough', 'sneeze'],
    description: '毛孩子状态良好',
    petId: 'pet_1'
  });

  const record = db.records[0];
  assert(Array.isArray(record.symptoms), 'symptoms 是数组');
  assertEqual(record.symptoms.length, 2, '症状数量=2');
  assertEqual(record.description, '毛孩子状态良好', '描述正确保存');
  assert(record.createdAt instanceof Date, 'createdAt 是 Date');
  assertEqual(record._openid, 'user_001', 'openid 正确');

  console.log('\n=== 7. 无 petId 场景 ===');

  db = createMockDb();
  result = await submitSymptomHandler(db, 'user_001', {
    symptomIds: ['cough'],
    description: ''
    // petId 未提供
  });

  assertEqual(result.code, 0, '无 petId 也能提交 - code=0');
  assertEqual(db.records[0].petId, '', '无 petId 保存为空字符串');

  summary('symptom-flow.test.js');
  console.log('预期: ~19 tests\n');

  if (failed > 0) {
    console.error('\n❌ 失败详情:');
    errors.forEach(e => console.error(`  ${e}`));
    process.exit(1);
  }
}

runTests();
