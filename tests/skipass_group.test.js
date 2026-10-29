// 万龙雪票商品分组：首页按「时长 + 场次」分组，详情页再选装备。
// 商品名取自生产库 25-26 雪季的真实万龙雪票；26-27 上架后命名若变，认不出的会进「其他」而不是丢掉。
const test = require('node:test')
const assert = require('node:assert/strict')
const g = require('../utils/skipass_group.js')

// 2026-11-02 周一 10:00
const MORNING = new Date(2026, 10, 2, 10, 0, 0)

function product(id, name, rows) {
  return {
    product_id: id,
    name,
    dailyPrice: rows.map(([date, price]) => ({ reserve_date: date + 'T00:00:00', deal_price: price }))
  }
}

const NOV = [['2026-11-02', 399], ['2026-11-03', 399], ['2026-11-07', 479]]

test('解析 25-26 真实商品名：时长、场次、装备', () => {
  const cases = [
    ['【25-26雪季】1.5天日场自带板滑雪票', { duration: '1.5天', session: '日场', gear: '自带板' }],
    ['【25-26雪季】1天日场含全套雪具滑雪票', { duration: '1天', session: '日场', gear: '含全套雪具' }],
    ['【25-26雪季】1天日场含雪具滑雪票', { duration: '1天', session: '日场', gear: '含雪具' }],
    ['【25-26雪季】4小时日场自带板滑雪票', { duration: '4小时', session: '日场', gear: '自带板' }],
    ['【25-26雪季】6小时日场含雪具滑雪票', { duration: '6小时', session: '日场', gear: '含雪具' }],
    ['【25-26雪季】2天日场含全套雪具滑雪票', { duration: '2天', session: '日场', gear: '含全套雪具' }],
    ['【25-26雪季】夜场自带板滑雪票', { duration: '', session: '夜场', gear: '自带板' }],
    ['【25-26雪季】夜场含雪具头盔滑雪票', { duration: '', session: '夜场', gear: '含雪具头盔' }],
    ['【万龙】全雪区日场4小时雪票(含雪具)', { duration: '4小时', session: '日场', gear: '含雪具' }],
    ['【万龙】全雪区下午场+夜场滑雪票-11.6', { duration: '', session: '午连夜', gear: '' }]
  ]
  cases.forEach(([name, expect]) => {
    const p = g.parseProductName(name)
    assert.equal(p.duration, expect.duration, name)
    assert.equal(p.session, expect.session, name)
    assert.equal(p.gear, expect.gear, name)
    assert.equal(p.holiday, false, name)
  })
})

test('节日专享、午连夜、魔毯区、次卡、不含雪具', () => {
  let p = g.parseProductName('【25-26雪季节日专享】1.5天含雪具套票')
  assert.deepEqual([p.holiday, p.duration, p.session, p.gear], [true, '1.5天', '日场', '含雪具'])
  p = g.parseProductName('【25-26雪季节日专享】午连夜自带板雪票')
  assert.deepEqual([p.holiday, p.session, p.gear], [true, '午连夜', '自带板'])
  p = g.parseProductName('【25-26雪季】夜场新手含全套装备魔毯滑雪票')
  assert.deepEqual([p.area, p.session, p.gear], ['魔毯区', '夜场', '含全套雪具'])
  p = g.parseProductName('【万龙预售2026-27】夜场3次卡(不含雪具)限平日使用')
  assert.deepEqual([p.times, p.session, p.gear], ['3', '夜场', '不含雪具'])
})

test('分组标题和键', () => {
  const title = n => g.groupTitle(g.parseProductName(n))
  assert.equal(title('【25-26雪季】1天日场自带板滑雪票'), '1天日场')
  assert.equal(title('【25-26雪季】4小时日场含雪具滑雪票'), '4小时日场')
  assert.equal(title('【25-26雪季】夜场自带板滑雪票'), '夜场')
  assert.equal(title('【25-26雪季节日专享】午连夜自带板雪票'), '节日专享·午连夜')
  assert.equal(title('【25-26雪季节日专享】1.5天含雪具套票'), '节日专享·1.5天日场')
  assert.equal(title('【25-26雪季】夜场新手含全套装备魔毯滑雪票'), '魔毯区·夜场')
  assert.equal(title('【万龙预售2026-27】夜场3次卡(不含雪具)限平日使用'), '3次卡·夜场')
  // 同一时长场次、不同装备同组
  const k = n => g.groupKey(g.parseProductName(n))
  assert.equal(k('【25-26雪季】1天日场自带板滑雪票'), k('【25-26雪季】1天日场含全套雪具滑雪票'))
  assert.notEqual(k('【25-26雪季】1天日场自带板滑雪票'), k('【25-26雪季节日专享】1天自带板雪票'))
})

test('认不出场次和时长的商品归「其他」，不丢', () => {
  const groups = g.buildGroups([
    product(1, '万龙纪念徽章', NOV),
    product(2, '【25-26雪季】1天日场自带板滑雪票', NOV)
  ], MORNING)
  assert.deepEqual(groups.map(x => x.title), ['1天日场', '其他'])
  assert.equal(groups[1].key, 'other')
  assert.equal(groups[1].products[0].id, 1)
})

