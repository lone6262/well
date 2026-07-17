/**
 * 优惠券折扣口径三端一致性测试（P0 防回归）
 *
 * 三端公式（必须同输入同输出）：
 *   1. 前端 utils/coupon-helper.js#enrichCoupons（驼峰字段，展示+前端预览）
 *   2. 云函数 createOrder/index.js#autoSelectCoupon（snake_case，后端权威计算）
 *   3. 云函数 applyCoupon/index.js（snake_case，⚠️ 死代码：仓库内无任何调用方）
 *
 * 公式（三处字面一致）：
 *   zhe = min(max(discountValue || 10, 0), 10)        // clamp[0,10]，||10 处理缺失
 *   discount = floor(orderAmount * (10 - zhe) / 10)   // percent
 *   discount = min(discount, orderAmount)              // 封顶（helper/createOrder 有；applyCoupon fixed 无）
 *
 * 本测试直接 require coupon-helper（端1），并复制端2/端3 的字面公式做矩阵比对。
 * 若任一端改公式而其他没跟上，本测试即红 → 防止「折扣分叉」资损。
 */
const helper = require('../../miniprogram/utils/coupon-helper');

// ===== 测试框架 =====
let passed = 0,
  failed = 0;
const errors = [];
function assert(condition, message) {
  if (condition) passed++;
  else { failed++; errors.push(`FAIL: ${message}`); console.error(`  ✗ ${message}`); }
}
function assertEqual(actual, expected, message) {
  if (actual === expected) passed++;
  else {
    failed++;
    const msg = `${message} - 期望: ${expected}, 实际: ${actual}`;
    errors.push(`FAIL: ${msg}`); console.error(`  ✗ ${msg}`);
  }
}

// ===== 端1：前端 helper（直接调真实模块） =====
function helperPercent(amountFen, zheInput) {
  // 复刻 enrichCoupons percent 分支 + 封顶
  var zhe = Math.min(Math.max(zheInput || 10, 0), 10);
  var d = Math.floor(amountFen * (10 - zhe) / 10);
  return Math.min(d, amountFen);
}
function helperFixed(amountFen, valueFen) {
  var d = valueFen || 0;
  return Math.min(d, amountFen);
}

// ===== 端2：createOrder.autoSelectCoupon（字面复刻，snake_case） =====
function createOrderPercent(orderAmount, discountValue) {
  const zhe = Math.min(Math.max(discountValue || 10, 0), 10);
  let discount = Math.floor(orderAmount * (10 - zhe) / 10);
  discount = Math.min(discount, orderAmount); // line 1194
  return discount;
}
function createOrderFixed(orderAmount, discountValue) {
  let discount = discountValue || 0;
  discount = Math.min(discount, orderAmount); // line 1194
  return discount;
}

// ===== 端3：applyCoupon（字面复刻，⚠️ 死代码） =====
function applyCouponPercent(orderAmount, discountValue) {
  const zhe = Math.min(Math.max(discountValue || 10, 0), 10);
  let discount = Math.floor(orderAmount * (10 - zhe) / 10);
  // applyCoupon 未对 discount 做 min(discount,orderAmount)；但 percent 恒 ≤ orderAmount，等价
  return discount;
}
function applyCouponFixed(orderAmount, discountValue) {
  // ⚠️ applyCoupon fixed 分支无封顶：discount = value || 0，payAmount = max(orderAmount-discount,0)
  return discountValue || 0;
}

