// 寰俊鏀粯鍥炶皟浜戝嚱鏁?鈥?鐢熶骇绾у疄鐜?
// ==========================================
// 鏈簯鍑芥暟浣滀负寰俊鏀粯缁熶竴鍥炶皟鍏ュ彛锛屽鐞嗘墍鏈夋敮浠樼粨鏋滅殑鍚庣画涓氬姟銆?
//
// 鍔熻兘锛?
//   1. 骞傜瓑鏍￠獙锛堝悓涓€璁㈠崟澶氭鍥炶皟鍙鐞嗕竴娆★級
//   2. 閲戦涓€鑷存€ф牎楠?
//   3. 鎸夎鍗曠被鍨嬪垎鍙戝悗缁鐞嗭細
//      - report 鈫?鏇存柊璁㈠崟鐘舵€?
//      - member / member_* 鈫?婵€娲讳細鍛?
//      - points 鈫?鐐规暟鍒拌处
//      - bundle 鈫?鎷嗗崟澶勭悊
//   5. 鏀粯鎴愬姛璁㈤槄娑堟伅閫氱煡
//   6. 浼樻儬鍒告爣璁板凡浣跨敤
//
// 寰俊鍥炶皟鏂囨。: https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pages/index.shtml
// ==========================================

const cloud = require('wx-server-sdk');
const crypto = require('crypto'); // F1: 缃戝叧 HMAC 绛惧悕楠岃瘉
const {
  COLLECTIONS,
  ORDER_STATUS,
  ORDER_TYPES,
  PRICES,
  POINTS_PACKS,
  MEMBER_CREDITS,
  MEMBER_STATUS,
  MEMBER_DURATION,
  MEMBER_LIMITS,
  warmupConfig,
  loadPrices
} = require('./common/constants');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 妯″潡绾у眬閮ㄥ壇鏈?鈥?鐢?loadPrices 鍦ㄥ叆鍙ｅ～鍏咃紝閬垮厤鐩存帴姹℃煋妯″潡绾?MEMBER_CREDITS 甯搁噺
let dbCredits = MEMBER_CREDITS;

// ============================================
// 鐜閰嶇疆锛堝晢鎴峰彿鍒颁綅鍚庢敼涓?false锛?
// ============================================
const GATEWAY_SECRET = process.env.CALLBACK_GATEWAY_SECRET; // F1: 缃戝叧鍥炶皟绛惧悕瀵嗛挜锛屾湭閰嶇疆鏃跺洖閫€鍒板瓧娈垫牎楠?

// ============================================
// 浜戝嚱鏁板叆鍙?
// ============================================

/**
 * 浠庢暟鎹簱璇诲彇 MOCK_PAY 閰嶇疆锛堜笌 createOrder 淇濇寔涓€鑷达級鈥斺€?F3
 * DB 璇诲彇澶辫触鏃跺洖閫€鍒扮幆澧冨彉閲忥紙鍚戝悗鍏煎锛?
 * @param {object} db - cloud.database() 瀹炰緥
 * @returns {Promise<boolean>}
 */
async function loadMockPayConfig(db) {
  try {
    const result = await db.collection('system_config').doc('wechat_pay_config').get();
   if (result.data) {
     return result.data.mock_pay !== undefined ? result.data.mock_pay : process.env.MOCK_PAY === 'true';
   }
   return process.env.MOCK_PAY === 'true';
  } catch (e) {
    // DB 璇诲彇澶辫触鏃讹紝鍥為€€鍒扮幆澧冨彉閲忥紙鍚戝悗鍏煎锛?
    console.warn('[payCallback] MOCK_PAY DB 璇诲彇澶辫触锛屽洖閫€鐜鍙橀噺:', e.message);
    return process.env.MOCK_PAY === 'true';
  }
}

