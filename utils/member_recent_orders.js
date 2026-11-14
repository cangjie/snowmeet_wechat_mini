// 会员详情页「最近订单」每一条的显示数据（2026-11-14 用户要求）：
//   图标位：先放订单类型图标（租赁=租、养护=养、零售=售、雪票=票，其它类型取第一个字）；
//   第一行：订单号 + 订单金额、减免金额、实际支付金额；
//   第二行：日期 + 用了优惠券显示券名（同名多张带数量），用了卡显示卡名：
//           次卡再写「记几次，余几次」（余几次 = 这一单用完之后还剩几次），季卡只写记几次，学员卡只有名称。
// 后端 MemberAdmin/GetMemberDetailByStaff 的 recentOrders 每条带 totalAmount / discountAmount / paidAmount / tickets / cards；
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

function recentOrderView(o) {
  var hasAmounts = hasNumber(o.totalAmount) && hasNumber(o.discountAmount) && hasNumber(o.paidAmount)
  var uses = []
  ;(o.tickets || []).forEach(function (t) {
    uses.push({ kind: 'ticket', text: (t.name || '优惠券') + (t.count > 1 ? ' ×' + t.count : '') })
  })
  ;(o.cards || []).forEach(function (c) { uses.push({ kind: 'card', text: cardText(c) }) })
  return {
    id: o.id, code: o.code, type: o.type,
    dateStr: o.bizDate ? util.formatDate(new Date(o.bizDate)) : '',
    icon: typeIcon(o.type),
    hasAmounts: hasAmounts,
    totalStr: hasAmounts ? util.showAmount(o.totalAmount) : '',
    discountStr: hasAmounts ? util.showAmount(o.discountAmount) : '',
    paidStr: hasAmounts ? util.showAmount(o.paidAmount) : '',
    hasDiscount: hasAmounts && o.discountAmount > 0,
    uses: uses
  }
}

module.exports = { typeIcon, recentOrderView }
