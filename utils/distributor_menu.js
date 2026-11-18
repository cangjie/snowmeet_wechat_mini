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
  // 领取情况（每次分享一条，可取消没领取的）、券复用教练中心，按 tab 直达；分享在「制作会员卡」页（2026-11-17）
  cards: { title: '发卡与领取情况', url: '/pages/coach/home/home?tab=status' },
  coupons: { title: '我的优惠券', url: '/pages/coach/home/home?tab=coupons' },
  payee: { title: '收款资料', url: '/pages/distributor/payee/payee' }
}

// 暂时不在「我的」菜单里显示的条目（用户 2026-11-18：「我的顾客与消费」「发卡与领取情况」「我的优惠券」暂时去掉，以后再加回来）。
// 页面、ENTRIES、服务端返回的条目都没动，只是菜单不显示；要加回来，把对应的 key 从这个列表里删掉就行。
const HIDDEN = ['customers', 'cards', 'coupons']

// resp: GetMyDistributor 的 data。返回 { distributor, title, entries }；不是分销商时 distributor 为 null、entries 为空。
// hidden 默认是上面的 HIDDEN（测试里传 [] 可以看到加回来之后的样子）。
function build(resp, hidden) {
  if (!resp || !resp.isDistributor || !resp.distributor) return { distributor: null, title: '', entries: [] }
  const keys = Array.isArray(resp.entries) ? resp.entries : []
  const off = Array.isArray(hidden) ? hidden : HIDDEN
  const entries = keys.filter(k => ENTRIES[k] && off.indexOf(k) < 0).map(k => ({ key: k, title: ENTRIES[k].title, url: ENTRIES[k].url }))
  const type = resp.distributor.type || ''
  return { distributor: resp.distributor, title: type ? '分销商 · ' + type : '分销商', entries }
}

module.exports = { ENTRIES, HIDDEN, build }
