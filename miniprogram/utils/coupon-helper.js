// 优惠券选择与折扣计算的纯函数集合（点数/会员/报告三页共用）
// 口径与 cloudfunctions/createOrder/index.js#autoSelectCoupon 完全对齐：
//   - type 过滤由 getUserCoupons 云函数完成（只下发匹配 orderType 的券 + universal）
//   - percent discount_value 为「折」数（8=8折，实付 80%），clamp [0,10] 防脏数据
//   - 折扣不超过订单金额
//   - min_amount（分）不满足 → usable=false

/**
 * 为每张券计算对当前订单的折扣（分）与可用性
 * @param {Array} coupons - getUserCoupons 返回的 enriched 券列表（驼峰字段）
 * @param {number} orderPriceFen - 当前订单原价（分）
 * @returns {Array} 每张券附加 { discountFen, discountDisplay, usable }
 */
function enrichCoupons(coupons, orderPriceFen) {
  return (coupons || []).map(function (c) {
    var discountFen = 0;
    var usable = true;
    if (c.minAmount && orderPriceFen < c.minAmount) {
      usable = false;
    } else if (c.discountType === 'fixed') {
      discountFen = c.discountValue || 0;
    } else if (c.discountType === 'percent') {
      // discountValue 为「折」数：8 = 8 折（实付 80%），clamp [0,10] 防历史脏数据
      var zhe = Math.min(Math.max(c.discountValue || 10, 0), 10);
      discountFen = Math.floor((orderPriceFen * (10 - zhe)) / 10);
    }
    discountFen = Math.min(discountFen, orderPriceFen);
    return Object.assign({}, c, {
      discountFen: discountFen,
      discountDisplay: (discountFen / 100).toFixed(2),
      usable: usable,
    });
  });
}

/** 从 enriched 列表里选折扣最大的可用券；无可用返回 ''（=不使用） */
function pickBestCouponId(enriched) {
  var usable = (enriched || []).filter(function (c) {
    return c.usable;
  });
  if (usable.length === 0) return '';
  var best = usable.reduce(function (a, b) {
    return b.discountFen > a.discountFen ? b : a;
  });
  return best._id;
}

/**
 * 给定 enriched 列表与选中的 _id，计算最终展示字段
 * @returns {{coupons, selectedCouponId, couponDiscountFen, couponDiscountDisplay, finalPriceDisplay}}
 */
function computeFinal(enriched, selectedCouponId, orderPriceFen) {
  var sel = (enriched || []).filter(function (c) {
    return c._id === selectedCouponId;
  })[0];
  if (sel && !sel.usable) sel = null;
  var discountFen = sel ? sel.discountFen : 0;
  var payFen = Math.max(orderPriceFen - discountFen, 0);
  return {
    coupons: enriched,
    selectedCouponId: sel ? sel._id : '',
    couponDiscountFen: discountFen,
    couponDiscountDisplay: (discountFen / 100).toFixed(2),
    finalPriceDisplay: (payFen / 100).toFixed(2),
  };
}

/**
 * 选中某券 id：再次点同一券 = 取消（返回 ''）；不可用券忽略（返回原值）
 * @returns {string} 新的 selectedCouponId
 */
function toggleSelect(currentSelectedId, id, enriched) {
  if (!id) return '';
  var c = (enriched || []).filter(function (x) {
    return x._id === id;
  })[0];
  if (!c || !c.usable) return currentSelectedId;
  return id === currentSelectedId ? '' : id;
}

/**
 * 调 getUserCoupons 拉取并 enrich；默认预选最优可用券；回传 setData 友好的快照
 * @param {string} token
 * @param {string} orderType - 'points' | 'member' | 'report'
 * @param {number} orderPriceFen - 当前订单原价（分）
 * @param {(snapshot: object)=>void} onSuccess 回传 { coupons, hasCoupons, selectedCouponId } + computeFinal 字段
 * @param {Function} [onError]
 */
function loadCoupons(token, orderType, orderPriceFen, onSuccess, onError) {
  wx.cloud.callFunction({
    name: 'getUserCoupons',
    data: { token: token, status: 'unused', orderType: orderType },
    success: function (res) {
      if (!res.result || res.result.code !== 0) {
        onError && onError();
        return;
      }
      var list = (res.result.data && res.result.data.coupons) || [];
      var enriched = enrichCoupons(list, orderPriceFen);
      var selected = pickBestCouponId(enriched); // 默认预选最优
      var snap = Object.assign(
        { coupons: enriched, hasCoupons: enriched.length > 0, selectedCouponId: selected },
        computeFinal(enriched, selected, orderPriceFen)
      );
      onSuccess && onSuccess(snap);
    },
    fail: function () {
      onError && onError();
    },
  });
}

module.exports = {
  enrichCoupons: enrichCoupons,
  pickBestCouponId: pickBestCouponId,
  computeFinal: computeFinal,
  toggleSelect: toggleSelect,
  loadCoupons: loadCoupons,
};
