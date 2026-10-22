// utils/reception_shop.js
// 业务开单入口的门店规则（扫码接待页、手动录入入口共用）

// 万龙体验中心的养护按旧版接待规则归万龙服务中心，入口仍允许发起。
const CARE_PROXY_SHOPS = { '万龙体验中心': '万龙服务中心' };

function canStartCare(shop, care) {
  return care === 1 || !!CARE_PROXY_SHOPS[shop];
}

function orderShopFor(bizType, shop) {
  if (bizType === 'maintain' && CARE_PROXY_SHOPS[shop]) {
    return CARE_PROXY_SHOPS[shop];
  }
  return shop;
}

module.exports = {
  canStartCare,
  orderShopFor,
};
