// 「我的」页分销商菜单区域：服务端 GET Distributor/GetMyDistributor 返回身份和条目 key，这里把 key 对到标题和页面。
// 条目顺序、有没有某个条目都听服务端的；不认识的 key 直接忽略，所以以后服务端给机构加条目，旧小程序不会出错。
// 设计：snowmeet_ai_doc/docs/superpowers/specs/2026-11-15-distributor-backend-design.md
const ENTRIES = {
  qrcode: { title: '订票二维码', url: '/pages/distributor/qrcode/qrcode' },
  customers: { title: '我的顾客与消费', url: '/pages/distributor/customers/customers' },
  // 机构自己制作会员卡（教练的价格由管理员设置，服务端不会给教练这个条目）
  makeCard: { title: '制作会员卡', url: '/pages/coach/card_standard/card_standard' },
  // 机构按管理员设的底价生成自己的优惠券（教练没有这个条目）
  makeCoupon: { title: '制作优惠券', url: '/pages/coach/coupon_maker/coupon_maker' },
  // 发卡、券复用教练中心，按 tab 直达
  cards: { title: '发卡与领取情况', url: '/pages/coach/home/home?tab=share' },
  coupons: { title: '我的优惠券', url: '/pages/coach/home/home?tab=coupons' },
  payee: { title: '收款资料', url: '/pages/distributor/payee/payee' }
}

// resp: GetMyDistributor 的 data。返回 { distributor, title, entries }；不是分销商时 distributor 为 null、entries 为空。
function build(resp) {
  if (!resp || !resp.isDistributor || !resp.distributor) return { distributor: null, title: '', entries: [] }
  const keys = Array.isArray(resp.entries) ? resp.entries : []
  const entries = keys.filter(k => ENTRIES[k]).map(k => ({ key: k, title: ENTRIES[k].title, url: ENTRIES[k].url }))
  const type = resp.distributor.type || ''
  return { distributor: resp.distributor, title: type ? '分销商 · ' + type : '分销商', entries }
}

module.exports = { ENTRIES, build }
