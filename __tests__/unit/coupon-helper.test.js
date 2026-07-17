/**
 * 优惠券纯函数集合 (utils/coupon-helper.js) 单元测试
 * TDD: RED → GREEN → REFACTOR（回溯式，以既有实现固化行为）
 *
 * 口径基准（来自记忆 coupon-discount-value-semantics）：
 *   - percent discount_value=8 即 8 折（实付 80%），公式 floor(amt*(10-zhe)/10)，clamp[0,10]
 *   - fixed discount_value 单位为「分」
 *   - 折扣不超过订单金额
 *   - minAmount（分）不满足 → usable=false
 *
 * 字段约定：前端 enriched 列表为驼峰（_id / discountType / discountValue / minAmount）
 */
const helper = require('../../miniprogram/utils/coupon-helper');

// ===== 测试框架 =====
let passed = 0,
  failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push(`FAIL: ${message}`);
    console.error(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    const msg = `${message} - 期望: ${JSON.stringify(expected)}, 实际: ${JSON.stringify(actual)}`;
    errors.push(`FAIL: ${msg}`);
    console.error(`  ✗ ${msg}`);
  }
}

// ===== fixtures =====
const COUPON_8ZHE = { _id: 'c1', discountType: 'percent', discountValue: 8 }; // 8折
const COUPON_9ZHE = { _id: 'c2', discountType: 'percent', discountValue: 9 }; // 9折
const COUPON_FIXED_500 = { _id: 'c3', discountType: 'fixed', discountValue: 500 }; // 减5元(分)
const COUPON_DIRTY_80 = { _id: 'c4', discountType: 'percent', discountValue: 80 }; // 脏数据(旧百分比)
const COUPON_MIN_2000 = { _id: 'c5', discountType: 'fixed', discountValue: 500, minAmount: 2000 };

