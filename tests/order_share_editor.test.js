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
  const calls = [], toasts = [], modals = [], navigations = []
  api.setTransport(options => {
    const [pathPart, query] = options.url.replace(PREFIX, '').split('?')
    const [controller, action] = pathPart.split('/')
    const params = {}
    ;(query || '').split('&').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); params[k] = decodeURIComponent(v) })
    calls.push({ controller, action, method: options.method, params, body: options.data })
    const data = handler(controller, action, params, options.data)
    // handler 返回 { __status: 404 } 模拟接口不存在（新版小程序先于后端上线）
    setImmediate(() => options.success(data && data.__status ? { statusCode: data.__status, data: {} } : { statusCode: 200, data }))
  })
  global.wx = {
    showToast(o) { toasts.push(o.title) },
    showModal(o) { modals.push(o.title); setImmediate(() => o.success && o.success({ confirm: modalConfirm !== false })) },
    navigateTo(o) { navigations.push(o.url) }
  }
  global.getApp = () => ({ globalData: { staff, sessionKey: 'sk%2B1', requestPrefix: PREFIX } })
  t.after(() => {
    global.wx = previous.wx
    global.getApp = previous.getApp
    api.setTransport(function (options) { wx.request(options) })
  })
  return { calls, toasts, modals, navigations }
}

const MANAGER = { valid: 1, title_level: 200 }
const ADMIN = { valid: 1, title_level: 300 }
const FILE = 'components/share/order_share_editor/order_share_editor.js'

