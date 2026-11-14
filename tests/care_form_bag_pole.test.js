// 养护开单：装备类型（双板 / 单板）右边的「含包」「含杖」两个勾选。
//   · 二选一：点含包自动取消含杖、点含杖自动取消含包，再点一下取消，也可以都不选（不可能既含包又含杖）；
//   · 单板没有雪杖：选单板时含杖取消勾选并置灰、点了没用；单板可以含包；
//   · 不影响价格（不重新计价）；勾选结果随装备一起同步给开单页（syncCare），存进 care.with_bag / care.with_pole。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadComponent, settle, tap } = require('./reception_harness')

const FORM = 'components/reception/care_recept_form/care_recept_form.js'

function care(patch) {
  return Object.assign({ id: 1, equipment: '双板', brand: '测试', scale: '170', need_edge: 1, edge_degree: '89', need_wax: 0, need_unwax: 0, free_wax: 0,
    use_card: false, card_id: null, ticket_code: null, common_charge: 170, repair_charge: 0, discount: 0 }, patch || {})
}

function setup(t, rows) {
  const oldApp = global.getApp, oldWx = global.wx
  global.getApp = () => ({ globalData: { sessionKey: 'staff' }, loginPromiseNew: Promise.resolve() })
  const toasts = [], prices = []
  global.wx = { showToast: o => toasts.push(o.title) }
  t.after(() => { global.getApp = oldApp; global.wx = oldWx })
  const form = loadComponent(FORM, {
    getMemberTicketsPromise: async () => [],
    getMemberCardsPromise: async () => [],
    getMemberAssetsByStaffPromise: async () => ({ depositTotal: 0 }),
    getMemberCaredEquipmentsPromise: async () => [],
    calcCareChargePromise: async req => { prices.push(req); return { care: Object.assign({}, req.care) } }
  })
  Object.assign(form.data, { memberId: null, shop: '测试店', newCardMode: '', cares: rows || [care()] })
  form._refreshCares()
  return { form, toasts, prices }
}
const flags = (form, i) => [form.data.displayCares[i || 0].with_bag === true, form.data.displayCares[i || 0].with_pole === true]
const lastSynced = form => form.events.filter(e => e.name === 'syncCare').at(-1).detail.cares

test('含包、含杖二选一：点一个自动取消另一个，再点一下取消，也可以都不选', async t => {
  const { form } = setup(t)
  assert.deepEqual(flags(form), [false, false])
  form.onWithBagTap(tap({ cidx: 0 }))
  assert.deepEqual(flags(form), [true, false])
  form.onWithPoleTap(tap({ cidx: 0 }))           // 含杖勾上 → 含包自动取消
  assert.deepEqual(flags(form), [false, true])
  form.onWithBagTap(tap({ cidx: 0 }))            // 含包勾上 → 含杖自动取消
  assert.deepEqual(flags(form), [true, false])
  form.onWithBagTap(tap({ cidx: 0 }))            // 再点取消
  assert.deepEqual(flags(form), [false, false])
  form.onWithPoleTap(tap({ cidx: 0 }))
  form.onWithPoleTap(tap({ cidx: 0 }))
  assert.deepEqual(flags(form), [false, false])
  await settle()
})

test('任何操作顺序下都不会既含包又含杖', async t => {
  const { form } = setup(t)
  const steps = ['bag', 'pole', 'pole', 'bag', 'bag', 'pole', 'bag', 'pole']
  for (const s of steps) {
    s === 'bag' ? form.onWithBagTap(tap({ cidx: 0 })) : form.onWithPoleTap(tap({ cidx: 0 }))
    const [bag, pole] = flags(form)
    assert.equal(bag && pole, false, '第 ' + s + ' 步之后既含包又含杖')
  }
  await settle()
})

test('单板没有雪杖：点含杖没用并提示；单板可以含包', async t => {
  const { form, toasts } = setup(t, [care({ equipment: '单板' })])
  form.onWithPoleTap(tap({ cidx: 0 }))
  assert.deepEqual(flags(form), [false, false])
  assert.deepEqual(toasts, ['单板没有雪杖'])
  form.onWithBagTap(tap({ cidx: 0 }))
  assert.deepEqual(flags(form), [true, false])
  await settle()
})