exports.main = async (event, context) => {
  await warmupConfig(db);
  // V2.0: 浠锋牸浠?DB 鍔ㄦ€佸姞杞斤紙浣跨敤灞€閮ㄥ壇鏈紝涓嶆薄鏌撴ā鍧楃骇鍏ㄥ眬甯搁噺锛岄伩鍏嶅疄渚嬪鐢ㄧ疮绉級
  const priceConfig = await loadPrices(db);
  dbCredits = priceConfig.memberCredits;

  // F3: MOCK_PAY 閰嶇疆婧愮粺涓€涓?DB锛堜笌 createOrder 涓€鑷达級锛孌B 璇诲彇澶辫触鍥為€€鐜鍙橀噺
  const MOCK_PAY = await loadMockPayConfig(db);

  // 鍘熷鍥炶皟浜嬩欢鏃ュ織锛氱敤浜庢牳瀵归泦鎴愮綉鍏宠浆鍙戝悗鐨勫瓧娈靛悕锛堥涓湡瀹炲洖璋冨姟蹇呮煡鐪嬶級
  console.log('[payCallback] raw event:', JSON.stringify(event));

  // 鍦?try 涔嬪墠鎻愬彇璁㈠崟鍙凤紝渚夸簬缃戝叧绛惧悕楠岃瘉涓?catch 寮傚父琛ュ伩寮曠敤
  const out_trade_no = event.out_trade_no;

  try {
    // ========================================
    // 1. 缃戝叧韬唤楠岃瘉锛團1锛氶槻姝㈠鎴风浼€犳敮浠樺洖璋冿級
    //    - 閰嶇疆浜?CALLBACK_GATEWAY_SECRET锛氱敤 HMAC-SHA256 楠岃瘉缃戝叧绛惧悕
    //    - 鏈厤缃紙鍚戝悗鍏煎锛夛細鑷冲皯鏍￠獙寰俊鍥炶皟鐗规湁瀛楁锛坱ransaction_id 鎴?out_trade_no 鏍煎紡锛?
    // ========================================
    if (GATEWAY_SECRET) {
      const expectedSig = crypto.createHmac('sha256', GATEWAY_SECRET)
        .update((event.out_trade_no || '') + (event.transaction_id || ''))
        .digest('hex');
      if (event.gateway_signature !== expectedSig) {
        console.error('[payCallback] 闈炴硶鍥炶皟鏉ユ簮锛氱綉鍏崇鍚嶆牎楠屽け璐?);
        return wechatResponse('FAIL', '闈炴硶鍥炶皟鏉ユ簮');
      }
    } else {
      // 鏈厤缃綉鍏冲瘑閽ワ紙鍚戝悗鍏煎锛夛細鑷冲皯鏍￠獙鍥炶皟鎼哄甫寰俊鏀粯鐗规湁瀛楁
      const hasTransactionId = !!event.transaction_id;
      const validOrderNo = !!(event.out_trade_no && /^[A-Za-z0-9_-]{6,64}$/.test(event.out_trade_no));
      if (!hasTransactionId && !validOrderNo) {
        console.error('[payCallback] 闈炴硶鍥炶皟鏉ユ簮锛氱己灏戝井淇℃敮浠樻爣璇嗗瓧娈?);
        return wechatResponse('FAIL', '闈炴硶鍥炶皟鏉ユ簮');
      }
    }

    // ========================================
    // 2. 鎻愬彇鍥炶皟鏁版嵁
    // 闆嗘垚涓績缃戝叧杞彂鐨勬槑鏂囧吋瀹逛袱绉嶅舰鎬侊細
    //   V2: { out_trade_no, transaction_id, total_fee, result_code }
    //   V3: { out_trade_no, transaction_id, amount:{total}, trade_state }
    // 棣栦釜鐪熷疄鍥炶皟鍔″繀鐪?raw event 鏃ュ織鏍稿瀹為檯瀛楁銆?
    // ========================================
    const {
      transaction_id,
      total_fee,
      result_code,
      trade_state,
      amount: wxAmount
    } = event;

    // 缁熶竴閲戦瀛楁锛氫紭鍏?V2 total_fee锛屽洖閫€ V3 amount.total
    const paidAmount = (total_fee !== undefined)
      ? Number(total_fee)
      : (wxAmount && wxAmount.total !== undefined ? Number(wxAmount.total) : undefined);

    // 缁熶竴鏀粯缁撴灉锛歏3 SUCCESS 鎴栫綉鍏充粎杞彂鎴愬姛鍥炶皟鏃跺潎瑙嗕负鎴愬姛
    const payFailed = (result_code && result_code !== 'SUCCESS') ||
      (trade_state && !['SUCCESS', 'REFUND'].includes(trade_state));

    // 鏀粯澶辫触鍥炶皟锛堢敤鎴峰彇娑堟垨鏀粯閿欒锛?
    if (payFailed) {
      console.warn('[payCallback] 鏀粯鏈垚鍔?', out_trade_no, result_code || trade_state);
      await handlePaymentFailed(out_trade_no);
      return wechatResponse('OK');
    }

    if (!out_trade_no) {
      console.error('[payCallback] 鍥炶皟缂哄皯 out_trade_no');
      return wechatResponse('FAIL', '缂哄皯鍟嗘埛璁㈠崟鍙?);
    }

    console.log('[payCallback] 鏀跺埌鏀粯鍥炶皟:', out_trade_no, transaction_id);

    // ========================================
    // 3. 鏌ヨ璁㈠崟
    // ========================================
    const orderResult = await db.collection(COLLECTIONS.ORDERS)
      .where({ out_trade_no })
      .limit(1)
      .get();

    if (!orderResult.data || orderResult.data.length === 0) {
      console.error('[payCallback] 璁㈠崟涓嶅瓨鍦?', out_trade_no);
      return wechatResponse('FAIL', '璁㈠崟涓嶅瓨鍦?);
    }

    const order = orderResult.data[0];

   // ========================================
   // 4. 骞傜瓑鏍￠獙锛氬凡鏀粯璁㈠崟鐩存帴杩斿洖鎴愬姛
   // ========================================
   if (order.status === ORDER_STATUS.PAID) {
     // mock_pay 妯″紡涓嬭鍗曞湪 createOrder 涓洿鎺ユ爣璁?PAID锛屼絾 dispatchPostPayment 灏氭湭鎵ц銆?
     // 濡傛灉 dispatch_status 涓嶆槸 completed锛岃鏄庝笟鍔″垎鍙戞湭瀹屾垚锛岄渶瑕佺户缁鐞嗐€?
     if (order.dispatch_status === 'completed') {
       console.log('[payCallback] 骞傜瓑锛氳鍗曞凡鏀粯涓斿凡鍒嗗彂锛岃烦杩囧鐞?', out_trade_no);
       return wechatResponse('OK');
     }
     console.log('[payCallback] 璁㈠崟宸叉敮浠樹絾鏈垎鍙戯紝缁х画鎵ц涓氬姟鍒嗗彂:', out_trade_no, 'dispatch_status:', order.dispatch_status);
     // 鐩存帴璺冲埌涓氬姟鍒嗗彂锛堣烦杩囩姸鎬佹洿鏂版楠わ紝鍥犱负宸茬粡鏄?PAID锛?
     await dispatchPostPayment(order, transaction_id);
     try {
       await cloud.callFunction({
         name: 'trackEvent',
         data: { eventName: 'pay_success', properties: { order_id: order._id, order_type: order.type, amount: order.amount } }
       });
     } catch (trackErr) { console.warn('[payCallback] 鍩嬬偣璁板綍璺宠繃:', trackErr.message); }
     await sendPaymentNotify(order);
     console.log('[payCallback] 琛ュ厖鍒嗗彂澶勭悊瀹屾垚:', out_trade_no, 'type:', order.type);
     return wechatResponse('OK');
   }

    // 宸插叧闂?宸查€€娆剧殑璁㈠崟鏀跺埌鍥炶皟 鈫?寮傚父锛岃褰曞樊寮?
    if (order.status === ORDER_STATUS.CLOSED ||
        order.status === ORDER_STATUS.REFUNDED ||
        order.status === ORDER_STATUS.REFUND_REQUESTED) {
      console.error('[payCallback] 璁㈠崟鐘舵€佸紓甯?', out_trade_no,
        'local_status:', order.status, 'wx_result:', result_code);
      await recordBillDifference(order, {
        wx_transaction_id: transaction_id,
        wx_status: 'SUCCESS',
        local_status: order.status,
        diff_type: 'status_conflict'
      });
      return wechatResponse('FAIL', '璁㈠崟鐘舵€佸紓甯?);
    }

    // ========================================
    // 5. 閲戦涓€鑷存€ф牎楠岋紙鍏煎 V2 total_fee / V3 amount.total锛?
    // ========================================
    if (!MOCK_PAY) {
      // F2: 鐪熷疄鏀粯妯″紡涓嬮噾棰濆繀椤诲瓨鍦ㄤ笖涓€鑷达紝缂哄け鍗虫嫆缁濓紙闃叉缁曡繃閲戦鏍￠獙锛?
      if (paidAmount === undefined || isNaN(paidAmount)) {
        console.error('[payCallback] 鍥炶皟缂哄皯閲戦瀛楁锛屾嫆缁濆鐞?', out_trade_no);
        await recordBillDifference(order, {
          wx_transaction_id: transaction_id,
          wx_amount: null,
          local_amount: order.amount || order.pay_amount || 0,
          diff_type: 'amount_missing'
        });
        return wechatResponse('FAIL', '閲戦鏍￠獙澶辫触');
      }
      const orderAmount = order.amount || order.pay_amount || 0;
      if (Number(paidAmount) !== Number(orderAmount)) {
        console.error('[payCallback] 閲戦涓嶄竴鑷?',
          'wx_amount:', paidAmount,
          'order_amount:', orderAmount,
          'out_trade_no:', out_trade_no);
        await recordBillDifference(order, {
          wx_transaction_id: transaction_id,
          wx_amount: paidAmount,
          local_amount: orderAmount,
          diff_type: 'amount_mismatch'
        });
        // 閲戦涓嶄竴鑷存殏涓嶈嚜鍔ㄤ慨澶嶏紝浜哄伐浠嬪叆
        return wechatResponse('FAIL', '閲戦鏍￠獙澶辫触');
      }
    }

    // ========================================
    // S4 淇锛歵ransaction_id 鍞竴鎬ф牎楠岋紙闃叉鍚屼竴寰俊娴佹按鍙风粦瀹氬涓鍗曪級
    // 鍦ㄨ鍗?CAS 鏇存柊鍓嶏紝纭璇?transaction_id 鏈鍏朵粬璁㈠崟浣跨敤
    // ========================================
    if (transaction_id && !MOCK_PAY) {
      const dupTx = await db.collection(COLLECTIONS.ORDERS)
        .where({ transaction_id })
        .limit(1)
        .get();
      if (dupTx.data && dupTx.data.length > 0 && dupTx.data[0]._id !== order._id) {
        console.error('[payCallback] transaction_id 宸茶鍏朵粬璁㈠崟浣跨敤:', transaction_id,
          '褰撳墠璁㈠崟:', order._id, '鍐茬獊璁㈠崟:', dupTx.data[0]._id);
        await recordBillDifference(order, {
          wx_transaction_id: transaction_id,
          conflict_order_id: dupTx.data[0]._id,
          diff_type: 'transaction_id_conflict'
        });
        // 鍐茬獊璁㈠崟宸?PAID 鍒欏箓绛夎繑鍥烇紱鍚﹀垯鎷掔粷
        if (dupTx.data[0].status === ORDER_STATUS.PAID) {
          return wechatResponse('OK'); // 骞傜瓑
        }
        return wechatResponse('FAIL', '浜ゆ槗鍙峰啿绐?);
      }
    }

    // ========================================
    // 6. 鏇存柊璁㈠崟鐘舵€佷负宸叉敮浠橈紙骞跺彂瀹夊叏锛氫粎鏇存柊 PENDING 鐘舵€侊級
    // ========================================
    const now = new Date();
    const updateResult = await db.collection(COLLECTIONS.ORDERS)
      .where({
        _id: order._id,
        status: ORDER_STATUS.PENDING
      })
      .update({
        data: {
          status: ORDER_STATUS.PAID,
          transaction_id: transaction_id || order.transaction_id || '',
          dispatch_status: 'pending', // S2: 鏍囪寰呭垎鍙戯紝宕╂仮澶嶅悗鐢辫ˉ鍋夸换鍔¤瘑鍒?
          paid_at: now,
          profit: order.amount,
          updated_at: now
        }
      });

    // 骞跺彂鍥炶皟鎴栭噸澶嶅洖璋冿細鐘舵€佸凡琚叾浠栬繘绋嬫洿鏂帮紝骞傜瓑杩斿洖
    if (!updateResult.stats || updateResult.stats.updated === 0) {
      console.warn('[payCallback] 璁㈠崟鐘舵€佸凡鍙樻洿锛岃烦杩囬噸澶嶅鐞?', order._id);
      return wechatResponse('OK');
    }

    // ========================================
    // 7. 鏍囪浼樻儬鍒镐负宸蹭娇鐢?
    // ========================================
    if (order.metadata && order.metadata.coupon_user_id) {
      try {
        await db.collection(COLLECTIONS.USER_COUPONS)
          .doc(order.metadata.coupon_user_id)
          .update({
            data: {
              status: 'used',
              order_id: order._id,
              used_at: now,
              updated_at: now
            }
          });
      } catch (e) {
        // 浼樻儬鍒搁泦鍚堝彲鑳藉皻鏈垱寤猴紝闈欓粯澶勭悊
        console.warn('[payCallback] 浼樻儬鍒告爣璁板け璐?', e.message);
      }
    }

    // ========================================
    // 8. 鎸夎鍗曠被鍨嬪垎鍙戝悗缁笟鍔″鐞?
    // ========================================
    await dispatchPostPayment(order, transaction_id);

    // V1.5: 鏀粯鎴愬姛鍩嬬偣
    try {
      await cloud.callFunction({
        name: 'trackEvent',
        data: {
          eventName: 'pay_success',
          properties: {
            order_id: order._id,
            order_type: order.type,
            amount: order.amount
          }
        }
      });
    } catch (trackErr) {
      console.warn('[payCallback] 鍩嬬偣璁板綍璺宠繃:', trackErr.message);
    }

    // ========================================
    // 9. 鏀粯鎴愬姛閫氱煡
    // ========================================
    await sendPaymentNotify(order);

    console.log('[payCallback] 澶勭悊瀹屾垚:', out_trade_no, 'type:', order.type);
    return wechatResponse('OK');

  } catch (error) {
    console.error('[payCallback] 鏈煡寮傚父:', error.message, error.stack);
    // F6: 涓氬姟鏈畬鎴愭椂杩斿洖 FAIL锛岃Е鍙戝井淇℃敮浠樺钩鍙伴噸璇曪紝閬垮厤鐢ㄦ埛浠樻鍚庢湭鎷垮埌浼氬憳/鐐规暟
    // 璁板綍澶辫触璁㈠崟渚涜ˉ鍋夸换鍔′慨澶?
    try {
      if (out_trade_no) {
        await db.collection('dispatch_failures').add({
          data: {
            order_id: out_trade_no,
            error: error.message,
            created_at: new Date(),
            status: 'pending',
            retry_count: 0
          }
        });
      }
    } catch (logErr) {
      // 蹇界暐鏃ュ織鍐欏叆澶辫触锛屼笉闃诲杩斿洖
      console.warn('[payCallback] 琛ュ伩璁板綍鍐欏叆澶辫触:', logErr.message);
    }
    // 杩斿洖 FAIL 璁╁井淇￠噸璇?
    return wechatResponse('FAIL', '涓氬姟澶勭悊寮傚父');
  }
};

// ============================================
// 鏀粯鍚庝笟鍔″垎鍙?
// ============================================

/**
 * 鏍规嵁璁㈠崟绫诲瀷鎵ц鏀粯鍚庝笟鍔″鐞?
 *
 * @param {object} order - 璁㈠崟璁板綍
 * @param {string} transactionId - 寰俊鏀粯娴佹按鍙?
 */
async function dispatchPostPayment(order, transactionId) {
  const orderType = order.type;
  const openid = order.user_id;
  const metadata = order.metadata || {};

  console.log('[payCallback] 鍒嗗彂涓氬姟澶勭悊:', orderType);

  try {
    switch (orderType) {

      // --- 鎶ュ憡璁㈠崟 ---
      case ORDER_TYPES.REPORT:
        // 鎶ュ憡璁㈠崟鐨勬牳蹇冧笟鍔″湪 createOrder 涓凡澶勭悊
        // payCallback 鍙渶纭鏀粯鐘舵€侊紝棰濆害宸插湪 createOrder 涓鎵?
        console.log('[payCallback] 鎶ュ憡璁㈠崟鏀粯纭:', order._id);
        break;

      // --- 涓汉浼氬憳锛堟湀鍗?骞村崱锛?--
     case ORDER_TYPES.MEMBER:
     case ORDER_TYPES.MEMBER_MONTHLY:
     case ORDER_TYPES.MEMBER_YEARLY:
       await activateMember(openid, {
         memberType: metadata.member_tier || metadata.member_type || (orderType === ORDER_TYPES.MEMBER_YEARLY ? 'yearly' : 'monthly'),
         orderId: order._id,
         amount: order.amount
       });
       break;

     // --- 瀹跺涵浼氬憳 ---
     case ORDER_TYPES.MEMBER_FAMILY_MONTHLY:
     case ORDER_TYPES.MEMBER_FAMILY_YEARLY:
       await activateFamilyMember(openid, {
         memberType: metadata.member_tier || (orderType === ORDER_TYPES.MEMBER_FAMILY_YEARLY ? 'family_yearly' : 'family_monthly'),
         orderId: order._id,
         amount: order.amount
       });
       break;

      // --- 鐐规暟鍖?---
      case ORDER_TYPES.POINTS:
        await creditPoints(openid, {
          packType: metadata.pack_type,
          pointsCount: metadata.points_count,
          expireDays: metadata.expire_days,
          orderId: order._id
        });
        break;

      // --- 缁勫悎濂楅 ---
      case ORDER_TYPES.BUNDLE:
        await processBundle(order);
        break;

      default:
        console.warn('[payCallback] 鏈煡璁㈠崟绫诲瀷:', orderType, order._id);
    }

    // S2: 璧勬簮鍙戞斁鎴愬姛锛屾爣璁板垎鍙戝畬鎴愶紙pending 鈫?completed锛?
    try {
      await db.collection(COLLECTIONS.ORDERS).doc(order._id).update({
        data: { dispatch_status: 'completed', dispatched_at: new Date() }
      });
    } catch (upErr) {
      console.warn('[payCallback] 鍒嗗彂瀹屾垚鐘舵€佹洿鏂板紓甯?', order._id, upErr.message);
    }
  } catch (dispatchError) {
    // 涓氬姟鍒嗗彂澶辫触涓嶉樆濉炲洖璋冭繑鍥烇紙璁㈠崟鐘舵€佸凡鏇存柊涓?paid锛?
    // 澶辫触鐨勪笟鍔￠€氳繃琛ュ伩浠诲姟淇
    console.error('[payCallback] 涓氬姟鍒嗗彂澶辫触:', order._id, orderType, dispatchError.message);
    // S2: 鏍囪鍒嗗彂澶辫触锛屼緵琛ュ伩浠诲姟璇嗗埆閲嶅彂锛坧ending 鈫?failed锛?
    try {
      await db.collection(COLLECTIONS.ORDERS).doc(order._id).update({
        data: { dispatch_status: 'failed', dispatch_error: dispatchError.message, dispatched_at: new Date() }
      });
    } catch (upErr) {
      console.warn('[payCallback] 鍒嗗彂澶辫触鐘舵€佹洿鏂板紓甯?', order._id, upErr.message);
    }
    await recordDispatchFailure(order, dispatchError);
  }
}

// ============================================
// 浼氬憳婵€娲?
// ============================================

/**
 * 婵€娲?缁垂涓汉浼氬憳
 * 鏀寔鏂板紑閫氥€佺画璐广€佽繃鏈熷悗閲嶆柊寮€閫?
 *
 * @param {string} openid - 鐢ㄦ埛 openid
 * @param {object} params - { memberType, orderId, amount }
 */
async function activateMember(openid, params) {
  const { memberType } = params;

  // S3 淇锛氬箓绛夋鏌?鈥?鍚屼竴璁㈠崟鍙縺娲讳竴娆′細鍛橈紝闃叉閲嶅鍥炶皟瑕嗙洊寮忛噸缃?report_credits_used
  if (params.orderId) {
    const existing = await db.collection(COLLECTIONS.MEMBERS)
      .where({ user_id: openid, activated_by_order: params.orderId })
      .limit(1)
      .get();
    if (existing.data && existing.data.length > 0) {
      console.log('[payCallback] 浼氬憳宸叉縺娲昏繃锛岃烦杩?', params.orderId);
      return;
    }
  }

  const isYearly = memberType === 'yearly';
  const durationDays = isYearly ? MEMBER_DURATION.YEAR : MEMBER_DURATION.MONTH;
  const reportCredits = isYearly
    ? dbCredits.YEARLY_REPORTS
    : dbCredits.MONTHLY_REPORTS;
  const now = new Date();

  // 鏌ヨ鐜版湁浼氬憳璁板綍
  const existingResult = await db.collection(COLLECTIONS.MEMBERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  const existingMember = (existingResult.data && existingResult.data.length > 0)
    ? existingResult.data[0]
    : null;

 const isActive = existingMember && existingMember.status === MEMBER_STATUS.ACTIVE;

 // 鍒ゆ柇鏄柊寮€閫?缁垂锛堝悓绫诲瀷锛夎繕鏄崌绾э紙涓嶅悓绫诲瀷锛?
 const isUpgrade = isActive && existingMember.type !== memberType;

 // 璁＄畻鍒版湡鏃ユ湡
 let expireDate;
 if (isUpgrade) {
   // 鍗囩骇锛氬彇 max(鍘熷埌鏈熸棩, now+鏂板懆鏈?锛屼繚璇佺敤鎴蜂笉鍥犲崌绾ф崯澶辨椂闂?
   const freshExpire = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
   const originalExpire = new Date(existingMember.expire_date);
   expireDate = originalExpire > freshExpire ? originalExpire : freshExpire;
 } else if (isActive && existingMember.expire_date) {
   const currentExpire = new Date(existingMember.expire_date);
   const baseDate = currentExpire > now ? currentExpire : now;
   expireDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
 } else {
   expireDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
 }

 // 升级时重置已用次数为 0（用户花钱升级应享受新会员全部额度）
 let preservedUsed = 0;
 if (isUpgrade) {
   preservedUsed = 0;
   console.log('[payCallback] 会员升级:', existingMember.type, '→', memberType,
     '重置已用次数，新总额:', reportCredits);
 }


 // 璁＄畻棰濆害閲嶇疆鏃堕棿锛堟寜寮€閫氭棩瀵归綈锛?
  const resetBase = (existingMember && existingMember.start_date)
    ? new Date(existingMember.start_date)
    : now;
  const startDay = resetBase.getDate();
  let resetMonth = now.getMonth();
  let resetYear = now.getFullYear();
  resetMonth += 1;
  if (resetMonth > 11) { resetMonth = 0; resetYear += 1; }
  const maxDay = new Date(resetYear, resetMonth + 1, 0).getDate();
  const resetDay = Math.min(startDay, maxDay);
  const nextResetAt = new Date(resetYear, resetMonth, resetDay,
    now.getHours(), now.getMinutes(), now.getSeconds());

  // 鏇存柊鎴栧垱寤轰細鍛樿褰?
  if (existingMember) {
    await db.collection(COLLECTIONS.MEMBERS).doc(existingMember._id).update({
      data: {
        type: memberType,
        status: MEMBER_STATUS.ACTIVE,
        expire_date: expireDate,
        report_credits_total: reportCredits,
        report_credits_used: preservedUsed,
        report_credits_reset_at: nextResetAt,
        activated_by_order: params.orderId, // S3: 璁板綍婵€娲绘潵婧愶紝渚涘箓绛夋牎楠?
        // 浠庡搴細鍛橀檷绾у埌涓汉浼氬憳鏃讹紝娓呯悊瀹跺涵涓撳睘瀛楁
        ...(isUpgrade && (existingMember.type === 'family_monthly' || existingMember.type === 'family_yearly')
          ? {
              family_member_ids: _.remove(),
              family_max_pet: _.remove(),
              family_credits_total: _.remove(),
              family_credits_used: _.remove(),
              family_credits_reset_at: _.remove()
            }
          : {}),
        updated_at: now
      }
    });
  } else {
    await db.collection(COLLECTIONS.MEMBERS).add({
      data: {
        user_id: openid,
        type: memberType,
        status: MEMBER_STATUS.ACTIVE,
        start_date: now,
        expire_date: expireDate,
        report_credits_total: reportCredits,
        report_credits_used: preservedUsed,
        report_credits_reset_at: nextResetAt,
        activated_by_order: params.orderId, // S3: 璁板綍婵€娲绘潵婧愶紝渚涘箓绛夋牎楠?
        auto_renew: false,
        created_at: now,
        updated_at: now
      }
    });
  }

  // 鍚屾 users 闆嗗悎鐨勪細鍛樻爣璁?
  await syncUserMemberStatus(openid, true, expireDate);
}

/**
 * 婵€娲诲搴細鍛?
 */
async function activateFamilyMember(openid, params) {
  const isYearly = params.memberType === 'family_yearly';

  // S3 淇锛氬箓绛夋鏌?鈥?鍚屼竴璁㈠崟鍙縺娲讳竴娆″搴細鍛橈紝闃叉閲嶅鍥炶皟閲嶇疆棰濆害
  if (params.orderId) {
    const existing = await db.collection(COLLECTIONS.MEMBERS)
      .where({ user_id: openid, activated_by_order: params.orderId })
      .limit(1)
      .get();
    if (existing.data && existing.data.length > 0) {
      console.log('[payCallback] 瀹跺涵浼氬憳宸叉縺娲昏繃锛岃烦杩?', params.orderId);
      return;
    }
  }
  const durationDays = isYearly ? MEMBER_DURATION.YEAR : MEMBER_DURATION.MONTH;
  const reportCredits = isYearly ? dbCredits.FAMILY_YEARLY_REPORTS : dbCredits.FAMILY_MONTHLY_REPORTS;
  const now = new Date();

  const existingResult = await db.collection(COLLECTIONS.MEMBERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  const existingMember = (existingResult.data && existingResult.data.length > 0)
    ? existingResult.data[0] : null;

  const isActive = existingMember && existingMember.status === MEMBER_STATUS.ACTIVE;

  // 鍒ゆ柇鏄柊寮€閫?缁垂杩樻槸鍗囩骇锛堜笉鍚屼細鍛樼被鍨嬮棿鍒囨崲锛?
  const isUpgrade = isActive && existingMember.type !== params.memberType;

 // 升级时重置已用次数为 0（用户花钱升级应享受新会员全部额度）
 let preservedUsed = 0;
 if (isUpgrade) {
   preservedUsed = 0;
   console.log('[payCallback] 家庭会员升级:', existingMember.type, '→', params.memberType,
     '重置已用次数，新总额:', reportCredits);
 }

  let expireDate;
  if (isUpgrade) {
    // 鍗囩骇锛氬彇 max(鍘熷埌鏈熸棩, now+鏂板懆鏈?锛屼繚璇佺敤鎴蜂笉鍥犲崌绾ф崯澶辨椂闂?
    const freshExpire = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const originalExpire = new Date(existingMember.expire_date);
    expireDate = originalExpire > freshExpire ? originalExpire : freshExpire;
  } else if (isActive && existingMember.expire_date) {
    const currentExpire = new Date(existingMember.expire_date);
    const baseDate = currentExpire > now ? currentExpire : now;
    expireDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
  } else {
    expireDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  const startDate = (existingMember && existingMember.start_date)
    ? new Date(existingMember.start_date) : now;
  const startDay = startDate.getDate();
  let resetMonth = now.getMonth() + 1;
  let resetYear = now.getFullYear();
  if (resetMonth > 11) { resetMonth = 0; resetYear += 1; }
  const maxDay = new Date(resetYear, resetMonth + 1, 0).getDate();
  const nextResetAt = new Date(resetYear, resetMonth,
    Math.min(startDay, maxDay),
    now.getHours(), now.getMinutes(), now.getSeconds());

  const memberData = {
    activated_by_order: params.orderId, // S3: 璁板綍婵€娲绘潵婧愶紝渚涘箓绛夋牎楠岋紙update/add 鍏辩敤锛?
    type: params.memberType,
    status: MEMBER_STATUS.ACTIVE,
    expire_date: expireDate,
    report_credits_total: reportCredits,
    report_credits_used: preservedUsed,
    report_credits_reset_at: nextResetAt,
    family_member_ids: existingMember ? (existingMember.family_member_ids || []) : [],
    family_max_pet: MEMBER_LIMITS.MAX_PETS_FAMILY,
    family_credits_total: reportCredits,
    family_credits_used: preservedUsed,
    family_credits_reset_at: nextResetAt,
    updated_at: now
  };

  if (existingMember) {
    await db.collection(COLLECTIONS.MEMBERS).doc(existingMember._id).update({
      data: memberData
    });
  } else {
    await db.collection(COLLECTIONS.MEMBERS).add({
      data: {
        user_id: openid,
        start_date: now,
        auto_renew: false,
        created_at: now,
        ...memberData
      }
    });
  }

  await syncUserMemberStatus(openid, true, expireDate);
}

/**
 * 鍚屾 users 闆嗗悎鐨勪細鍛樼姸鎬佹爣璁?
 */
async function syncUserMemberStatus(openid, isMember, expireDate) {
  const now = new Date();
  const userResult = await db.collection(COLLECTIONS.USERS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  if (userResult.data && userResult.data.length > 0) {
    await db.collection(COLLECTIONS.USERS).doc(userResult.data[0]._id).update({
      data: {
        isMember: isMember,
        memberExpire: expireDate,
        updated_at: now
      }
    });
  } else {
    await db.collection(COLLECTIONS.USERS).add({
      data: {
        user_id: openid,
        isMember: isMember,
        memberExpire: expireDate,
        first_report_used: false,
        invite_reward_credits: 0,
        created_at: now,
        updated_at: now
      }
    });
  }
}

// ============================================
// 鐐规暟鍒拌处
// ============================================

/**
 * 鐐规暟鍖呮敮浠樻垚鍔熷悗锛岀偣鏁板埌璐?
 *
 * @param {string} openid - 鐢ㄦ埛 openid
 * @param {object} params - { packType, pointsCount, expireDays, orderId }
 */
async function creditPoints(openid, params) {
  const { pointsCount, expireDays, orderId } = params;

  // S3 淇锛氬箓绛夋鏌?鈥?鍚屼竴璁㈠崟鐨勭偣鏁板彧鍙戞斁涓€娆★紝闃叉閲嶅鍥炶皟鐢?_.inc 鍙犲姞鐐规暟
  if (orderId) {
    const existing = await db.collection(COLLECTIONS.POINT_TRANSACTIONS)
      .where({ order_id: orderId, type: 'purchase' })
      .limit(1)
      .get();
    if (existing.data && existing.data.length > 0) {
      console.log('[payCallback] 鐐规暟宸插彂鏀捐繃锛岃烦杩?', orderId);
      return;
    }
  }

  const now = new Date();
  const expireAt = new Date(now.getTime() + (expireDays || 90) * 24 * 60 * 60 * 1000);

  // 鏌ユ壘鎴栧垱寤虹敤鎴风偣鏁拌褰?
  const existingResult = await db.collection(COLLECTIONS.USER_POINTS)
    .where({ user_id: openid })
    .limit(1)
    .get();

  let balanceAfter;
  if (existingResult.data && existingResult.data.length > 0) {
    const record = existingResult.data[0];
    const newExpire = record.expire_at && new Date(record.expire_at) > now
      ? new Date(record.expire_at) : expireAt;
    balanceAfter = (record.balance || 0) + pointsCount;
    await db.collection(COLLECTIONS.USER_POINTS).doc(record._id).update({
      data: {
        balance: _.inc(pointsCount),
        total_purchased: _.inc(pointsCount),
        expire_at: newExpire,
        updated_at: now
      }
    });
  } else {
    balanceAfter = pointsCount;
    await db.collection(COLLECTIONS.USER_POINTS).add({
      data: {
        user_id: openid,
        balance: pointsCount,
        total_purchased: pointsCount,
        total_used: 0,
        expire_at: expireAt,
        created_at: now,
        updated_at: now
      }
    });
  }

  // 璁板綍浜ゆ槗娴佹按
  await db.collection(COLLECTIONS.POINT_TRANSACTIONS).add({
    data: {
      user_id: openid,
      type: 'purchase',
      amount: pointsCount,
      order_id: orderId,
      balance_after: balanceAfter,
      created_at: now
    }
  });

  console.log('[payCallback] 鐐规暟宸插埌璐? +' + pointsCount + '锛岃鍗?', orderId);
}

// ============================================
// 濂楅鎷嗗崟澶勭悊
// ============================================

/**
 * 澶勭悊缁勫悎濂楅鏀粯鎴愬姛
 * 濂楅鍖呭惈瀛愯鍗曪紙浼氬憳 + 鐐规暟鍖咃級锛屽垎鍒縺娲?
 *
 * @param {object} order - 濂楅涓昏鍗?
 */
async function processBundle(order) {
  const bundleType = order.metadata && order.metadata.bundle_type;
  console.log('[payCallback] 濂楅璁㈠崟澶勭悊:', order._id, bundleType);

  // 鏌ユ壘瀛愯鍗?
  if (order.sub_orders && order.sub_orders.length > 0) {
    const now = new Date();
    for (const sub of order.sub_orders) {
      try {
        const subResult = await db.collection(COLLECTIONS.ORDERS)
          .doc(sub.order_id).get();
        if (subResult.data) {
          await db.collection(COLLECTIONS.ORDERS).doc(sub.order_id).update({
            data: {
              status: ORDER_STATUS.PAID,
              paid_at: now,
              updated_at: now
            }
          });
          // 閫掑綊澶勭悊瀛愯鍗曚笟鍔?
          await dispatchPostPayment(subResult.data, order.transaction_id);
        }
      } catch (e) {
        console.error('[payCallback] 瀛愯鍗曞鐞嗗け璐?', sub.order_id, e.message);
      }
    }
  }
}

// ============================================
// 鏀粯澶辫触澶勭悊
// ============================================

/**
 * 澶勭悊鏀粯澶辫触鍥炶皟
 * 灏?pending 璁㈠崟鏍囪涓?failed锛堜繚鐣欒褰曚緵鍒嗘瀽锛?
 */
async function handlePaymentFailed(outTradeNo) {
  try {
    const result = await db.collection(COLLECTIONS.ORDERS)
      .where({ out_trade_no: outTradeNo, status: ORDER_STATUS.PENDING })
      .update({
        data: {
          status: ORDER_STATUS.FAILED,
          updated_at: new Date()
        }
      });
    if (result.stats && result.stats.updated > 0) {
      console.log('[payCallback] 璁㈠崟鏍囪涓烘敮浠樺け璐?', outTradeNo);

      // V1.5: 鏀粯澶辫触鍩嬬偣
      try {
        const failedOrderResult = await db.collection(COLLECTIONS.ORDERS)
          .where({ out_trade_no: outTradeNo })
          .limit(1)
          .get();
        const failedOrder = failedOrderResult.data && failedOrderResult.data[0];
        await cloud.callFunction({
          name: 'trackEvent',
          data: {
            eventName: 'pay_fail',
            properties: {
              order_id: failedOrder ? failedOrder._id : '',
              order_type: failedOrder ? failedOrder.type : '',
              amount: failedOrder ? failedOrder.amount : 0,
              out_trade_no: outTradeNo
            }
          }
        });
      } catch (trackErr) {
        console.warn('[payCallback] 鏀粯澶辫触鍩嬬偣璺宠繃:', trackErr.message);
      }
    }
  } catch (e) {
    console.error('[payCallback] 鏀粯澶辫触澶勭悊寮傚父:', e.message);
  }
}

// ============================================
// 鏀粯鎴愬姛閫氱煡
// ============================================

/**
 * 鍙戦€佹敮浠樻垚鍔熻闃呮秷鎭€氱煡
 * 閫氳繃 sendPaymentNotification 浜戝嚱鏁板彂閫?
 */
async function sendPaymentNotify(order) {
  try {
    let templateType;
    let page;
    const amountDisplay = '楼' + ((order.amount || 0) / 100).toFixed(2);

    switch (order.type) {
      case ORDER_TYPES.REPORT:
        templateType = 'PAY_SUCCESS';
        page = 'pages/ai-report/index?recordId=' + (order.metadata && order.metadata.record_id || '');
        break;
      case ORDER_TYPES.MEMBER:
      case ORDER_TYPES.MEMBER_MONTHLY:
      case ORDER_TYPES.MEMBER_YEARLY:
      case ORDER_TYPES.MEMBER_FAMILY_MONTHLY:
      case ORDER_TYPES.MEMBER_FAMILY_YEARLY:
        templateType = 'MEMBER_ACTIVATED';
        page = 'pages/member/status';
        break;
      case ORDER_TYPES.POINTS:
        templateType = 'PAY_SUCCESS';
        page = 'pages/points/index';
        break;
      default:
        return; // 涓嶉渶瑕侀€氱煡
    }

    // 浜戝嚱鏁板唴璋冪敤鍙︿竴涓簯鍑芥暟
    await cloud.callFunction({
      name: 'sendPaymentNotification',
      data: {
        openid: order.user_id,
        templateType,
        data: {
          page,
          templateData: {
            thing1: { value: (order.description || '鍋ュ悍鎶ュ憡').substring(0, 20) },
            amount2: { value: amountDisplay },
            time3: { value: new Date().toLocaleString('zh-CN') }
          }
        }
      }
    }).catch(e => {
      // 閫氱煡鍙戦€佸け璐ヤ笉褰卞搷涓绘祦绋?
      console.warn('[payCallback] 閫氱煡鍙戦€佸け璐?', e.message);
    });

  } catch (e) {
    console.warn('[payCallback] 閫氱煡鏋勫缓澶辫触:', e.message);
  }
}

// ============================================
// 寮傚父璁板綍
// ============================================

/**
 * 璁板綍瀵硅处宸紓锛堥噾棰濅笉涓€鑷?/ 鐘舵€佸啿绐侊級
 */
async function recordBillDifference(order, diff) {
  try {
    await db.collection(COLLECTIONS.BILL_CHECK_LOGS).add({
      data: {
        bill_date: new Date().toISOString().substring(0, 10),
        diff_orders: [{
          order_id: order._id,
          out_trade_no: order.out_trade_no,
          local_status: order.status,
          local_amount: order.amount,
          ...diff
        }],
        total_order_count: 1,
        total_amount: order.amount || 0,
        created_at: new Date()
      }
    });
  } catch (e) {
    console.error('[payCallback] 宸紓璁板綍鍐欏叆澶辫触:', e.message);
  }
}

/**
 * 璁板綍涓氬姟鍒嗗彂澶辫触锛堣ˉ鍋夸换鍔′慨澶嶏級
 */
async function recordDispatchFailure(order, error) {
  try {
    await db.collection(COLLECTIONS.ERROR_LOGS).add({
      data: {
        function: 'payCallback',
        operation: 'dispatchPostPayment',
        order_id: order._id,
        out_trade_no: order.out_trade_no,
        order_type: order.type,
        error: error.message || String(error),
        created_at: new Date()
      }
    });
  } catch (e) {
    // 鏃ュ織鍐欏叆澶辫触涓嶉樆濉?
  }
}

// ============================================
// 寰俊鏀粯鍝嶅簲鏍煎紡
// ============================================

/**
 * 杩斿洖寰俊鏀粯瑕佹眰鐨勬爣鍑嗗搷搴旀牸寮?
 * 寰俊鏀粯骞冲彴瑕佹眰杩斿洖 XML/JSON锛屾敹鍒?SUCCESS 鍚庝笉鍐嶉噸璇?
 *
 * @param {string} code - 'OK' | 'FAIL'
 * @param {string} [msg] - 澶辫触鏃剁殑鍘熷洜
 * @returns {object} 寰俊鏀粯鍥炶皟鍝嶅簲
 */
function wechatResponse(code, msg) {
  if (code === 'OK') {
    return { errcode: 0, errmsg: 'OK' };
  }
  return { errcode: -1, errmsg: msg || 'FAIL' };
}
