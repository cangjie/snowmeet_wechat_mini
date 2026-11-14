// 养护订单详情页：含包 / 含杖的表示和修改。
//   · 装备卡的服务 chip 行里有带小图标的「含包」或「含杖」；附件一行写「雪包」「雪杖」；
//   · 修改装备信息里的雪包 / 雪杖二选一（不可能既含包又含杖），单板没有雪杖（不显示雪杖按钮）；
//   · 保存时再收一次：不管页面怎么点的，存下去的不会既含包又含杖，单板不会含杖。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadPage, tap } = require('./reception_harness.js')

const PAGE = 'pages/admin/care/care_order_detail/care_order_detail.js'
const taskOf = (name, status, sort) => ({ id: sort + 1, care_id: 7, task_name: name, status, sort, valid: 1 })
const tasks = () => [taskOf('安全检查', '已完成', 10), taskOf('发板', '未开始', 60)]

function detail() {
  const calls = { update: [], toasts: [] }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { sessionKey: 'sk', staff: { id: 5, title_level: 100 } } })
  global.wx = { showToast(o) { calls.toasts.push(o.title) } }
  const page = loadPage(PAGE, {
    IMAGE_HOST: 'https://img.example',
    updateCarePromise(payload, scene) { calls.update.push({ payload, scene }); return Promise.resolve({}) }
  })
  delete global.getApp
  page._uiState = { expanded: {}, veriType: {}, safeCheck: {}, cancelReason: {} }
  page.loadOrder = () => {}
  return { page, calls, done() { delete global.wx } }
}
const rendered = (page, extra) => page._renderCare(Object.assign({ id: 7, order_id: 11, equipment: '双板', brand: 'ATOMIC', scale: '170', careImages: [], tasks: tasks() }, extra || {}))

test('装备卡的服务 chip：含包有「含包」带包图标，含杖有「含杖」带杖图标，都没带的没有；附件一行写雪包 / 雪杖', () => {
  const { page, done } = detail()
  const bag = rendered(page, { with_bag: true })
  const bagChip = bag._chips.find(c => c.text === '含包')
  assert.deepEqual([bagChip.cls, bagChip.icon], ['chip-extra chip-extra--bag', '/images/care/icon-bag.svg'])
  assert.equal(bag._chips.some(c => c.text === '含杖'), false)
  assert.equal(bag._extrasText, '雪包')
  const pole = rendered(page, { with_pole: true })
  const poleChip = pole._chips.find(c => c.text === '含杖')
  assert.deepEqual([poleChip.cls, poleChip.icon], ['chip-extra chip-extra--pole', '/images/care/icon-pole.svg'])
  assert.equal(pole._extrasText, '雪杖')
  const none = rendered(page, { with_bag: null, with_pole: null })
  assert.equal(none._chips.some(c => c.text === '含包' || c.text === '含杖'), false)
  assert.equal(none._extrasText, '')
  const board = rendered(page, { equipment: '单板', with_bag: true })
  assert.equal(board._extrasText, '雪包')
  done()
})

function withCare(page, care) { page.setData({ cares: [care] }); return care }

test('修改装备信息：雪包 / 雪杖二选一，点一个另一个自动取消，再点取消，也可以都不选', () => {
  const { page, done } = detail()
  withCare(page, rendered(page))
  const flags = () => [!!page.data.cares[0].with_bag, !!page.data.cares[0].with_pole]
  page.onWithBagTap(tap({ cidx: 0 }))
  assert.deepEqual(flags(), [true, false])
  page.onWithPoleTap(tap({ cidx: 0 }))
  assert.deepEqual(flags(), [false, true])
  page.onWithBagTap(tap({ cidx: 0 }))
  assert.deepEqual(flags(), [true, false])
  page.onWithBagTap(tap({ cidx: 0 }))
  assert.deepEqual(flags(), [false, false])
  for (const s of ['pole', 'bag', 'bag', 'pole', 'pole', 'bag']) {
    s === 'bag' ? page.onWithBagTap(tap({ cidx: 0 })) : page.onWithPoleTap(tap({ cidx: 0 }))
    assert.equal(flags()[0] && flags()[1], false)
  }
  done()
})

test('单板没有雪杖：点雪杖没用并提示；单板可以含雪包', () => {
  const { page, calls, done } = detail()
  withCare(page, rendered(page, { equipment: '单板' }))
  page.onWithPoleTap(tap({ cidx: 0 }))
  assert.equal(!!page.data.cares[0].with_pole, false)
  assert.deepEqual(calls.toasts, ['单板没有雪杖'])
  page.onWithBagTap(tap({ cidx: 0 }))
  assert.equal(page.data.cares[0].with_bag, true)
  done()
})

function saved(page, calls, raw, patch) {
  const care = withCare(page, rendered(page, Object.assign({}, raw, patch)))
  page._rawCares = [JSON.parse(JSON.stringify(Object.assign({ id: 7, order_id: 11, careImages: [], tasks: tasks() }, raw)))]
  page.onEditSave(tap({ cidx: 0 }))
  void care
  return calls.update.at(-1).payload
}

test('保存：含包存成 with_bag，含杖存成 with_pole，二选一；都不选存成两个 false', () => {
  const { page, calls, done } = detail()
  const bag = saved(page, calls, { equipment: '双板' }, { with_bag: true, with_pole: false })
  assert.deepEqual([bag.with_bag, bag.with_pole], [true, false])
  const pole = saved(page, calls, { equipment: '双板' }, { with_bag: false, with_pole: true })
  assert.deepEqual([pole.with_bag, pole.with_pole], [false, true])
  const neither = saved(page, calls, { equipment: '双板' }, { with_bag: null, with_pole: null })
  assert.deepEqual([neither.with_bag, neither.with_pole], [false, false])
  done()
})

test('保存时再收一次：万一页面数据既含包又含杖，只留含包；单板不会存成含杖', () => {
  const { page, calls, done } = detail()
  const both = saved(page, calls, { equipment: '双板' }, { with_bag: true, with_pole: true })
  assert.deepEqual([both.with_bag, both.with_pole], [true, false])
  const board = saved(page, calls, { equipment: '单板' }, { with_pole: true })
  assert.deepEqual([board.with_bag, board.with_pole], [false, false])
  done()
})

// ---------------- 页面结构 ----------------
const wxml = fs.readFileSync(path.join(__dirname, '..', 'pages/admin/care/care_order_detail/care_order_detail.wxml'), 'utf8')

test('模板：chip 带小图标；附件一行用 _extrasText；编辑里有雪包按钮，雪杖按钮只在双板时显示', () => {
  assert.match(wxml, /<view wx:for="\{\{care\._chips\}\}"[^>]*class="chip \{\{chip\.cls\}\}"><image wx:if="\{\{chip\.icon\}\}" class="chip-icon" src="\{\{chip\.icon\}\}"/)
  assert.match(wxml, /care\._extrasText/)
  assert.doesNotMatch(wxml, /care\.with_pole \? '雪杖 '/)
  const edit = wxml.slice(wxml.indexOf('class="edit-extra-btns"'), wxml.indexOf('placeholder="其他附件"'))
  assert.match(edit, /catchtap="onWithBagTap">雪包</)
  assert.match(edit, /wx:if="\{\{care\.equipment === '双板'\}\}"[\s\S]*catchtap="onWithPoleTap">雪杖</)
  assert.ok(edit.indexOf('onWithBagTap') < edit.indexOf('onWithPoleTap'))
})