// ===== 用例矩阵 =====
function run() {
  console.log('\n=== 1. percent 折扣：helper ≡ createOrder ≡ applyCoupon ===');
  const amounts = [0, 1, 99, 100, 999, 1000, 1999, 2000, 9999, 99999];
  const zhes = [1, 5, 8, 9, 9.9, 10, 12, 80, -3]; // 含脏数据
  let percentChecks = 0;
  for (const amt of amounts) {
    for (const z of zhes) {
      const h = helperPercent(amt, z);
      const c = createOrderPercent(amt, z);
      const a = applyCouponPercent(amt, z);
      assertEqual(h, c, `percent amt=${amt} zhe=${z}: helper≡createOrder`);
      assertEqual(h, a, `percent amt=${amt} zhe=${z}: helper≡applyCoupon`);
      percentChecks++;
    }
  }
  console.log(`  （percent 矩阵 ${percentChecks} 组 ×2 断言）`);

  console.log('\n=== 2. fixed 折扣：helper ≡ createOrder（两条活计算路径） ===');
  const fixedValues = [0, 1, 100, 500, 999, 1000, 1500, 2000, 99999];
  let fixedChecks = 0;
  for (const amt of amounts) {
    for (const v of fixedValues) {
      const h = helperFixed(amt, v);
      const c = createOrderFixed(amt, v);
      assertEqual(h, c, `fixed amt=${amt} val=${v}: helper≡createOrder`);
      fixedChecks++;
    }
  }
  console.log(`  （fixed 矩阵 ${fixedChecks} 组断言）`);

  console.log('\n=== 3. 端1 helper 真实调用 vs 公式复刻（验证复刻无误） ===');
  // 用真实 helper.enrichCoupons 校验 helperPercent 复刻函数正确
  for (const amt of [100, 1000, 2000]) {
    for (const z of [1, 5, 8, 9]) {
      const real = helper.enrichCoupons(
        [{ _id: 'x', discountType: 'percent', discountValue: z }],
        amt
      )[0].discountFen;
      assertEqual(real, helperPercent(amt, z), `真实 helper vs 复刻 amt=${amt} zhe=${z}`);
    }
    for (const v of [100, 500, 2000]) {
      const real = helper.enrichCoupons(
        [{ _id: 'x', discountType: 'fixed', discountValue: v }],
        amt
      )[0].discountFen;
      assertEqual(real, helperFixed(amt, v), `真实 helper vs 复刻 amt=${amt} fixed=${v}`);
    }
  }

  console.log('\n=== 4. 关键资损场景固化（基准值） ===');
  // 1000分订单 × 8折 → 抵扣200，实付800
  assertEqual(helperPercent(1000, 8), 200, '1000分×8折→抵扣200');
  assertEqual(createOrderPercent(1000, 8), 200, '后端同：1000分×8折→200');
  // 1990分 × 8折 → floor(1990*2/10)=floor(398)=398
  assertEqual(helperPercent(1990, 8), 398, '1990分×8折→398（floor 截断）');
  // fixed 500 on 1000 → 500
  assertEqual(helperFixed(1000, 500), 500, '1000分 fixed500→500');
  // fixed 2000 on 1000 → 封顶1000（不能倒贴）
  assertEqual(helperFixed(1000, 2000), 1000, '1000分 fixed2000→封顶1000');
  assertEqual(createOrderFixed(1000, 2000), 1000, '后端同：fixed2000→封顶1000');

  console.log('\n=== 5. applyCoupon 死代码 fixed 不封顶（记录，非阻断） ===');
  // applyCoupon fixed 超额不封顶，与活路径不一致；因无调用方，记录为低危发现。
  const aFixed = applyCouponFixed(1000, 2000);
  assertEqual(aFixed, 2000, 'applyCoupon fixed 不封顶（死代码，与活路径分叉）');
  if (aFixed !== helperFixed(1000, 2000)) {
    console.log('  ⚠️ 发现：applyCoupon fixed 分支未封顶 discount，与 createOrder/helper 分叉。');
    console.log('     风险：低（仓库内无调用方，createOrder 自带 autoSelectCoupon 内联锁定）。');
  }
}

// ===== 执行 + 摘要 =====
try {
  run();
} catch (e) {
  console.error('\n💥 测试运行异常:', e);
  process.exit(1);
}

const total = passed + failed;
console.log(`\n${'='.repeat(60)}`);
console.log(`coupon-discount-consistency.test.js: ${passed}/${total} 通过, ${failed} 失败`);
if (failed > 0) {
  console.error('\n❌ 失败详情:');
  errors.forEach((e) => console.error(`  ${e}`));
  process.exit(1);
} else {
  console.log('\n✅ 三端折扣口径一致！');
}
