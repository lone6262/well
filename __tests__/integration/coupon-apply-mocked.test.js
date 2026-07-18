/**
 * applyCoupon 云函数集成测试（mock wx-server-sdk + DB 链）
 *
 * ⚠️ applyCoupon 在仓库内无任何调用方（createOrder 自带 autoSelectCoupon），
 *    属疑似死代码。本测试仍覆盖其校验链与折扣计算，以便后续若启用即有回归保障。
 *
 * 复用项目既有模式（见 __tests__/unit/db.test.js）：
 *   - Module._load 拦截 wx-server-sdk → mock cloud
 *   - mock db.collection().doc().get()/update() + collection().get()
 *   - CRITICAL：异步用例 async run() + 顶层 await，summary 在 await 之后（防假绿）
 */
const Module = require('module');
const path = require('path');

// ===== 测试框架 =====
let passed = 0,
  failed = 0;
const errors = [];
function assert(condition, message) {
  if (condition) passed++;
  else {
    failed++;
    errors.push(`FAIL: ${message}`);
    console.error(`  ✗ ${message}`);
  }
}
function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else {
    failed++;
    const msg = `${message} - 期望: ${JSON.stringify(expected)}, 实际: ${JSON.stringify(actual)}`;
    errors.push(`FAIL: ${msg}`);
    console.error(`  ✗ ${msg}`);
  }
}

// ===== 可变 mock 状态（每个子用例覆写后调用 main） =====
const FUTURE = '2999-12-31T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';
const state = {
  openid: 'openid_test',
  fixtures: { user_coupons: {}, coupons: {} },
  updates: [], // 记录 update 调用
};

function resetFixtures() {
  state.updates = [];
  state.fixtures = {
    user_coupons: {
      uc1: {
        _id: 'uc1',
        user_id: 'openid_test',
        status: 'unused',
        coupon_id: 'cp1',
        expire_at: FUTURE,
      },
    },
    coupons: {
      cp1: {
        _id: 'cp1',
        is_active: true,
        type: 'points',
        min_amount: 0,
        discount_type: 'percent',
        discount_value: 8,
        name: '8折券',
      },
    },
  };
}

function makeDb() {
  return {
    collection(name) {
      return {
        // warmupConfig: db.collection('system_config').get()
        get: () => Promise.resolve({ data: [] }),
        doc(id) {
          return {
            get: () =>
              Promise.resolve({ data: (state.fixtures[name] && state.fixtures[name][id]) || null }),
            update: ({ data }) => {
              state.updates.push({ coll: name, id, data });
              return Promise.resolve({ stats: { updated: 1 } });
            },
          };
        },
      };
    },
  };
}

const initCalls = [];
const mockCloud = {
  DYNAMIC_CURRENT_ENV: '__DYNAMIC_CURRENT_ENV__',
  init: (cfg) => initCalls.push(cfg),
  database: () => makeDb(),
  getWXContext: () => ({ OPENID: state.openid }),
};

const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return mockCloud;
  return realLoad.apply(this, arguments);
};

const applyCouponPath = path.resolve(__dirname, '../../cloudfunctions/applyCoupon/index.js');
delete require.cache[require.resolve(applyCouponPath)];
const applyCoupon = require(applyCouponPath);

