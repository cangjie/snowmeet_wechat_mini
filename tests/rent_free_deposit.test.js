// 租赁开单：「免押金」勾选，以及勾选「招待」时询问是否免押金。
// 2026-11-13 用户要求：
//   1) 开单页增加免押金：勾选后押金归零，同时设置 rental.noGuaranty（后端 PlaceRentOrder 据此不生成押金记录）；
//   2) 勾选招待要弹窗问是否免押金：选「是」等同勾选免押金，选「否」押金照收（原来是悄悄把押金归零）。
// 取消免押金 → 恢复该商品/套餐的标准押金（勾选时 guaranty 已写成 0，标准押金不在库里，只能重新取）。
const test = require('node:test')
const assert = require('node:assert/strict')

function formatDate(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function setByPath(obj, pathStr, value) {
  const keys = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.')
  let cur = obj
  keys.slice(0, -1).forEach(k => { cur = cur[k] })
  cur[keys[keys.length - 1]] = value
}

// modalAnswer：招待弹窗点哪个按钮——'free' 点「免押金」，'keep' 点「收押金」，null 不应弹窗（弹了就记下来，由用例断言）。
function loadForm(displayRentals, { data = {}, modalAnswer = null } = {}) {
  const dataPath = require.resolve('../utils/data.js')
  const utilPath = require.resolve('../utils/util.js')
  const file = require.resolve('../components/reception/rent_recept_form/rent_recept_form.js')
  const originalData = require.cache[dataPath]
  const originalUtil = require.cache[utilPath]
  const fakeData = Object.assign({
    getShopByNamePromise: async () => ({ id: 10 }),
    getRentPriceListPromise: async () => [],
  }, data)
  require.cache[dataPath] = { id: dataPath, filename: dataPath, loaded: true, exports: fakeData }
  require.cache[utilPath] = { id: utilPath, filename: utilPath, loaded: true, exports: { createRentalDetail() {}, formatDate } }
  const calls = { modals: [], toasts: [], loading: 0, hidden: 0 }
  global.wx = {
    showToast(o) { calls.toasts.push(o) },
    showLoading() { calls.loading++ },
    hideLoading() { calls.hidden++ },
    showModal(o) {
      calls.modals.push(o)
      if (modalAnswer) o.success({ confirm: modalAnswer === 'free', cancel: modalAnswer !== 'free' })
    },
  }
  delete require.cache[file]
  let definition = null
  global.Component = value => { definition = value }
  require(file)
  delete global.Component
  delete require.cache[file]
  const syncs = []
  const instance = {
    data: { displayRentals, expandedItem: {} },
    properties: { shop: '万龙服务中心' },
    setData(values) { Object.keys(values).forEach(k => setByPath(this.data, k, values[k])) },
    triggerEvent(name, detail) { if (name === 'syncRent') syncs.push(detail) },
  }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  instance._updateRentalChip = () => {}
  const restore = () => {
    delete require.cache[file]
    if (originalData) require.cache[dataPath] = originalData; else delete require.cache[dataPath]
    if (originalUtil) require.cache[utilPath] = originalUtil; else delete require.cache[utilPath]
  }
  return { instance, syncs, calls, restore }
}

// 开单页里的一个套餐：标准押金 3000，已录入完整
function rental(extra) {
  return Object.assign({
    id: 7, name: '中级双板套餐', package_id: 41, category_id: 3, pick_type: '立即租赁',
    start_date: formatDate(new Date()) + 'T10:00:00',
    guaranty: 3000, realGuaranty: 3000, guaranty_discount: 0,
    _depositLabel: 3000, _depositInput: '3000', _dailyRate: 260, _dailyRateInput: '260.00', _rentalEntered: true,
    pricePresets: [],
    rentItems: [{ id: 1, name: '雪板', code: 'B', noCode: false, category_id: 3, pick_type: '立即租赁', atOnce: true }],
  }, extra || {})
}

const toggle = (checked) => ({ currentTarget: { dataset: { ridx: 0 } }, detail: { value: checked ? ['1'] : [] } })
const lastSynced = syncs => syncs[syncs.length - 1].rentals[0]

// ---------- 免押金复选框 ----------

test('勾选免押金：押金归零并设 noGuaranty，汇总押金为 0，随保存带给后端', () => {
  const { instance, syncs, restore } = loadForm([rental()])
  try {
    instance._refreshSummary()
    assert.equal(instance.data.summary.depositLabel, '3,000')

    instance.onPkgFreeDepositToggle(toggle(true))

    const r = instance.data.displayRentals[0]
    assert.equal(r.noGuaranty, true)
    assert.equal(r.guaranty, 0)
    assert.equal(r.realGuaranty, 0)
    assert.equal(r.guaranty_discount, 0)
    assert.equal(r._depositLabel, 0)
    assert.equal(instance.data.summary.depositLabel, '0')
    assert.equal(syncs.length, 1)
    assert.equal(syncs[0].needUpdate, false)
    assert.equal(lastSynced(syncs).noGuaranty, true)
    assert.equal(lastSynced(syncs).guaranty, 0)
  } finally { restore() }
})

test('取消免押金（套餐）：清标志，押金恢复成套餐的标准押金', async () => {
  const asked = []
  const { instance, syncs, calls, restore } = loadForm(
    [rental({ noGuaranty: true, guaranty: 0, realGuaranty: 0, _depositLabel: 0, _depositInput: '0' })],
    { data: { getPackagePromise: async id => { asked.push(['package', id]); return { id, deposit: 3000 } },
              getRentCategoryPromise: async () => { throw new Error('套餐不该按分类取押金') } } })
  try {
    instance.onPkgFreeDepositToggle(toggle(false))
    await new Promise(r => setImmediate(r))

    const r = instance.data.displayRentals[0]
    assert.deepEqual(asked, [['package', 41]])
    assert.equal(r.noGuaranty, false)
    assert.equal(r.guaranty, 3000)
    assert.equal(r.realGuaranty, 3000)
    assert.equal(r._depositLabel, 3000)
    assert.equal(instance.data.summary.depositLabel, '3,000')
    assert.equal(calls.loading, 1)
    assert.equal(calls.hidden, 1)
    assert.equal(lastSynced(syncs).noGuaranty, false)
    assert.equal(lastSynced(syncs).guaranty, 3000)
  } finally { restore() }
})

test('取消免押金（单品）：押金恢复成分类的标准押金', async () => {
  const asked = []
  const { instance, restore } = loadForm(
    [rental({ package_id: null, category_id: 3, noGuaranty: true, guaranty: 0, realGuaranty: 0, _depositLabel: 0, _depositInput: '0' })],
    { data: { getPackagePromise: async () => { throw new Error('单品不该按套餐取押金') },
              getRentCategoryPromise: async id => { asked.push(['category', id]); return { id, deposit: 500 } } } })
  try {
    instance.onPkgFreeDepositToggle(toggle(false))
    await new Promise(r => setImmediate(r))

    const r = instance.data.displayRentals[0]
    assert.deepEqual(asked, [['category', 3]])
    assert.equal(r.noGuaranty, false)
    assert.equal(r.guaranty, 500)
    assert.equal(r._depositLabel, 500)
  } finally { restore() }
})

test('取消免押金时取不到标准押金：标志照样清掉，押金保持 0 并提示手填', async () => {
  const { instance, syncs, calls, restore } = loadForm(
    [rental({ noGuaranty: true, guaranty: 0, realGuaranty: 0, _depositLabel: 0, _depositInput: '0' })],
    { data: { getPackagePromise: async () => { throw new Error('网络错误') } } })
  try {
    instance.onPkgFreeDepositToggle(toggle(false))
    await new Promise(r => setImmediate(r))

    const r = instance.data.displayRentals[0]
    assert.equal(r.noGuaranty, false)
    assert.equal(r.guaranty, 0)
    assert.equal(calls.toasts.length, 1)
    assert.match(calls.toasts[0].title, /手动填写/)
    assert.equal(calls.hidden, 1, '遮罩要收掉')
    assert.equal(lastSynced(syncs).noGuaranty, false, '清掉的标志要带给后端')
  } finally { restore() }
})

// ---------- 招待联动 ----------

test('勾选招待并选「免押金」：等同勾选免押金', () => {
  const { instance, syncs, calls, restore } = loadForm([rental()], { modalAnswer: 'free' })
  try {
    instance.onPkgEntertainToggle(toggle(true))

    assert.equal(calls.modals.length, 1)
    assert.equal(calls.modals[0].confirmText, '免押金')
    assert.equal(calls.modals[0].cancelText, '收押金')
    assert.match(calls.modals[0].content, /免押金/)
    const r = instance.data.displayRentals[0]
    assert.equal(r.entertain, true)
    assert.equal(r.noGuaranty, true)
    assert.equal(r.guaranty, 0)
    assert.equal(r._depositLabel, 0)
    assert.equal(lastSynced(syncs).noGuaranty, true)
    assert.equal(lastSynced(syncs).entertain, true)
  } finally { restore() }
})

test('勾选招待并选「收押金」：押金照收，不设 noGuaranty', () => {
  const { instance, syncs, calls, restore } = loadForm([rental()], { modalAnswer: 'keep' })
  try {
    instance.onPkgEntertainToggle(toggle(true))

    assert.equal(calls.modals.length, 1)
    const r = instance.data.displayRentals[0]
    assert.equal(r.entertain, true)
    assert.ok(!r.noGuaranty)
    assert.equal(r.guaranty, 3000)
    assert.equal(r.realGuaranty, 3000)
    assert.equal(r._depositLabel, 3000)
    assert.equal(instance.data.summary.depositLabel, '3,000')
    assert.equal(syncs.length, 1, '选完也要同步一次，招待标志才会保存')
    assert.equal(lastSynced(syncs).entertain, true)
    assert.ok(!lastSynced(syncs).noGuaranty)
    assert.equal(lastSynced(syncs).guaranty, 3000)
  } finally { restore() }
})

test('已经免押金时再勾选招待：不再弹窗', () => {
  const { instance, calls, restore } = loadForm(
    [rental({ noGuaranty: true, guaranty: 0, realGuaranty: 0, _depositLabel: 0, _depositInput: '0' })])
  try {
    instance.onPkgEntertainToggle(toggle(true))

    assert.equal(calls.modals.length, 0)
    const r = instance.data.displayRentals[0]
    assert.equal(r.entertain, true)
    assert.equal(r.noGuaranty, true)
    assert.equal(r.guaranty, 0)
  } finally { restore() }
})

// 2026-11-13 用户补充：取消招待时，免押金如果勾着也要同时取消，押金恢复到正常金额。
test('取消招待：免押金勾着就同时取消，押金恢复成标准押金', async () => {
  const asked = []
  const { instance, syncs, calls, restore } = loadForm(
    [rental({ entertain: true, noGuaranty: true, guaranty: 0, realGuaranty: 0, _depositLabel: 0, _depositInput: '0' })],
    { data: { getPackagePromise: async id => { asked.push(id); return { id, deposit: 3000 } } } })
  try {
    instance.onPkgEntertainToggle(toggle(false))
    await new Promise(r => setImmediate(r))

    assert.equal(calls.modals.length, 0)
    assert.deepEqual(asked, [41])
    const r = instance.data.displayRentals[0]
    assert.equal(r.entertain, false)
    assert.equal(r.noGuaranty, false)
    assert.equal(r.guaranty, 3000)
    assert.equal(r.realGuaranty, 3000)
    assert.equal(r._depositLabel, 3000)
    assert.equal(instance.data.summary.depositLabel, '3,000')
    assert.equal(syncs.length, 1)
    assert.equal(lastSynced(syncs).entertain, false, '取消招待要随保存带给后端')
    assert.equal(lastSynced(syncs).noGuaranty, false)
    assert.equal(lastSynced(syncs).guaranty, 3000)
  } finally { restore() }
})

test('勾选招待选「免押金」后再取消招待：押金回到标准金额', async () => {
  const { instance, syncs, restore } = loadForm([rental()], {
    modalAnswer: 'free',
    data: { getPackagePromise: async id => ({ id, deposit: 3000 }) } })
  try {
    instance.onPkgEntertainToggle(toggle(true))
    assert.equal(instance.data.displayRentals[0].noGuaranty, true)
    assert.equal(instance.data.displayRentals[0].guaranty, 0)

    instance.onPkgEntertainToggle(toggle(false))
    await new Promise(r => setImmediate(r))

    const r = instance.data.displayRentals[0]
    assert.equal(r.entertain, false)
    assert.equal(r.noGuaranty, false)
    assert.equal(r.guaranty, 3000)
    assert.equal(instance.data.summary.depositLabel, '3,000')
    assert.equal(lastSynced(syncs).entertain, false)
    assert.equal(lastSynced(syncs).guaranty, 3000)
  } finally { restore() }
})

test('取消招待时免押金没勾：押金不动，也不去取标准押金', () => {
  const { instance, syncs, calls, restore } = loadForm(
    [rental({ entertain: true, guaranty: 1500, realGuaranty: 1500, _depositLabel: 1500, _depositInput: '1500' })],
    { data: { getPackagePromise: async () => { throw new Error('不该取标准押金') } } })
  try {
    instance.onPkgEntertainToggle(toggle(false))

    assert.equal(calls.modals.length, 0)
    assert.equal(calls.loading, 0)
    const r = instance.data.displayRentals[0]
    assert.equal(r.entertain, false)
    assert.ok(!r.noGuaranty)
    assert.equal(r.guaranty, 1500, '店员手改过的押金不能被冲掉')
    assert.equal(syncs.length, 1)
    assert.equal(lastSynced(syncs).entertain, false)
  } finally { restore() }
})

test('取消招待取不到标准押金：免押金照样取消，押金保持 0 并提示手填', async () => {
  const { instance, syncs, calls, restore } = loadForm(
    [rental({ entertain: true, noGuaranty: true, guaranty: 0, realGuaranty: 0, _depositLabel: 0, _depositInput: '0' })],
    { data: { getPackagePromise: async () => { throw new Error('网络错误') } } })
  try {
    instance.onPkgEntertainToggle(toggle(false))
    await new Promise(r => setImmediate(r))

    const r = instance.data.displayRentals[0]
    assert.equal(r.entertain, false)
    assert.equal(r.noGuaranty, false)
    assert.equal(r.guaranty, 0)
    assert.match(calls.toasts[0].title, /手动填写/)
    assert.equal(lastSynced(syncs).entertain, false)
    assert.equal(lastSynced(syncs).noGuaranty, false)
  } finally { restore() }
})

// ---------- 免押金和手改押金 / 换分类 的关系 ----------

test('免押金状态下手输正数押金：说明要收，免押金标志同时清掉', () => {
  const { instance, syncs, restore } = loadForm(
    [rental({ noGuaranty: true, guaranty: 0, realGuaranty: 0, _depositLabel: 0, _depositInput: '0' })])
  try {
    instance._applyPkgDeposit(0, 200)

    const r = instance.data.displayRentals[0]
    assert.equal(r.guaranty, 200)
    assert.equal(r.noGuaranty, false)
    assert.equal(lastSynced(syncs).noGuaranty, false)
  } finally { restore() }
})

test('免押金状态下手输 0：免押金标志保持', () => {
  const { instance, restore } = loadForm(
    [rental({ noGuaranty: true, guaranty: 0, realGuaranty: 0, _depositLabel: 0, _depositInput: '0' })])
  try {
    instance._applyPkgDeposit(0, 0)
    assert.equal(instance.data.displayRentals[0].noGuaranty, true)
  } finally { restore() }
})

test('没免押金时手改押金：照旧，不凭空带上标志', () => {
  const { instance, restore } = loadForm([rental()])
  try {
    instance._applyPkgDeposit(0, 1000)
    const r = instance.data.displayRentals[0]
    assert.equal(r.guaranty, 1000)
    assert.ok(!r.noGuaranty)
  } finally { restore() }
})

test('换分类：免押金的租赁押金仍是 0 且标志不变；没免押金的取新分类的押金', async () => {
  for (const [free, wantGuaranty] of [[true, 0], [false, 500]]) {
    const main = { id: 7, is_associate: false, noCode: true, category_id: null, pick_type: '立即租赁', atOnce: true, valid: 1 }
    const r = {
      id: 5, pick_type: '立即租赁', start_date: formatDate(new Date()) + 'T09:20:00', expectDays: 1,
      guaranty: free ? 0 : 3000, realGuaranty: free ? 0 : 3000, guaranty_discount: 0, noGuaranty: free, rentItems: [main],
    }
    const { instance, syncs, restore } = loadForm([r], {
      data: { getRentCategoryPromise: async id => ({ id, name: '【FIS】双板', deposit: 500, associateCategories: [] }) } })
    try {
      await instance._applyCategoryChange(0, 0, { id: 4, name: '【FIS】双板', deposit: 500 })
    } finally { restore() }
    const saved = lastSynced(syncs)
    assert.equal(saved.guaranty, wantGuaranty, free ? '免押金' : '没免押金')
    assert.equal(saved.realGuaranty, wantGuaranty)
    assert.equal(!!saved.noGuaranty, free)
  }
})