test('店员（职级 100）看不到，也不发请求', async t => {
  const env = setup(t, { staff: { valid: 1, title_level: 100 }, handler: () => OK({}) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.hidden, true)
  assert.equal(env.calls.length, 0)
})

test('后端还没上线新接口（404）时：卡片静默隐藏，不弹提示', async t => {
  const env = setup(t, { staff: MANAGER, handler: () => ({ __status: 404 }) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.hidden, true)
  assert.equal(comp.data.loading, false)
  assert.deepEqual(env.toasts, [])
  assert.deepEqual(env.modals, [])
})

test('服务端明确拒绝（业务错误）时仍然提示原因', async t => {
  const env = setup(t, { staff: MANAGER, handler: () => ERR(3, '只有店长以上可以设置介绍人分账') })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.deepEqual(env.toasts, ['只有店长以上可以设置介绍人分账'])
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

  comp.onPick({ detail: { value: 0 } })
  comp.onAmount({ detail: { value: '86' } })
  await comp.onSave()
  const call = env.calls.find(c => c.action === 'SetShare')
  assert.equal(call.method, 'POST')
  assert.deepEqual(call.body, { orderId: 123, introducerId: 7, amount: 86, memo: '' })
  assert.equal(comp.data.shares.length, 1)
  assert.equal(comp.data.shares[0].stateClass, 'blue')
  assert.equal(comp.data.shares[0].removable, true)
  assert.equal(comp.data.form.introducerId, '')
  assert.equal(comp.data.form.introducerLabel, '')
  assert.equal(comp.data.summary, '已设 1 条，合计 ¥86')
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
  comp.onPick({ detail: { value: 0 } })
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

test('默认折叠，标题上的摘要是分账条数和合计；点标题展开，再点收起', async t => {
  const shares = [SHARE({ orderShareId: 31, amount: 60 }),
    SHARE({ orderShareId: 32, introducerId: 8, name: '示例·小王', type: 'KOL', amount: 46.5, state: '手动处理' })]
  setup(t, {
    staff: MANAGER,
    handler: (c, a) => a === 'GetOrderShares' ? OK({ canEdit: true, reason: null, suggested: 86, shares }) : OK({ choices: [] })
  })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.expanded, false)
  assert.equal(comp.data.summary, '已设 2 条，合计 ¥106.5')
  comp.onToggle()
  assert.equal(comp.data.expanded, true)
  comp.onToggle()
  assert.equal(comp.data.expanded, false)
})

test('还没有分账时，摘要是「未设置」', async t => {
  setup(t, { staff: MANAGER, handler: (c, a) => a === 'GetOrderShares' ? OK({ canEdit: false, reason: '该订单还没有关单', suggested: 0, shares: [] }) : OK({}) })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.summary, '未设置')
})

test('介绍人用下拉选：选项是「名称 · 类型」，选中后记下 id 和名称，保存用的是选中的那位', async t => {
  const env = setup(t, {
    staff: MANAGER,
    handler: (c, a) => {
      if (a === 'GetOrderShares') return OK({ canEdit: true, reason: null, suggested: 86, shares: [] })
      if (a === 'ListChoices') return OK({ choices: [{ id: 7, name: '示例·李教练', type: '教练' }, { id: 8, name: '示例·小王', type: 'KOL' }] })
      return OK({ shares: [SHARE({ introducerId: 8, name: '示例·小王', type: 'KOL' })] })
    }
  })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.deepEqual(comp.data.choices.map(c => c.label), ['示例·李教练 · 教练', '示例·小王 · KOL'])
  assert.equal(comp.data.form.introducerLabel, '')

  comp.onPick({ detail: { value: '1' } })   // 小程序的 picker 在不同基础库里给数字或数字字符串
  assert.equal(comp.data.form.introducerId, 8)
  assert.equal(comp.data.form.introducerLabel, '示例·小王 · KOL')
  await comp.onSave()
  assert.equal(env.calls.find(c => c.action === 'SetShare').body.introducerId, 8)
})

test('没有可选的介绍人：系统管理员能直接去添加，店长只看到提示', async t => {
  const handler = (c, a) => a === 'GetOrderShares' ? OK({ canEdit: true, reason: null, suggested: 86, shares: [] }) : OK({ choices: [] })

  const admin = setup(t, { staff: ADMIN, handler })
  const adminComp = loadComponent(FILE, {}, { orderId: 123 })
  await adminComp.load()
  assert.equal(adminComp.data.canAddIntroducer, true)
  adminComp.onGoAddIntroducer()
  assert.deepEqual(admin.navigations, ['/pages/introducer/admin/add/add'])

  setup(t, { staff: MANAGER, handler })
  const managerComp = loadComponent(FILE, {}, { orderId: 123 })
  await managerComp.load()
  assert.equal(managerComp.data.canAddIntroducer, false)
})

test('可以给不同的介绍人各设一条，未提交的每条都能单独删', async t => {
  // 这条验证原有行为：服务端按介绍人各存一条，列表里每条自己的「删除」只删自己
  let shares = []
  const env = setup(t, {
    staff: MANAGER,
    handler: (c, a, params, body) => {
      if (a === 'GetOrderShares') return OK({ canEdit: true, reason: null, suggested: 86, shares })
      if (a === 'ListChoices') return OK({ choices: [{ id: 7, name: '示例·李教练', type: '教练' }, { id: 8, name: '示例·小王', type: 'KOL' }] })
      if (a === 'SetShare') {
        const who = body.introducerId === 7 ? { name: '示例·李教练', type: '教练' } : { name: '示例·小王', type: 'KOL' }
        shares = shares.concat([SHARE(Object.assign({ orderShareId: 30 + body.introducerId, introducerId: body.introducerId, amount: body.amount }, who))])
      } else {
        shares = shares.filter(s => s.orderShareId !== body.orderShareId)
      }
      return OK({ shares })
    }
  })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  comp.onPick({ detail: { value: 0 } })
  await comp.onSave()
  comp.onPick({ detail: { value: 1 } })
  comp.onAmount({ detail: { value: '40' } })
  await comp.onSave()
  assert.deepEqual(comp.data.shares.map(s => [s.introducerId, s.amount]), [[7, 86], [8, 40]])
  assert.deepEqual(comp.data.shares.map(s => s.removable), [true, true])
  assert.equal(comp.data.summary, '已设 2 条，合计 ¥126')

  await comp.onRemove(tap({ id: 37 }))
  assert.deepEqual(env.calls.filter(c => c.action === 'RemoveShare').map(c => c.body), [{ orderShareId: 37 }])
  assert.deepEqual(comp.data.shares.map(s => s.introducerId), [8])
  assert.equal(comp.data.summary, '已设 1 条，合计 ¥40')
})

// 本地日期 yyyy-MM-dd，和后端 / date-range-picker 用同一种写法
function ymd(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = n => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

const ONE_CHOICE = { choices: [{ id: 7, name: '示例·李教练', type: '教练' }] }

test('后端给了预计分账日期：预填它、可以改，保存时带上；保存后列表里显示、表单回到预填值', async t => {
  const env = setup(t, {
    staff: MANAGER,
    handler: (c, a, params, body) => {
      if (a === 'GetOrderShares') return OK({ canEdit: true, reason: null, suggested: 86, suggestedPlanDate: ymd(1), shares: [] })
      if (a === 'ListChoices') return OK(ONE_CHOICE)
      return OK({ shares: [SHARE({ planDate: body.planDate })] })
    }
  })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.supportsPlanDate, true)
  assert.equal(comp.data.form.planDate, ymd(1))

  comp.onPick({ detail: { value: 0 } })
  comp.onPlanDate({ detail: { date: ymd(5) } })
  assert.equal(comp.data.form.planDate, ymd(5))
  await comp.onSave()
  assert.deepEqual(env.calls.find(c => c.action === 'SetShare').body, { orderId: 123, introducerId: 7, amount: 86, memo: '', planDate: ymd(5) })
  assert.equal(comp.data.shares[0].planDate, ymd(5))
  assert.equal(comp.data.form.planDate, ymd(1))
})

test('预计分账日期没选、或早于今天：不请求，提示原因', async t => {
  const env = setup(t, {
    staff: MANAGER,
    handler: (c, a) => {
      if (a === 'GetOrderShares') return OK({ canEdit: true, reason: null, suggested: 86, suggestedPlanDate: ymd(1), shares: [] })
      return OK(ONE_CHOICE)
    }
  })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  comp.onPick({ detail: { value: 0 } })

  comp.onPlanDate({ detail: { date: '' } })
  await comp.onSave()
  assert.equal(env.toasts.pop(), '请选择预计分账日期')
  comp.onPlanDate({ detail: { date: ymd(-1) } })
  await comp.onSave()
  assert.equal(env.toasts.pop(), '预计分账日期不能早于今天')
  assert.equal(env.calls.filter(c => c.action === 'SetShare').length, 0)

  comp.onPlanDate({ detail: { date: ymd(0) } })   // 今天可以
  await comp.onSave()
  assert.equal(env.calls.filter(c => c.action === 'SetShare').length, 1)
})

test('后端还不认预计分账日期（没给 suggestedPlanDate）：不显示日期，保存也不带', async t => {
  const env = setup(t, {
    staff: MANAGER,
    handler: (c, a) => {
      if (a === 'GetOrderShares') return OK({ canEdit: true, reason: null, suggested: 86, shares: [] })
      if (a === 'ListChoices') return OK(ONE_CHOICE)
      return OK({ shares: [SHARE()] })
    }
  })
  const comp = loadComponent(FILE, {}, { orderId: 123 })
  await comp.load()
  assert.equal(comp.data.supportsPlanDate, false)
  comp.onPick({ detail: { value: 0 } })
  await comp.onSave()
  assert.equal('planDate' in env.calls.find(c => c.action === 'SetShare').body, false)
})

test('界面结构：预计分账日期用统一的日期选择控件，列表每条显示它', () => {
  const dir = path.join(__dirname, '..', 'components/share/order_share_editor')
  const wxml = fs.readFileSync(path.join(dir, 'order_share_editor.wxml'), 'utf8')
  const json = JSON.parse(fs.readFileSync(path.join(dir, 'order_share_editor.json'), 'utf8'))
  assert.equal(json.usingComponents['date-range-picker'], '/components/date-range-picker/index')
  assert.match(wxml, /<date-range-picker[^>]*mode="single"[^>]*allow-future[^>]*date="\{\{form\.planDate\}\}"[^>]*bind:change="onPlanDate"/)
  assert.match(wxml, /wx:if="\{\{supportsPlanDate\}\}"/)
  assert.match(wxml, /wx:if="\{\{item\.planDate\}\}"[^>]*>预计分账：\{\{item\.planDate\}\}/)
  assert.doesNotMatch(wxml, /mode="date"/)   // 全站禁用原生日期 picker
})

test('界面结构：标题可点折叠，表单在展开后才出现，介绍人是下拉，没有介绍人时有「去添加」入口', () => {
  const wxml = fs.readFileSync(path.join(__dirname, '..', 'components/share/order_share_editor/order_share_editor.wxml'), 'utf8')
  assert.match(wxml, /class="ose-head"[^>]*bindtap="onToggle"/)
  assert.match(wxml, /wx:if="\{\{expanded\}\}"/)
  assert.match(wxml, /<picker[^>]*range="\{\{choices\}\}"[^>]*range-key="label"[^>]*bindchange="onPick"/)
  assert.match(wxml, /bindtap="onGoAddIntroducer"/)
  // 金额、备注、保存只在有可选介绍人时出现；没有时走 wx:else（提示和「去添加」）
  assert.match(wxml, /<block wx:if="\{\{choices\.length\}\}">[\s\S]*bindinput="onAmount"[\s\S]*bindtap="onSave"[\s\S]*<\/block>\s*<block wx:else>[\s\S]*bindtap="onGoAddIntroducer"/)
})

test('租赁、养护、零售详情页都挂了组件（这一期只有租赁）', () => {
  const root = path.join(__dirname, '..')
  const read = f => fs.readFileSync(path.join(root, f), 'utf8')
  assert.match(read('pages/admin/rent/rent_order_detail/rent_order_detail.json'), /"order-share-editor": "\/components\/share\/order_share_editor\/order_share_editor"/)
  assert.match(read('pages/admin/rent/rent_order_detail/rent_order_detail.wxml'), /<order-share-editor wx:if="\{\{order\.id\}\}" order-id="\{\{order\.id\}\}"\/>/)
  assert.match(read('app.json'), /"root": "pages\/introducer"/)
})
