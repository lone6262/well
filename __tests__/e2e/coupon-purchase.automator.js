/**
 * 优惠券下单 E2E 自动化骨架（微信小程序 miniprogram-automator）
 *
 * ⚠️ 运行前置（本环境无法满足，故为骨架/手动执行清单）：
 *   1. 安装微信开发者工具 CLI（稳定版，开启「设置→安全→CLI/HTTP 调用」）
 *   2. npm i -D miniprogram-automator
 *   3. project.config.json 指向本仓库 miniprogram 目录
 *   4. 真机/IDE 登录态 + 测试号已领可用券（universal/points/member 各一张）
 *
 * 运行：node __tests__/e2e/coupon-purchase.automator.js
 * （需 MOCK_PAY=true，避免真实扣款；点数/member/report 三条链路各跑一次）
 *
 * 验收点（与单元测试的口径基准对齐）：
 *   - 默认预选最优可用券（折扣最大者）
 *   - 手动选/取消券，实付金额联动正确（percent 8折=实付80%）
 *   - 「不使用」选项 → 实付=原价（couponId 传空）
 *   - 支付成功后 user_coupons 状态变为 used，members/points 到账
 */
const automator = require('miniprogram-automator');

const IDE_PATH = 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'; // 按实际改
const PROJECT = require('path').resolve(__dirname, '../../');

async function main() {
  const ide = await automator.launch({ cliPath: IDE_PATH, project: PROJECT });
  const mp = await ide.connectMiniProgram();

  // ---- 链路1：点数包选券 ----
  await mp.navigateTo('/pages/points/index');
  await mp.waitFor(800);
  const pointsPage = await mp.currentPage();
  // 断言默认预选最优券（折扣最大）
  const data1 = await pointsPage.data();
  console.assert(data1.selectedCouponId, '点数页应预选最优券');
  console.assert(
    parseFloat(data1.finalPriceDisplay) < parseFloat(data1.pack3Display),
    '券后价应<原价'
  );

  // 切到 5 次包 → 重算折扣
  await pointsPage.callMethod('selectPack', { currentTarget: { dataset: { pack: 'PACK_5' } } });
  await mp.waitFor(300);
  // 取消选券 → 实付=原价
  // （实际通过页面元素 tap 触发，此处用 callMethod 验证纯逻辑）
  // ...

  // ---- 链路2：会员订单选券（pages/member/order） ----
  await mp.navigateTo('/pages/member/order');
  await mp.waitFor(800);
  // 同上校验 couponDiscountDisplay / finalPriceDisplay 联动
  // ...

  // ---- 链路3：报告下单选券（pages/order/detail） ----
  // ...

  await ide.close();
  console.log('E2E 完成（骨架，需在微信 IDE 自动化环境实跑）');
}

main().catch((e) => {
  console.error('E2E 异常:', e);
  process.exit(1);
});