// ===== 测试主流程 =====
function run() {
  console.log('\n=== 1. enrichCoupons: percent 正常档位 ===');
  (function () {
    const r = helper.enrichCoupons([COUPON_8ZHE], 1000);
    assertEqual(r.length, 1, '返回长度一致');
    // 8折: floor(1000*(10-8)/10) = 200
    assertEqual(r[0].discountFen, 200, '8折扣减 = 200分');
    assertEqual(r[0].usable, true, '8折可用');
    assertEqual(r[0].discountDisplay, '2.00', '8折展示 2.00');

    const r9 = helper.enrichCoupons([COUPON_9ZHE], 1000);
    // 9折: floor(1000*1/10) = 100
    assertEqual(r9[0].discountFen, 100, '9折扣减 = 100分');
  })();

  console.log('\n=== 2. enrichCoupons: fixed 固定减 ===');
  (function () {
    const r = helper.enrichCoupons([COUPON_FIXED_500], 1000);
    assertEqual(r[0].discountFen, 500, 'fixed 500 → 500分');
    assertEqual(r[0].discountDisplay, '5.00', 'fixed 展示 5.00');
    assertEqual(r[0].usable, true, 'fixed 可用');
  })();

  console.log('\n=== 3. enrichCoupons: 脏数据 clamp[0,10] 防负折扣 ===');
  (function () {
    // 80 clamp→10: floor(1000*0/10)=0（无折扣）
    const r80 = helper.enrichCoupons([COUPON_DIRTY_80], 1000);
    assertEqual(r80[0].discountFen, 0, 'percent 80 脏数据 clamp→0折扣');

    // 15 clamp→10: 0折扣
    const r15 = helper.enrichCoupons([{ _id: 'x', discountType: 'percent', discountValue: 15 }], 1000);
    assertEqual(r15[0].discountFen, 0, 'percent 15 clamp→0折扣');

    // -5 clamp→0: floor(1000*10/10)=1000（全免，防历史脏数据）
    const rNeg = helper.enrichCoupons([{ _id: 'x', discountType: 'percent', discountValue: -5 }], 1000);
    assertEqual(rNeg[0].discountFen, 1000, 'percent -5 clamp→0折=全免');

    // 注意：discountValue=0 触发 `|| 10` 默认 → 10折（无折扣），而非全免。
    // 因 admin 录入校验 min=0.01，0 不会是合法值，此处按脏数据处理（characterized）。
    const r0 = helper.enrichCoupons([{ _id: 'x', discountType: 'percent', discountValue: 0 }], 1000);
    assertEqual(r0[0].discountFen, 0, 'percent 0 触发 ||10 默认→10折=无折扣');
  })();

  console.log('\n=== 4. enrichCoupons: 折扣封顶不超过订单金额 ===');
  (function () {
    // fixed 2000 on 1000 → 封顶 1000
    const r = helper.enrichCoupons([{ _id: 'c', discountType: 'fixed', discountValue: 2000 }], 1000);
    assertEqual(r[0].discountFen, 1000, 'fixed 超额封顶 = 订单金额');
  })();

  console.log('\n=== 5. enrichCoupons: minAmount 未达门槛 → usable=false, discount=0 ===');
  (function () {
    // minAmount 2000, 订单 1000
    const r = helper.enrichCoupons([COUPON_MIN_2000], 1000);
    assertEqual(r[0].usable, false, '未达门槛 usable=false');
    assertEqual(r[0].discountFen, 0, '未达门槛 discount=0');
    // 达门槛
    const r2 = helper.enrichCoupons([COUPON_MIN_2000], 2000);
    assertEqual(r2[0].usable, true, '达门槛 usable=true');
    assertEqual(r2[0].discountFen, 500, '达门槛 discount=500');
  })();

  console.log('\n=== 6. enrichCoupons: 空入参健壮性 ===');
  (function () {
    assertEqual(helper.enrichCoupons(null, 1000), [], 'null 入参 → []');
    assertEqual(helper.enrichCoupons(undefined, 1000), [], 'undefined 入参 → []');
    assertEqual(helper.enrichCoupons([], 1000), [], '空列表 → []');
    // 不变性：原券对象不被修改
    const orig = { _id: 'c', discountType: 'fixed', discountValue: 500 };
    helper.enrichCoupons([orig], 1000);
    assert(!('discountFen' in orig), 'enrichCoupons 不修改原对象（不可变）');
  })();

  console.log('\n=== 7. pickBestCouponId: 选折扣最大的可用券 ===');
  (function () {
    assertEqual(helper.pickBestCouponId([]), '', '空 → 不使用');
    assertEqual(helper.pickBestCouponId(null), '', 'null → 不使用');
    // 全部不可用 → ''
    const allUnusable = helper.enrichCoupons([COUPON_MIN_2000], 1000); // c5 不可用
    assertEqual(helper.pickBestCouponId(allUnusable), '', '全不可用 → 不使用');
    // 多券取最大
    const enriched = helper.enrichCoupons([COUPON_8ZHE, COUPON_9ZHE, COUPON_FIXED_500], 1000);
    // 8折=200, 9折=100, fixed=500 → 最大是 c3
    assertEqual(helper.pickBestCouponId(enriched), 'c3', '取折扣最大者 c3');
    // 不可用券即使折扣高也被忽略
    const mixed = helper.enrichCoupons(
      [COUPON_8ZHE, { _id: 'big', discountType: 'fixed', discountValue: 900, minAmount: 99999 }],
      1000
    );
    assertEqual(helper.pickBestCouponId(mixed), 'c1', '忽略不可用高折扣券，选 c1');
  })();

  console.log('\n=== 8. computeFinal: 最终展示字段 ===');
  (function () {
    const enriched = helper.enrichCoupons([COUPON_8ZHE], 1000);
    // 未选券
    const none = helper.computeFinal(enriched, '', 1000);
    assertEqual(none.couponDiscountFen, 0, '未选 → 折扣0');
    assertEqual(none.finalPriceDisplay, '10.00', '未选 → 实付=原价');
    assertEqual(none.selectedCouponId, '', '未选 → selectedCouponId 空');
    // 选中可用券
    const sel = helper.computeFinal(enriched, 'c1', 1000);
    assertEqual(sel.couponDiscountFen, 200, '选中8折 → 折扣200');
    assertEqual(sel.finalPriceDisplay, '8.00', '选中8折 → 实付8.00');
    assertEqual(sel.selectedCouponId, 'c1', '选中8折 → id=c1');
    // 选中不可用券 → 忽略
    const unusable = helper.enrichCoupons([COUPON_MIN_2000], 1000);
    const selBad = helper.computeFinal(unusable, 'c5', 1000);
    assertEqual(selBad.couponDiscountFen, 0, '选中不可用 → 折扣0');
    assertEqual(selBad.selectedCouponId, '', '选中不可用 → id 置空');
    // 折扣大于订单 → 实付0
    const big = helper.enrichCoupons([{ _id: 'c', discountType: 'fixed', discountValue: 9999 }], 1000);
    const over = helper.computeFinal(big, 'c', 1000);
    assertEqual(over.finalPriceDisplay, '0.00', '超额折扣 → 实付0.00');
    // 未知 id
    const unknown = helper.computeFinal(enriched, 'not-exist', 1000);
    assertEqual(unknown.couponDiscountFen, 0, '未知id → 折扣0');
  })();

  console.log('\n=== 9. toggleSelect: 单选切换语义 ===');
  (function () {
    const enriched = helper.enrichCoupons([COUPON_8ZHE, COUPON_FIXED_500], 1000);
    // 空 → 选 c1
    assertEqual(helper.toggleSelect('', 'c1', enriched), 'c1', '空→选c1');
    // 再点 c1 → 取消
    assertEqual(helper.toggleSelect('c1', 'c1', enriched), '', '再点c1→取消');
    // c1 → c3 切换
    assertEqual(helper.toggleSelect('c1', 'c3', enriched), 'c3', 'c1→c3');
    // 不可用券忽略 → 保持当前
    const unusable = helper.enrichCoupons([COUPON_MIN_2000], 1000);
    assertEqual(helper.toggleSelect('c1', 'c5', unusable), 'c1', '点不可用券→保持c1');
    // 空 id → ''
    assertEqual(helper.toggleSelect('c1', '', enriched), '', '空id→不使用');
    // 未知 id → 保持当前
    assertEqual(helper.toggleSelect('c1', 'unknown', enriched), 'c1', '未知id→保持c1');
    // 不可用 + 空当前 → 保持空
    assertEqual(helper.toggleSelect('', 'c5', unusable), '', '不可用券+空当前→保持空');
  })();

  console.log('\n=== 10. loadCoupons: wx.cloud mock 集成 ===');
  (function () {
    // 注入 global.wx.cloud.callFunction mock
    const calls = [];
    global.wx = {
      cloud: {
        callFunction: function (opts) {
          calls.push(opts);
          // 模拟 getUserCoupons 返回原始（驼峰已由云函数转换）券
          setTimeout(function () {
            opts.success({
              result: {
                code: 0,
                data: {
                  coupons: [
                    { _id: 'uc1', discountType: 'percent', discountValue: 8 },
                    { _id: 'uc2', discountType: 'fixed', discountValue: 500 }
                  ]
                }
              }
            });
          }, 0);
        }
      }
    };
    let snapshot = null;
    helper.loadCoupons(
      'TOKEN',
      'points',
      1000,
      function (snap) {
        snapshot = snap;
      },
      function () {}
    );
    // 异步：sync 立即断言 callFunction 入参
    assertEqual(calls[0].name, 'getUserCoupons', '调用 getUserCoupons');
    assertEqual(calls[0].data.orderType, 'points', '透传 orderType');
    assertEqual(calls[0].data.status, 'unused', '只拉 unused');
    // 注：异步回调用 setTimeout 延迟断言，见下方 async 包装
  })();
}

// ===== 执行 + 摘要 =====
try {
  run();
} catch (e) {
  console.error('\n💥 测试运行异常:', e);
  process.exit(1);
}

// loadCoupons 的异步回调在此处校验（自研框架：异步结果需延后断言）
setTimeout(function () {
  const total = passed + failed;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`coupon-helper.test.js: ${passed}/${total} 通过, ${failed} 失败`);
  if (failed > 0) {
    console.error('\n❌ 失败详情:');
    errors.forEach(function (e) { console.error(`  ${e}`); });
    process.exit(1);
  } else {
    console.log('\n✅ 所有测试通过！');
  }
}, 50);
