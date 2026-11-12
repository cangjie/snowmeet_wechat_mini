// 雪票购物车：票种、日期、手机号相同的合并成一条；合计金额；最多 10 张；结算请求体。
const test = require('node:test')
const assert = require('node:assert/strict')
const c = require('../utils/skipass_cart.js')

const item = (over) => Object.assign({ productId: 641, title: '4小时日场', date: '2026-11-03', cell: '13501177897', name: '张三', price: 309, source: '大好河山' }, over || {})

test('加入购物车：票种、日期、手机号相同的合并成一条并累加张数', () => {
  let r = c.addItem(c.emptyCart(), item())
  r = c.addItem(r.cart, item())
  r = c.addItem(r.cart, item({ date: '2026-11-04' }))
  r = c.addItem(r.cart, item({ cell: '13900139000' }))
  r = c.addItem(r.cart, item({ productId: 643, price: 359 }))
  assert.equal(r.cart.items.length, 4)
  assert.deepEqual(r.cart.items.map(x => x.count), [2, 1, 1, 1])
  assert.equal(c.ticketCount(r.cart), 5)
  assert.equal(c.total(r.cart), 309 * 4 + 359)
  assert.equal(c.fmtMoney(c.total(r.cart)), '¥1595.00')
})

test('同一手机号姓名不同：合并到第一次的姓名', () => {
  let r = c.addItem(c.emptyCart(), item({ name: '张三' }))
  r = c.addItem(r.cart, item({ name: '李四' }))
  assert.equal(r.cart.items.length, 1)
  assert.equal(r.cart.items[0].name, '张三')
})

test('手机号两端的空格不影响合并', () => {
  let r = c.addItem(c.emptyCart(), item({ cell: ' 13501177897 ' }))
  r = c.addItem(r.cart, item())
  assert.equal(r.cart.items.length, 1)
  assert.equal(r.cart.items[0].count, 2)
})

test('最多 10 张：超过不加，原车不变', () => {
  let r = c.addItem(c.emptyCart(), item(), 10)
  assert.equal(c.ticketCount(r.cart), 10)
  const over = c.addItem(r.cart, item({ date: '2026-11-05' }))
  assert.match(over.error, /最多 10 张/)
  assert.equal(c.ticketCount(over.cart), 10)
  assert.equal(over.cart.items.length, 1)
  const plus = c.changeCount(r.cart, r.cart.items[0].key, 1)
  assert.match(plus.error, /最多 10 张/)
  assert.equal(plus.cart.items[0].count, 10)
})

test('加减张数：减到 0 删掉这一条；删除整条', () => {
  let r = c.addItem(c.emptyCart(), item(), 2)
  r = c.addItem(r.cart, item({ date: '2026-11-04' }))
  const key = r.cart.items[0].key
  let dec = c.changeCount(r.cart, key, -1)
  assert.equal(dec.cart.items[0].count, 1)
  dec = c.changeCount(dec.cart, key, -1)
  assert.deepEqual(dec.cart.items.map(x => x.date), ['2026-11-04'])
  assert.deepEqual(c.remove(dec.cart, dec.cart.items[0].key).items, [])
})

test('原购物车对象不被修改', () => {
  const cart = c.addItem(c.emptyCart(), item()).cart
  const before = JSON.stringify(cart)
  c.addItem(cart, item())
  c.changeCount(cart, cart.items[0].key, 1)
  c.remove(cart, cart.items[0].key)
  assert.equal(JSON.stringify(cart), before)
})

test('结算请求体：只带商品、日期、手机号、姓名、张数和推荐店员', () => {
  let r = c.addItem(c.emptyCart(), item({ staffId: '28' }), 2)
  r = c.addItem(r.cart, item({ productId: 643, cell: '13900139000', name: '李四' }))
  assert.deepEqual(c.toRequest(r.cart), {
    staffId: 28,
    items: [
      { productId: 641, date: '2026-11-03', cell: '13501177897', name: '张三', count: 2 },
      { productId: 643, date: '2026-11-03', cell: '13900139000', name: '李四', count: 1 }
    ]
  })
  assert.equal(c.toRequest(c.emptyCart()).staffId, null)
})

test('本机存取：读不到或坏数据当空车', () => {
  global.wx = { getStorageSync() { throw new Error('denied') }, setStorageSync() { throw new Error('denied') } }
  assert.deepEqual(c.load(), c.emptyCart())
  assert.doesNotThrow(() => c.save(c.emptyCart()))
  const store = {}
  global.wx = { getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v } }
  assert.deepEqual(c.load(), c.emptyCart())
  const cart = c.addItem(c.emptyCart(), item()).cart
  c.save(cart)
  assert.deepEqual(c.load(), cart)
  store[c.STORAGE_KEY] = { items: 'oops' }
  assert.deepEqual(c.load(), c.emptyCart())
  delete global.wx
})

test('改一条的日期：价格换成新日期的，原条目的张数和姓名不变', () => {
  let r = c.addItem(c.emptyCart(), item(), 2)
  const key = r.cart.items[0].key
  const e = c.editLine(r.cart, key, { date: '2026-11-07', price: 369 })
  assert.equal(e.error, '')
  assert.deepEqual([e.cart.items.length, e.cart.items[0].date, e.cart.items[0].price, e.cart.items[0].count, e.cart.items[0].name], [1, '2026-11-07', 369, 2, '张三'])
  assert.equal(e.cart.items[0].key, c.lineKey(641, '2026-11-07', '13501177897'))
  assert.equal(c.total(e.cart), 738)
})

test('改日期或手机号后和别的条目相同：合并张数，价格取新的，顺序其余不变', () => {
  let r = c.addItem(c.emptyCart(), item(), 2)
  r = c.addItem(r.cart, item({ date: '2026-11-04' }), 1)
  r = c.addItem(r.cart, item({ productId: 643, price: 359 }), 1)
  const e = c.editLine(r.cart, r.cart.items[0].key, { date: '2026-11-04', price: 309 })
  assert.deepEqual(e.cart.items.map(x => [x.productId, x.date, x.count]), [[641, '2026-11-04', 3], [643, '2026-11-03', 1]])
  assert.equal(c.ticketCount(e.cart), 4)
})

test('改手机号：不合法不改；合法的去掉空格；找不到的条目原样返回', () => {
  const r = c.addItem(c.emptyCart(), item(), 1)
  const key = r.cart.items[0].key
  const bad = c.editLine(r.cart, key, { cell: '123' })
  assert.equal(bad.error, '请填写正确的手机号')
  assert.equal(bad.cart.items[0].cell, '13501177897')
  const ok = c.editLine(r.cart, key, { cell: ' 13900139000 ' })
  assert.equal(ok.cart.items[0].cell, '13900139000')
  assert.equal(ok.cart.items[0].key, c.lineKey(641, '2026-11-03', '13900139000'))
  assert.equal(c.editLine(r.cart, 'nope', { cell: '13900139000' }).cart, r.cart)
})

test('编辑不修改原购物车对象；新加的条目记下雪场', () => {
  const r = c.addItem(c.emptyCart(), item({ resort: '万龙' }), 1)
  const before = JSON.stringify(r.cart)
  c.editLine(r.cart, r.cart.items[0].key, { date: '2026-11-07', price: 369 })
  assert.equal(JSON.stringify(r.cart), before)
  assert.equal(r.cart.items[0].resort, '万龙')
  assert.equal(c.addItem(c.emptyCart(), item(), 1).cart.items[0].resort, '万龙') // 没传默认万龙
})