// ===== 异步测试主流程（CRITICAL: 必须 await） =====
async function run() {
  console.log('\n=== 1. 主路径：percent 8折 → 计算并锁定 ===');
  resetFixtures();
  let r = await applyCoupon.main(
    { userCouponId: 'uc1', orderAmount: 1000, orderType: 'points' },
    {}
  );
  assertEqual(r.success, true, '8折主路径 success');
  // 8折: floor(1000*2/10)=200
  assertEqual(r.data.discount, 200, '8折抵扣=200');
  assertEqual(r.data.payAmount, 800, '8折实付=800');
  assertEqual(r.data.couponName, '8折券', '回传券名');
  assertEqual(state.updates.length, 1, '锁定写一次');
  assertEqual(state.updates[0].data.status, 'locked', '状态置 locked');

  console.log('\n=== 2. 主路径：fixed 固定减 ===');
  resetFixtures();
  state.fixtures.coupons.cp1 = Object.assign({}, state.fixtures.coupons.cp1, {
    discount_type: 'fixed',
    discount_value: 500,
  });
  r = await applyCoupon.main({ userCouponId: 'uc1', orderAmount: 1000, orderType: 'points' }, {});
  assertEqual(r.success, true, 'fixed 主路径 success');
  assertEqual(r.data.discount, 500, 'fixed 抵扣=500');
  assertEqual(r.data.payAmount, 500, 'fixed 实付=500');

  console.log('\n=== 3. 失败：参数缺失 ===');
  resetFixtures();
  r = await applyCoupon.main({ userCouponId: 'uc1', orderAmount: 0, orderType: 'points' }, {});
  assertEqual(r.success, false, 'orderAmount 缺失 → 失败');
  r = await applyCoupon.main({ userCouponId: '', orderAmount: 1000, orderType: 'points' }, {});
  assertEqual(r.success, false, 'userCouponId 缺失 → 失败');

  console.log('\n=== 4. 失败：券不存在 ===');
  resetFixtures();
  r = await applyCoupon.main({ userCouponId: 'nope', orderAmount: 1000, orderType: 'points' }, {});
  assertEqual(r.success, false, '券不存在 → 失败');

  console.log('\n=== 5. 失败：非本人券（越权） ===');
  resetFixtures();
  state.fixtures.user_coupons.uc1.user_id = 'openid_OTHER';
  r = await applyCoupon.main({ userCouponId: 'uc1', orderAmount: 1000, orderType: 'points' }, {});
  assertEqual(r.success, false, '他人券 → 失败');

  console.log('\n=== 6. 失败：券已使用（status≠unused） ===');
  resetFixtures();
  state.fixtures.user_coupons.uc1.status = 'used';
  r = await applyCoupon.main({ userCouponId: 'uc1', orderAmount: 1000, orderType: 'points' }, {});
  assertEqual(r.success, false, '已用券 → 失败');

  console.log('\n=== 7. 失败：券已过期 ===');
  resetFixtures();
  state.fixtures.user_coupons.uc1.expire_at = PAST;
  r = await applyCoupon.main({ userCouponId: 'uc1', orderAmount: 1000, orderType: 'points' }, {});
  assertEqual(r.success, false, '过期券 → 失败');

  console.log('\n=== 8. 失败：模板已下架 ===');
  resetFixtures();
  state.fixtures.coupons.cp1.is_active = false;
  r = await applyCoupon.main({ userCouponId: 'uc1', orderAmount: 1000, orderType: 'points' }, {});
  assertEqual(r.success, false, '模板 inactive → 失败');

  console.log('\n=== 9. 失败：适用类型不符 ===');
  resetFixtures();
  // cp1.type='points'，下单 member
  r = await applyCoupon.main({ userCouponId: 'uc1', orderAmount: 1000, orderType: 'member' }, {});
  assertEqual(r.success, false, '类型不符 → 失败');
  // universal 类型应放行
  resetFixtures();
  state.fixtures.coupons.cp1.type = 'universal';
  r = await applyCoupon.main({ userCouponId: 'uc1', orderAmount: 1000, orderType: 'member' }, {});
  assertEqual(r.success, true, 'universal 类型放行');

  console.log('\n=== 10. 失败：未达最低使用金额 ===');
  resetFixtures();
  state.fixtures.coupons.cp1.min_amount = 2000;
  r = await applyCoupon.main({ userCouponId: 'uc1', orderAmount: 1000, orderType: 'points' }, {});
  assertEqual(r.success, false, '未达门槛 → 失败');
}

// ===== 执行 + 摘要（await 后再打印，防假绿） =====
(async () => {
  try {
    await run();
  } catch (e) {
    console.error('\n💥 测试运行异常:', e);
    Module._load = realLoad;
    process.exit(1);
  }
  Module._load = realLoad;

  const total = passed + failed;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`coupon-apply-mocked.test.js: ${passed}/${total} 通过, ${failed} 失败`);
  if (failed > 0) {
    console.error('\n❌ 失败详情:');
    errors.forEach((e) => console.error(`  ${e}`));
    process.exit(1);
  } else {
    console.log('\n✅ 所有测试通过！');
  }
})();