test('首页顺序：日场按时长，再夜场、午连夜，再节日专享，魔毯区，其他', () => {
  const groups = g.buildGroups([
    product(1, '万龙纪念徽章', NOV),
    product(2, '【25-26雪季】夜场魔毯区自带板滑雪票', NOV),
    product(3, '【25-26雪季节日专享】1天自带板雪票', NOV),
    product(4, '【25-26雪季】午连夜自带板雪票', NOV),
    product(5, '【25-26雪季】夜场自带板滑雪票', NOV),
    product(6, '【25-26雪季】2天日场自带板滑雪票', NOV),
    product(7, '【25-26雪季】1.5天日场自带板滑雪票', NOV),
    product(8, '【25-26雪季】1天日场自带板滑雪票', NOV),
    product(9, '【25-26雪季】6小时日场自带板滑雪票', NOV),
    product(10, '【25-26雪季】4小时日场自带板滑雪票', NOV)
  ], MORNING)
  assert.deepEqual(groups.map(x => x.title), [
    '4小时日场', '6小时日场', '1天日场', '1.5天日场', '2天日场',
    '夜场', '午连夜', '节日专享·1天日场', '魔毯区·夜场', '其他'
  ])
})

test('同组多种装备：自带板在前，最低价取各装备里最低的，副标题写装备数', () => {
  const groups = g.buildGroups([
    product(31, '【25-26雪季】1天日场含全套雪具滑雪票', [['2026-11-02', 659], ['2026-11-07', 739]]),
    product(32, '【25-26雪季】1天日场自带板滑雪票', NOV),
    product(33, '【25-26雪季】1天日场含雪具滑雪票', [['2026-11-02', 579]])
  ], MORNING)
  assert.equal(groups.length, 1)
  const grp = groups[0]
  assert.deepEqual(grp.products.map(p => p.gear), ['自带板', '含雪具', '含全套雪具'])
  assert.equal(grp.minPrice, 399)
  assert.equal(grp.minPriceStr, '399')
  assert.equal(grp.gearCount, 3)
  assert.equal(grp.subtitle, '3 种装备')
  assert.deepEqual(grp.products[0].prices.map(p => p.date), ['2026-11-02', '2026-11-03', '2026-11-07'])
})

test('只有一种装备时副标题写装备名；没写装备的叫「标准」', () => {
  let groups = g.buildGroups([product(1, '【25-26雪季】夜场自带板滑雪票', NOV)], MORNING)
  assert.equal(groups[0].subtitle, '自带板')
  groups = g.buildGroups([product(2, '【万龙】全雪区下午场+夜场滑雪票-11.6', NOV)], MORNING)
  assert.equal(groups[0].subtitle, '标准')
})

test('过去的日期、0 元和没有价格的商品不算；整组没价格就不出现', () => {
  const groups = g.buildGroups([
    product(1, '【25-26雪季】1天日场自带板滑雪票', [['2026-11-01', 399], ['2026-11-02', 0], ['2026-11-04', 459]]),
    product(2, '【25-26雪季】4小时日场自带板滑雪票', [['2026-10-30', 319]]),
    product(3, '【25-26雪季】6小时日场自带板滑雪票', [])
  ], MORNING)
  assert.deepEqual(groups.map(x => x.title), ['1天日场'])
  assert.deepEqual(groups[0].products[0].prices, [{ date: '2026-11-04', price: 459 }])
  assert.deepEqual(g.buildGroups(null, MORNING), [])
  assert.deepEqual(g.buildGroups([{ product_id: 9, name: '【25-26雪季】1天日场自带板滑雪票' }], MORNING), [])
})

test('同一天有重复价格行（历史遗留）只取第一行', () => {
  const groups = g.buildGroups([
    product(1, '【25-26雪季】1天日场自带板滑雪票', [['2026-11-04', 459], ['2026-11-04', 459], ['2026-11-05', 399]])
  ], MORNING)
  assert.deepEqual(groups[0].products[0].prices.map(p => p.date), ['2026-11-04', '2026-11-05'])
})

test('日场 14 点后、夜场 20 点后，当天不可订', () => {
  const rows = [['2026-11-02', 399], ['2026-11-03', 419]]
  const day = n => g.buildGroups([product(1, '【25-26雪季】1天日场自带板滑雪票', rows)], n)[0].products[0].prices[0].date
  const night = n => g.buildGroups([product(1, '【25-26雪季】夜场自带板滑雪票', rows)], n)[0].products[0].prices[0].date
  assert.equal(day(new Date(2026, 10, 2, 13, 59)), '2026-11-02')
  assert.equal(day(new Date(2026, 10, 2, 14, 0)), '2026-11-03')
  assert.equal(night(new Date(2026, 10, 2, 15, 0)), '2026-11-02')
  assert.equal(night(new Date(2026, 10, 2, 19, 59)), '2026-11-02')
  assert.equal(night(new Date(2026, 10, 2, 20, 0)), '2026-11-03')
  assert.equal(g.firstBookableDate('日场', new Date(2026, 11, 31, 15, 0)), '2027-01-01')
})

