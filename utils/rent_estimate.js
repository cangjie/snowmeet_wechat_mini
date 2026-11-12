// 租赁订单详情页的「预计租金」（2026-11-09 用户要求）。
// 订单还没开始计费（未支付、未取件）时 rental_detail 里没有租金明细，页面租金会显示 ¥0.00，店员看不到大概要收多少。
// 这时拿开单时的价格预设（rental.pricePresets，后端生成首日租金也是按这条预设收钱）给店员做个预计。
// 只用于展示：不参与退款/结算，totalSummary、应退押金等仍只算真实的租金明细。

// 开单时的价格预设合计（毛额，减免另算，口径和页面其它地方的租金一致）
function presetRent(rental) {
  var presets = (rental && rental.pricePresets) || []
  var sum = 0
  for (var i = 0; i < presets.length; i++) {
    sum += parseFloat(presets[i].price) || 0
  }
  return sum
}

// 是否生成过租金明细：valid=0 的也算——那是店员有意免除/清零，不能当成「还没开始计费」
function hasRentDetail(rental) {
  var details = (rental && rental.details) || []
  for (var i = 0; i < details.length; i++) {
    if (String(details[i].charge_type || '').trim() === '租金') return true
  }
  return false
}

// 返回 { isEstimate, amount }。只在「还没开始计费、订单还开着」时给预计：
// 订单已关闭/已作废、租赁已结算、体验租赁、没有价格预设的，都不给。
function estimateRental(rental, order) {
  var none = { isEstimate: false, amount: 0 }
  if (!rental || hasRentDetail(rental)) return none
  if (rental.settled == 1 || rental.experience) return none
  if (order && (order.valid == 0 || order.closed == 1)) return none
  var amount = presetRent(rental)
  return amount > 0 ? { isEstimate: true, amount: amount } : none
}

module.exports = { presetRent: presetRent, hasRentDetail: hasRentDetail, estimateRental: estimateRental }
