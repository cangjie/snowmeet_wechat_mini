// 订单详情里的「介绍人分账」组件：店长以上可见；不能设置时只显示原因；能设置时预填金额、保存、删除；服务端拒绝时显示原因。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const api = require('../utils/introducer_api.js')
const { loadComponent, settle, tap } = require('./reception_harness.js')

const PREFIX = 'https://x/api/'
const OK = data => ({ code: 0, message: '', data })
const ERR = (code, message) => ({ code, message, data: null })

const SHARE = over => Object.assign({ orderShareId: 31, introducerId: 7, name: '示例·李教练', type: '教练', amount: 86, state: '待自动分账', memo: null }, over)

function setup(t, { handler, staff, modalConfirm }) {
  const previous = { wx: global.wx, getApp: global.getApp }
  const calls = [], toasts = [], modals = []
  api.setTransport(options => {
    const [pathPart, query] = options.url.replace(PREFIX, '').split('?')
    const [controller, action] = pathPart.split('/')
    const params = {}
    ;(query || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[k] = decodeURIComponent(v) })
    calls.push({ controller, action, method: options.method, params, body: options.data })
    setImmediate(() => options.success({ statusCode: 200, data: handler(controller, action, params, options.data) }))
  })
  global.wx = {
    showToast(o) { toasts.push(o.title) },
    showModal(o) { modals.push(o.title); setImmediate(() => o.success && o.success({ confirm: modalConfirm !== false })) }
  }
  global.getApp = () => ({ globalData: { staff, sessionKey: 'sk%2B1', requestPrefix: PREFIX } })
  t.after(() => {
    global.wx = previous.wx
    global.getApp = previous.getApp
    api.setTransport(function (options) { wx.request(options) })
  })
  return { calls, toasts, modals }
}

const MANAGER = { valid: 1, title_level: 200 }
const FILE = 'components/share/order_share_editor/order_share_editor.js'

test('店员（职级 100）看不到，也不发请求', async t => {
  const env = setup(t, { staff: { valid: 1, title_level: 100 }, handler: () => OK({}) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.hidden, true)
  assert.equal(env.calls.length, 0)
})

test('不能设置时只显示原因，不请求介绍人名单', async t => {
  const env = setup(t, {
    staff: MANAGER,
    handler: (c, a) => OK({ canEdit: false, reason: '该订单还没有关单', suggested: 0, shares: [] })
  })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.hidden, false)
  assert.equal(comp.data.canEdit, false)
  assert.equal(comp.data.reason, '该订单还没有关单')
  assert.deepEqual(env.calls.map(c => c.action), ['GetOrderShares'])
  assert.equal(env.calls[0].params.orderId, '123')
})

test('能设置：预填金额、选择介绍人、保存请求体、刷新列表', async t => {
  let shares = []
  const env = setup(t, {
    staff: MANAGER,
    handler: (c, a, params, body) => {
      if (a === 'GetOrderShares') return OK({ canEdit: true, reason: null, suggested: 86, shares })
      if (a === 'ListChoices') return OK({ choices: [{ id: 7, name: '示例·李教练', type: '教练' }, { id: 8, name: '示例·小王', type: 'KOL' }] })
      shares = [SHARE({ amount: body.amount })]
      return OK({ shares })
    }
  })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.form.amount, '86')
  assert.equal(comp.data.choices.length, 2)

  await comp.onSave()
  assert.equal(env.toasts.pop(), '请先选择介绍人')

  comp.onPick(tap({ id: 7 }))
  comp.onAmount({ detail: { value: '86' } })
  await comp.onSave()
  const call = env.calls.find(c => c.action === 'SetShare')
  assert.equal(call.method, 'POST')
  assert.deepEqual(call.body, { orderId: 123, introducerId: 7, amount: 86, memo: '' })
  assert.equal(comp.data.shares.length, 1)
  assert.equal(comp.data.shares[0].stateClass, 'blue')
  assert.equal(comp.data.shares[0].removable, true)
  assert.equal(comp.data.form.introducerId, '')
})

test('金额不对不请求；服务端拒绝时显示它给的原因', async t => {
  const env = setup(t, {
    staff: MANAGER,
    handler: (c, a) => {
      if (a === 'GetOrderShares') return OK({ canEdit: true, reason: null, suggested: 0, shares: [] })
      if (a === 'ListChoices') return OK({ choices: [{ id: 7, name: '示例·李教练', type: '教练' }] })
      return ERR(1, '分账合计不能超过实收扣掉已退款')
    }
  })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.form.amount, '')   // 没有默认值时不预填
  comp.onPick(tap({ id: 7 }))
  comp.onAmount({ detail: { value: '0' } })
  await comp.onSave()
  assert.equal(env.toasts.pop(), '请填写大于 0 的金额')
  assert.equal(env.calls.filter(c => c.action === 'SetShare').length, 0)

  comp.onAmount({ detail: { value: '9999' } })
  await comp.onSave()
  assert.equal(env.toasts.pop(), '分账合计不能超过实收扣掉已退款')
})

test('删除先确认；已分账、被拒绝的不能删', async t => {
  let shares = [SHARE({ orderShareId: 31 }), SHARE({ orderShareId: 32, state: '已分账' }), SHARE({ orderShareId: 33, state: '被拒绝' })]
  const env = setup(t, {
    staff: MANAGER,
    handler: (c, a) => {
      if (a === 'GetOrderShares') return OK({ canEdit: true, reason: null, suggested: 0, shares })
      if (a === 'ListChoices') return OK({ choices: [] })
      shares = shares.filter(s => s.orderShareId !== 31)
      return OK({ shares })
    }
  })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.deepEqual(comp.data.shares.map(s => s.removable), [true, false, false])
  assert.deepEqual(comp.data.shares.map(s => s.stateClass), ['blue', 'ok', 'danger'])

  await comp.onRemove(tap({ id: 31 }))
  assert.deepEqual(env.modals, ['删除介绍人分账'])
  const call = env.calls.find(c => c.action === 'RemoveShare')
  assert.deepEqual(call.body, { orderShareId: 31 })
  assert.equal(comp.data.shares.length, 2)
})

test('租赁、养护、零售详情页都挂了组件（这一期只有租赁）', () => {
  const root = path.join(__dirname, '..')
  const read = f => fs.readFileSync(path.join(root, f), 'utf8')
  assert.match(read('pages/admin/rent/rent_order_detail/rent_order_detail.json'), /"order-share-editor": "\/components\/share\/order_share_editor\/order_share_editor"/)
  assert.match(read('pages/admin/rent/rent_order_detail/rent_order_detail.wxml'), /<order-share-editor wx:if="\{\{order\.id\}\}" order-id="\{\{order\.id\}\}"\/>/)
  assert.match(read('app.json'), /"root": "pages\/introducer"/)
})