test('已经勾了含杖的双板改选单板：含杖自动取消勾选（含包不受影响）', async t => {
  const { form } = setup(t, [care({ with_pole: true })])
  assert.deepEqual(flags(form), [false, true])
  form.onEquipTap(tap({ cidx: 0, equip: '单板' }))
  assert.equal(form.data.displayCares[0].equipment, '单板')
  assert.deepEqual(flags(form), [false, false])
  form.onWithBagTap(tap({ cidx: 0 }))
  form.onEquipTap(tap({ cidx: 0, equip: '双板' }))          // 换回双板：含包还在，含杖不会自己回来
  assert.deepEqual(flags(form), [true, false])
  await settle()
})

test('含包 / 含杖不影响价格：勾选不触发重新计价；勾选结果随装备同步给开单页，没动过的装备也带着这两个字段', async t => {
  const { form, prices } = setup(t, [care({ id: 1 }), care({ id: 2, equipment: '单板' })])
  form.onWithBagTap(tap({ cidx: 0 }))
  form.onWithPoleTap(tap({ cidx: 0 }))
  await settle()
  assert.deepEqual(prices, [])
  const synced = lastSynced(form)
  assert.deepEqual([synced[0].with_bag, synced[0].with_pole], [false, true])
  assert.equal(synced[1].equipment, '单板')
  assert.notEqual(synced[1].with_pole, true)
})

test('一件装备勾选不影响同一单里别的装备', async t => {
  const { form } = setup(t, [care({ id: 1 }), care({ id: 2 })])
  form.onWithBagTap(tap({ cidx: 0 }))
  assert.deepEqual(flags(form, 0), [true, false])
  assert.deepEqual(flags(form, 1), [false, false])
  form.onWithPoleTap(tap({ cidx: 1 }))
  assert.deepEqual(flags(form, 0), [true, false])
  assert.deepEqual(flags(form, 1), [false, true])
  await settle()
})

// ---- 页面结构：放在装备类型那一行右边的空格里 ----
const wxml = fs.readFileSync(path.join(__dirname, '..', FORM.replace('.js', '.wxml')), 'utf8')
const wxss = fs.readFileSync(path.join(__dirname, '..', FORM.replace('.js', '.wxss')), 'utf8')

test('模板：含包、含杖两个勾选在装备类型那一行（双板、单板按钮后面，同一个网格里），含杖在单板时置灰', () => {
  const grid = wxml.slice(wxml.indexOf('<view class="form-label">装备类型</view>'), wxml.indexOf('<!-- 照片 -->'))
  const order = ['data-equip="双板"', 'data-equip="单板"', 'onWithBagTap', 'onWithPoleTap']
  const at = order.map(k => grid.indexOf(k))
  assert.ok(at.every(i => i > 0) && at.every((v, i) => i === 0 || v > at[i - 1]), '顺序：双板、单板、含包、含杖：' + at)
  assert.match(grid, /<text>含包<\/text>/)
  assert.match(grid, /<text>含杖<\/text>/)
  assert.match(grid, /extra-chk--disabled/)
  assert.match(grid, /care\.equipment === '单板' \? 'extra-chk--disabled'/)
  // 含包 / 含杖不受季卡绑定锁影响（锁只管类型、品牌、长度）
  const chk = grid.slice(grid.indexOf('<view class="extra-chk'), grid.indexOf('<view wx:if="{{care.card_equip_lock}}" class="equip-lock-hint"'))
  assert.doesNotMatch(chk, /card_equip_lock/)
})

test('样式：勾选框、勾上后的颜色、置灰都有', () => {
  assert.match(wxss, /\.extra-chk\s*\{/)
  assert.match(wxss, /\.extra-box\s*\{/)
  assert.match(wxss, /\.extra-chk--on \.extra-box\s*\{[^}]*background/)
  assert.match(wxss, /\.extra-chk--disabled\s*\{[^}]*opacity/)
})
