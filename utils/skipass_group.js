// 万龙雪票的商品分组。
// 商品名是自由文本（「【25-26雪季】1天日场含雪具滑雪票」「【25-26雪季节日专享】午连夜自带板雪票」……），
// 首页按「时长 + 场次」分组，进详情页再选装备。解析不出场次和时长的商品归「其他」，保证一个商品都不丢。
// 26-27 的真实商品名要等万龙上架才知道：解析规则只认关键词，认不出的走「其他」。

const DURATION_ORDER = ['4小时', '6小时', '1天', '1.5天', '2天']
const SESSION_ORDER = ['日场', '夜场', '午连夜']
const GEAR_ORDER = ['自带板', '不含雪具', '含雪具', '含雪具头盔', '含全套雪具', '']

const OTHER_KEY = 'other'
const OTHER_RANK = 9000

// 日场过了 14 点、夜场过了 20 点，当天就不能订了，从明天起。午连夜下午就开始，按日场算
const CUTOFF_HOUR = { '夜场': 20 }
const DEFAULT_CUTOFF_HOUR = 14

function parseProductName(name) {
  const n = String(name || '')
  const holiday = /节日专享|节假日/.test(n)
  const area = /魔毯/.test(n) ? '魔毯区' : ''
  let times = ''
  const t = n.match(/(\d+)\s*次卡/)
  if (t) times = t[1]

  let session = ''
  if (/午连夜|下午场\s*\+\s*夜场/.test(n)) session = '午连夜'
  else if (/夜场/.test(n)) session = '夜场'
  else if (/日场/.test(n)) session = '日场'

  let duration = ''
  const h = n.match(/(\d+(?:\.\d+)?)\s*小时/)
  const d = n.match(/(\d+(?:\.\d+)?)\s*天/)
  if (h) duration = h[1] + '小时'
  else if (d) duration = d[1] + '天'
  // 写了时长没写场次的（如「1.5天含雪具套票」）都是日场
  if (!session && duration) session = '日场'

  // 「不含雪具」要先判，否则会被下面的「含雪具」吃掉
  let gear = ''
  if (/自带板/.test(n)) gear = '自带板'
  else if (/不含(全套)?(雪具|装备)/.test(n)) gear = '不含雪具'
  else if (/含全套/.test(n)) gear = '含全套雪具'
  else if (/雪具头盔/.test(n)) gear = '含雪具头盔'
  else if (/含雪具|含装备/.test(n)) gear = '含雪具'
  // 「【万龙】全雪区日场1天雪票」这类写了时长、没写任何装备的，就是不含雪具（旁边会有「(含雪具)」「(含全套装备)」两个同时长的票）
  else if (duration && /雪票/.test(n)) gear = '不含雪具'

  // 同一组、同一装备下还分「限平日」「全雪季通用」「平日使用」「周末使用」的次卡，靠它区分
  let variant = ''
  const v = n.match(/限平日使用|限平日|全雪季通用|平日使用|周末使用/)
  if (v) variant = v[0]

  return { holiday, area, times, session, duration, gear, variant }
}

function isOther(p) {
  return !p.session && !p.duration && !p.times
}

function groupKey(p) {
  if (isOther(p)) return OTHER_KEY
  return [p.holiday ? 'H' : '', p.area, p.times, p.session, p.duration].join(':')
}

function groupTitle(p) {
  if (isOther(p)) return '其他'
  let base
  if (p.times) base = p.times + '次卡' + (p.session ? '·' + p.session : '')
  else if (p.session === '日场') base = (p.duration || '') + '日场'
  else base = (p.duration || '') + p.session
  return (p.holiday ? '节日专享·' : '') + (p.area ? p.area + '·' : '') + base
}

function groupRank(p) {
  if (isOther(p)) return OTHER_RANK
  let rank = p.area ? 3000 : p.times ? 2000 : p.holiday ? 1000 : 0
  const s = SESSION_ORDER.indexOf(p.session)
  rank += (s < 0 ? 9 : s) * 100
  const d = DURATION_ORDER.indexOf(p.duration)
  rank += d < 0 ? 50 : d
  return rank
}

function gearRank(gear) {
  const i = GEAR_ORDER.indexOf(gear)
  return i < 0 ? GEAR_ORDER.length : i
}

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

function localDateStr(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

// 今天还能不能订：过了截止点就从明天起
function firstBookableDate(session, now) {
  const cutoff = CUTOFF_HOUR[session] === undefined ? DEFAULT_CUTOFF_HOUR : CUTOFF_HOUR[session]
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (now.getHours() >= cutoff) d.setDate(d.getDate() + 1)
  return localDateStr(d)
}

// 商品的每日价格行里能订的日期：成交价 > 0、不早于最早可订日；同一天有多行（历史重复）取第一行
function bookablePrices(product, firstDate) {
  const rows = Array.isArray(product && product.dailyPrice) ? product.dailyPrice : []
  const byDate = {}
  rows.forEach(row => {
    const date = String(row.reserve_date || '').slice(0, 10)
    const price = Number(row.deal_price)
    if (!date || date < firstDate || !(price > 0)) return
    if (byDate[date] === undefined) byDate[date] = price
  })
  return Object.keys(byDate).sort().map(date => ({ date, price: byDate[date] }))
}

function fmtPrice(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

// products: GetProductsByResort 的返回；返回按首页顺序排好的分组，没有任何可订日期的商品和分组不出现
function buildGroups(products, now) {
  const groups = {}
  ;(Array.isArray(products) ? products : []).forEach(item => {
    const parsed = parseProductName(item.name)
    const prices = bookablePrices(item, firstBookableDate(parsed.session, now))
    if (!prices.length) return
    const key = groupKey(parsed)
    if (!groups[key]) {
      groups[key] = { key, title: groupTitle(parsed), rank: groupRank(parsed), products: [] }
    }
    const minPrice = Math.min.apply(null, prices.map(p => p.price))
    groups[key].products.push({
      id: item.product_id,
      name: item.name,
      gear: parsed.gear,
      variant: parsed.variant,
      gearLabel: [parsed.gear, parsed.variant].filter(Boolean).join('·') || '标准',
      session: parsed.session,
      // 订票和查余额都按商品自己的自我游账号走（万龙自我游 / 大好河山）
      source: item.source || '',
      prices,
      minPrice,
      minPriceStr: fmtPrice(minPrice)
    })
  })
  return Object.keys(groups).map(key => {
    const g = groups[key]
    g.products.sort((a, b) => gearRank(a.gear) - gearRank(b.gear) || a.minPrice - b.minPrice || a.id - b.id)
    g.minPrice = Math.min.apply(null, g.products.map(p => p.minPrice))
    g.minPriceStr = fmtPrice(g.minPrice)
    g.gearCount = g.products.length
    g.subtitle = g.gearCount > 1 ? g.gearCount + ' 种装备' : g.products[0].gearLabel
    return g
  }).sort((a, b) => a.rank - b.rank || (a.title < b.title ? -1 : 1))
}

function findGroup(groups, key) {
  return groups.find(g => g.key === key) || null
}

function findGroupByProductId(groups, id) {
  return groups.find(g => g.products.some(p => String(p.id) === String(id))) || null
}

module.exports = {
  parseProductName,
  groupKey,
  groupTitle,
  firstBookableDate,
  bookablePrices,
  buildGroups,
  findGroup,
  findGroupByProductId,
  fmtPrice,
  localDateStr
}