test('价格显示：整数不带小数，有小数保留两位', () => {
  assert.equal(g.fmtPrice(399), '399')
  assert.equal(g.fmtPrice(371.07), '371.07')
  assert.equal(g.fmtPrice(371.5), '371.50')
})

test('按键和商品 id 找分组（旧链接只带 id）', () => {
  const groups = g.buildGroups([
    product(41, '【25-26雪季】1天日场自带板滑雪票', NOV),
    product(42, '【25-26雪季】夜场自带板滑雪票', NOV)
  ], MORNING)
  assert.equal(g.findGroup(groups, groups[1].key).title, '夜场')
  assert.equal(g.findGroup(groups, 'nope'), null)
  assert.equal(g.findGroupByProductId(groups, '42').title, '夜场')
  assert.equal(g.findGroupByProductId(groups, 42).title, '夜场')
  assert.equal(g.findGroupByProductId(groups, 999), null)
})

// ---------------- 万龙试营业的票（大好河山账号，名字没有「自带板」，带 -11.6 之类的尾巴） ----------------

const TRIAL = [
  ['37704608', '【万龙】全雪区日场4小时雪票-11.6', '4小时日场', '不含雪具'],
  ['38256099', '【万龙】全雪区日场4小时雪票(含雪具)-11.6', '4小时日场', '含雪具'],
  ['37704807', '【万龙】全雪区日场4小时雪票(含全套装备)-11.6', '4小时日场', '含全套雪具'],
  ['37704610', '【万龙】全雪区日场6小时雪票-11.6', '6小时日场', '不含雪具'],
  ['37704649', '【万龙】全雪区日场1天雪票-11.6', '1天日场', '不含雪具'],
  ['38256129', '【万龙】全雪区日场1天雪票(含雪具)-11.6', '1天日场', '含雪具'],
  ['37704812', '【万龙】全雪区日场1天雪票(含全套装备)-11.6', '1天日场', '含全套雪具'],
  ['37704651', '【万龙】全雪区日场1.5天雪票-11.5', '1.5天日场', '不含雪具'],
  ['37704655', '【万龙】全雪区日场2天雪票-11.5', '2天日场', '不含雪具'],
  ['37942521', '【万龙】全雪区下午场+夜场滑雪票-11.6', '午连夜', '']
]

test('试营业的票：没写装备的就是不含雪具，括号里的含雪具、含全套装备照常识别', () => {
  TRIAL.forEach(([, name, title, gear]) => {
    const p = g.parseProductName(name)
    assert.equal(g.groupTitle(p), title, name)
    assert.equal(p.gear, gear, name)
  })
})

test('预售次卡：同一装备下用「限平日」「全雪季通用」「平日使用」「周末使用」区分', () => {
  const v = n => g.parseProductName(n).variant
  assert.equal(v('【万龙预售2026-27】夜场3次卡(不含雪具)限平日使用'), '限平日使用')
  assert.equal(v('【万龙预售2026-27】夜场3次卡(不含雪具)全雪季通用'), '全雪季通用')
  assert.equal(v('【万龙预售2026-27】11月日场3次卡(不含雪具)平日使用'), '平日使用')
  assert.equal(v('【万龙预售2026-27】11月日场3次卡(不含雪具)周末使用'), '周末使用')
  assert.equal(v('【万龙】全雪区日场1天雪票-11.6'), '')
})

test('试营业 16 个票 + 4 个预售次卡：分组、顺序、装备选项、来源', () => {
  const rows = [['2026-11-02', 399], ['2026-11-03', 399]]
  const trial = TRIAL.map(([no, name], i) => ({ ...product(100 + i, name, rows), source: '大好河山', third_party_no: no }))
  const cards = [
    '【万龙预售2026-27】夜场3次卡(不含雪具)限平日使用',
    '【万龙预售2026-27】夜场3次卡(不含雪具)全雪季通用',
    '【万龙预售2026-27】11月日场3次卡(不含雪具)平日使用',
    '【万龙预售2026-27】11月日场3次卡(不含雪具)周末使用'
  ].map((name, i) => ({ ...product(200 + i, name, rows), source: '大好河山' }))
  const groups = g.buildGroups(trial.concat(cards), MORNING)
  assert.deepEqual(groups.map(x => x.title), [
    '4小时日场', '6小时日场', '1天日场', '1.5天日场', '2天日场', '午连夜', '3次卡·日场', '3次卡·夜场'
  ])
  const oneDay = groups.find(x => x.title === '1天日场')
  assert.deepEqual(oneDay.products.map(p => p.gearLabel), ['不含雪具', '含雪具', '含全套雪具'])
  assert.ok(oneDay.products.every(p => p.source === '大好河山'))
  const night = groups.find(x => x.title === '3次卡·夜场')
  assert.deepEqual(night.products.map(p => p.gearLabel).sort(), ['不含雪具·全雪季通用', '不含雪具·限平日使用'])
  assert.equal(night.subtitle, '2 种装备')
  assert.equal(groups.find(x => x.title === '午连夜').products[0].gearLabel, '标准')
})
