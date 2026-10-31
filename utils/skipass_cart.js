// 雪票购物车（只给店员用，存在本机）。
// 一条 = 票种 + 游玩日期 + 接收短信的手机号，相同的合并成一条、张数累加（供应商一单只能 1 张，
// 结算时后端按张数拆成一张一单）。价格只用来显示，后端结算时按当天价格行重新算。
const STORAGE_KEY = 'skipass_cart_v1'
const MAX_TICKETS = 10

function emptyCart() {
  return { items: [], staffId: '' }
}

function lineKey(productId, date, cell) {
  return [productId, date, String(cell || '').trim()].join('|')
}

function load() {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY)
    if (stored && Array.isArray(stored.items)) {
      return { items: stored.items.filter(it => it && it.count > 0), staffId: stored.staffId || '' }
    }
  } catch (e) {
    // 读不到就当空车
  }
  return emptyCart()
}

function save(cart) {
  try {
    wx.setStorageSync(STORAGE_KEY, cart)
  } catch (e) {
    // 存不上不影响本次使用
  }
}

function ticketCount(cart) {
  return cart.items.reduce((n, it) => n + it.count, 0)
}

function total(cart) {
  const sum = cart.items.reduce((s, it) => s + it.price * it.count, 0)
  return Math.round(sum * 100) / 100
}

// item: { productId, title, date, cell, name, price, source }；返回 { cart, error }，出错时 cart 原样不变
function addItem(cart, item, count) {
  const n = count || 1
  if (ticketCount(cart) + n > MAX_TICKETS) {
    return { cart, error: '购物车最多 ' + MAX_TICKETS + ' 张票' }
  }
  const key = lineKey(item.productId, item.date, item.cell)
  const items = cart.items.map(it => Object.assign({}, it))
  const hit = items.find(it => it.key === key)
  if (hit) {
    hit.count += n
  } else {
    items.push({
      key, productId: item.productId, title: item.title, date: item.date, cell: String(item.cell).trim(),
      name: item.name, price: item.price, source: item.source || '', count: n
    })
  }
  return { cart: { items, staffId: item.staffId || cart.staffId || '' }, error: '' }
}

// delta 为 +1 / -1；减到 0 就删掉这一条；超过上限的加一返回原车
function changeCount(cart, key, delta) {
  const hit = cart.items.find(it => it.key === key)
  if (!hit) return { cart, error: '' }
  if (delta > 0 && ticketCount(cart) + delta > MAX_TICKETS) {
    return { cart, error: '购物车最多 ' + MAX_TICKETS + ' 张票' }
  }
  const items = cart.items
    .map(it => it.key === key ? Object.assign({}, it, { count: it.count + delta }) : Object.assign({}, it))
    .filter(it => it.count > 0)
  return { cart: { items, staffId: cart.staffId }, error: '' }
}

function remove(cart, key) {
  return { items: cart.items.filter(it => it.key !== key).map(it => Object.assign({}, it)), staffId: cart.staffId }
}

// 结算请求体：后端只认商品、日期、手机号、姓名、张数
function toRequest(cart) {
  return {
    staffId: cart.staffId ? Number(cart.staffId) : null,
    items: cart.items.map(it => ({ productId: it.productId, date: it.date, cell: it.cell, name: it.name, count: it.count }))
  }
}

function fmtMoney(n) {
  return '¥' + (Math.round(n * 100) / 100).toFixed(2)
}

module.exports = {
  STORAGE_KEY, MAX_TICKETS, emptyCart, lineKey, load, save, ticketCount, total, addItem, changeCount, remove, toRequest, fmtMoney
}
