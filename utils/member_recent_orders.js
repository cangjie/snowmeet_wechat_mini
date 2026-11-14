// 会员详情页「最近订单」每一条的显示数据（2026-11-14 用户要求）：
//   图标位：先放订单类型图标（租赁=租、养护=养、零售=售、雪票=票，其它类型取第一个字）；
//   第一行：订单号 + 订单金额、减免金额、支付金额、退款金额、实付金额。
//           支付里含租赁押金，所以「实付」= 支付 − 退款（2026-11-14 用户：押金不能算实付）；
//           后端还没有退款字段时只显示支付，不显示退款和实付（算不出净额，不能把押金当实付）。
//   第二行：日期 + 用了优惠券显示券名（同名多张带数量），用了卡显示卡名：
//           次卡再写「记几次，余几次」（余几次 = 这一单用完之后还剩几次），季卡只写记几次，学员卡只有名称。
//   图标位里类型图标后面按「卡、券、减」的顺序再加图标：用了卡（次卡 / 季卡 / 学员卡）加「卡」，用了券加「券」，有减免加「减」。
//   列表上方的合计（summarize）：把列出来的订单的订单金额、减免、支付、退款、实付各加起来（随分类 tab 切换重算）。
// 后端 MemberAdmin/GetMemberDetailByStaff 的 recentOrders 每条带 totalAmount / discountAmount / paidAmount / refundAmount / tickets / cards；
// 旧后端没有这些字段时金额整段不显示、第二行只有日期，页面不报错。
const util = require('./util.js')

const TYPE_ICONS = {
  '租赁': { char: '租', cls: 'rent' },
  '养护': { char: '养', cls: 'care' },
  '零售': { char: '售', cls: 'retail' },
  '雪票': { char: '票', cls: 'ski' }
}

function typeIcon(type) {
  if (TYPE_ICONS[type]) return TYPE_ICONS[type]
  var name = (type == null ? '' : String(type)).trim()
  return { char: name ? name.charAt(0) : '单', cls: 'other' }
}

function hasNumber(v) { return typeof v === 'number' && !isNaN(v) }

function cardText(c) {
  var name = c.name || '卡'
  if (c.kind === 'punch') {
    return name + ' 记' + (c.used || 0) + '次' + (hasNumber(c.remaining) ? '，余' + c.remaining + '次' : '')
  }
  if (c.kind === 'season') return name + ' 记' + (c.used || 0) + '次'
  return name   // 学员卡：只有名称
}

// 按分四舍五入，避免 0.1 + 0.2 这样的浮点误差
function cents(n) { return Math.round(n * 100) / 100 }

function recentOrderView(o) {
  var hasAmounts = hasNumber(o.totalAmount) && hasNumber(o.discountAmount) && hasNumber(o.paidAmount)
  var hasDiscount = hasAmounts && o.discountAmount > 0
  var hasNet = hasAmounts && hasNumber(o.refundAmount)   // 有退款字段才算得出实付（支付 − 退款）
  var uses = []
  ;(o.tickets || []).forEach(function (t) {
    uses.push({ kind: 'ticket', text: (t.name || '优惠券') + (t.count > 1 ? ' ×' + t.count : '') })
  })
  ;(o.cards || []).forEach(function (c) { uses.push({ kind: 'card', text: cardText(c) }) })
  var badges = []
  if ((o.cards || []).length > 0) badges.push({ char: '卡', cls: 'card' })
  if ((o.tickets || []).length > 0) badges.push({ char: '券', cls: 'ticket' })
  if (hasDiscount) badges.push({ char: '减', cls: 'discount' })
  return {
    id: o.id, code: o.code, type: o.type,
    dateStr: o.bizDate ? util.formatDate(new Date(o.bizDate)) : '',
    icon: typeIcon(o.type),
    hasAmounts: hasAmounts,
    totalStr: hasAmounts ? util.showAmount(o.totalAmount) : '',
    discountStr: hasAmounts ? util.showAmount(o.discountAmount) : '',
    paidStr: hasAmounts ? util.showAmount(o.paidAmount) : '',
    hasNet: hasNet,
    refundStr: hasNet ? util.showAmount(o.refundAmount) : '',
    netStr: hasNet ? util.showAmount(cents(o.paidAmount - o.refundAmount)) : '',
    hasRefund: hasNet && o.refundAmount > 0,
    hasDiscount: hasDiscount,
    badges: badges,
    uses: uses,
    // 合计用的原始数字（不带格式），没有金额字段的订单为 null，不参与合计
    nums: hasAmounts ? { total: o.totalAmount, discount: o.discountAmount, paid: o.paidAmount, refund: hasNet ? o.refundAmount : null } : null
  }
}

// 列出来的订单（recentOrderView 的结果）的合计；按分四舍五入；
// 没有订单、或旧后端没有金额字段时 show = false（页面不显示合计行）；
// 只要有一条订单没有退款字段，退款和实付就不显示（hasNet = false），因为算不出净额。
function summarize(views) {
  var count = 0, total = 0, discount = 0, paid = 0, refund = 0, allHaveRefund = true
  ;(views || []).forEach(function (v) {
    if (!v || !v.nums) return
    count++
    total += v.nums.total; discount += v.nums.discount; paid += v.nums.paid
    if (v.nums.refund == null) allHaveRefund = false
    else refund += v.nums.refund
  })
  if (count === 0) return { show: false, count: 0, totalStr: '', discountStr: '', paidStr: '', hasNet: false, refundStr: '', netStr: '' }
  return {
    show: true, count: count,
    totalStr: util.showAmount(cents(total)), discountStr: util.showAmount(cents(discount)), paidStr: util.showAmount(cents(paid)),
    hasNet: allHaveRefund,
    refundStr: allHaveRefund ? util.showAmount(cents(refund)) : '',
    netStr: allHaveRefund ? util.showAmount(cents(paid - refund)) : ''
  }
}

module.exports = { typeIcon, recentOrderView, summarize }
