// 门店选择组件的「区域」行（show-area，2026-11-14 用户要求，只用在查询 / 报表页）：
//   区域 = 万龙 / 旗舰 两个 checkbox，默认都勾（= 不限区域）；门店下拉按勾选的区域过滤；
//   区域=万龙 + 全部门店 → 对外发出 '万龙服务中心,万龙体验中心'（后端联合查询两家）；
//   beacon 识别到万龙任一家 → 只勾万龙 + 全部门店；识别到崇礼旗舰店 → 只勾旗舰；识别失败 / 没配 beacon → 按员工基地店推断。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const UUID_SERVICE = '12345678-1234-1234-1234-123456789ABC'
const UUID_FLAGSHIP = '87654321-4321-4321-4321-CBA987654321'
const SHOPS = [
  { id: 1, name: '万龙服务中心', sale: 1, rent: 1, care: 1, restuarant: 0 },
  { id: 4, name: '南山', sale: 1, rent: 1, care: 1, restuarant: 0 },
  { id: 9, name: '崇礼旗舰店', sale: 1, rent: 1, care: 1, restuarant: 0 },
  { id: 10, name: '万龙体验中心', sale: 1, rent: 1, care: 1, restuarant: 0 }
]
const withBeacon = (shops, uuids) => shops.map(s => Object.assign({}, s, uuids[s.name] ? { beacon_uuid: uuids[s.name] } : {}))

function load({ shops = SHOPS, staff = { base_shop_id: 1 }, properties = {} } = {}) {
  const utilPath = require.resolve('../utils/util.js')
  const componentPath = require.resolve('../components/shop_selector/shop_selector.js')
  const originalUtil = require.cache[utilPath]
  delete require.cache[componentPath]
  require.cache[utilPath] = { id: utilPath, filename: utilPath, loaded: true, exports: { performWebRequest: async () => shops } }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { requestPrefix: 'https://x/api/', staff } })
  let definition = null
  global.Component = value => { definition = value }
  require(componentPath)
  delete global.Component
  if (originalUtil) require.cache[utilPath] = originalUtil
  else delete require.cache[utilPath]

  const events = []
  const wxCalls = { beaconHandler: null }
  global.wx = {
    getSystemInfoSync: () => ({ platform: 'devtools' }),
    stopBeaconDiscovery(o) { if (o && o.complete) o.complete() },
    startBeaconDiscovery(o) { o.success({}) },
    onBeaconUpdate(fn) { wxCalls.beaconHandler = fn },
    offBeaconUpdate() {},
    onBeaconServiceChange() {},
    stopBluetoothDevicesDiscovery(o) { if (o && o.complete) o.complete() },
    closeBluetoothAdapter() {},
    showToast() {}
  }
  const instance = {
    properties: Object.assign({ scene: '', defaultShop: '', showArea: true }, properties),
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(values) { Object.assign(this.data, values) },
    triggerEvent(name, detail) { if (name === 'ShopSelected') events.push(detail) }
  }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  return { definition, instance, events, wxCalls }
}

function cleanup(instance) {
  instance._stopScan()
  delete global.getApp
  delete global.wx
}

const flush = () => new Promise(resolve => setImmediate(resolve))
const checked = i => [i.data.areaWanlong ? '万龙' : null, i.data.areaFlagship ? '旗舰' : null].filter(Boolean)
const shopOf = i => i.data.currentSelectedIndex === 0 ? '' : i.data.name_list[i.data.currentSelectedIndex]

async function ready(ctx) {
  ctx.definition.lifetimes.ready.call(ctx.instance)
  await flush()
  return ctx
}

test('区域默认两项都勾；明确要求「全部门店」时不扫描，门店下拉列出全部门店，发出空 shop', async () => {
  const ctx = await ready(load({ properties: { defaultShop: '全部门店' } }))
  const { instance, events } = ctx
  assert.deepEqual(checked(instance), ['万龙', '旗舰'])
  assert.deepEqual(instance.data.name_list, ['全部门店', '万龙服务中心', '南山', '崇礼旗舰店', '万龙体验中心'])
  assert.equal(instance.data.currentSelectedIndex, 0)
  assert.deepEqual(events, [{ shop: '', sale: 0, care: 0, rent: 0, restuarant: 0, areas: ['万龙', '旗舰'] }])
  cleanup(instance)
})

test('旧页面传的「全部店铺」同样当作全部门店', async () => {
  const ctx = await ready(load({ properties: { defaultShop: '全部店铺' } }))
  assert.deepEqual(checked(ctx.instance), ['万龙', '旗舰'])
  assert.equal(ctx.instance.data.currentSelectedIndex, 0)
  assert.equal(ctx.events[0].shop, '')
  cleanup(ctx.instance)
})

test('勾选区域联动门店下拉和发出的 shop：万龙联合 → 具体一家 → 切到旗舰 → 都不勾', async () => {
  const ctx = await ready(load({ properties: { defaultShop: '全部门店' } }))
  const { instance, events } = ctx
  events.length = 0

  instance.areaChanged({ detail: { value: ['万龙'] } })                       // 只勾万龙
  assert.deepEqual(instance.data.name_list, ['全部门店', '万龙服务中心', '万龙体验中心'])
  assert.deepEqual(events.pop(), { shop: '万龙服务中心,万龙体验中心', sale: 0, care: 0, rent: 0, restuarant: 0, areas: ['万龙'] })

  instance.selectChanged({ detail: { value: 2 } })                            // 选万龙体验中心
  assert.deepEqual(events.pop(), { shop: '万龙体验中心', sale: 1, care: 1, rent: 1, restuarant: 0, areas: ['万龙'] })

  instance.areaChanged({ detail: { value: ['旗舰'] } })                       // 切到旗舰：选中的体验中心不在下拉里，回到全部门店
  assert.deepEqual(instance.data.name_list, ['全部门店', '崇礼旗舰店'])
  assert.equal(instance.data.currentSelectedIndex, 0)
  assert.deepEqual(events.pop(), { shop: '崇礼旗舰店', sale: 0, care: 0, rent: 0, restuarant: 0, areas: ['旗舰'] })

  instance.areaChanged({ detail: { value: [] } })                             // 都不勾 = 不限区域
  assert.deepEqual(instance.data.name_list, ['全部门店', '万龙服务中心', '南山', '崇礼旗舰店', '万龙体验中心'])
  assert.equal(events.pop().shop, '')

  instance.areaChanged({ detail: { value: ['万龙', '旗舰'] } })              // 两项都勾 = 不限
  assert.equal(events.pop().shop, '')
  cleanup(instance)
})

test('区域不变、选中的门店仍在下拉里时保持选中', async () => {
  const ctx = await ready(load({ properties: { defaultShop: '全部门店' } }))
  const { instance, events } = ctx
  instance.selectChanged({ detail: { value: 2 } })                            // 南山（区域不限时才在下拉里）
  assert.equal(events.pop().shop, '南山')
  instance.areaChanged({ detail: { value: ['万龙', '旗舰'] } })
  assert.equal(shopOf(instance), '南山')
  cleanup(instance)
})

test('beacon 识别到万龙服务中心：只勾万龙 + 全部门店', async () => {
  const shops = withBeacon(SHOPS, { 万龙服务中心: UUID_SERVICE })
  const ctx = await ready(load({ shops }))
  const { instance, events, wxCalls } = ctx
  assert.deepEqual(checked(instance), ['万龙', '旗舰'])                       // 扫描期间保持默认
  wxCalls.beaconHandler({ beacons: [{ uuid: UUID_SERVICE, major: 1, minor: 1, rssi: -50 }] })
  assert.deepEqual(checked(instance), ['万龙'])
  assert.equal(shopOf(instance), '')
  assert.deepEqual(events.pop(), { shop: '万龙服务中心,万龙体验中心', sale: 0, care: 0, rent: 0, restuarant: 0, areas: ['万龙'] })
  cleanup(instance)
})

test('beacon 识别到万龙体验中心：同样只勾万龙 + 全部门店（不再换成员工基地店）', async () => {
  const shops = withBeacon(SHOPS, { 万龙体验中心: UUID_SERVICE })
  const ctx = await ready(load({ shops, staff: { base_shop_id: 9, shop: { name: '崇礼旗舰店' } } }))
  ctx.wxCalls.beaconHandler({ beacons: [{ uuid: UUID_SERVICE, major: 1, minor: 1, rssi: -50 }] })
  assert.deepEqual(checked(ctx.instance), ['万龙'])
  assert.equal(shopOf(ctx.instance), '')
  assert.equal(ctx.events.pop().shop, '万龙服务中心,万龙体验中心')
  cleanup(ctx.instance)
})

test('beacon 识别到崇礼旗舰店：只勾旗舰，取消万龙', async () => {
  const shops = withBeacon(SHOPS, { 崇礼旗舰店: UUID_FLAGSHIP })
  const ctx = await ready(load({ shops }))
  ctx.wxCalls.beaconHandler({ beacons: [{ uuid: UUID_FLAGSHIP, major: 1, minor: 1, rssi: -50 }] })
  assert.deepEqual(checked(ctx.instance), ['旗舰'])
  assert.deepEqual(ctx.instance.data.name_list, ['全部门店', '崇礼旗舰店'])
  assert.deepEqual(ctx.events.pop(), { shop: '崇礼旗舰店', sale: 0, care: 0, rent: 0, restuarant: 0, areas: ['旗舰'] })
  cleanup(ctx.instance)
})

test('没配 beacon 时按员工基地店推断：基地店在万龙 → 万龙 + 全部门店', async () => {
  const ctx = await ready(load({ staff: { base_shop_id: 10 } }))
  assert.deepEqual(checked(ctx.instance), ['万龙'])
  assert.equal(shopOf(ctx.instance), '')
  assert.equal(ctx.events.pop().shop, '万龙服务中心,万龙体验中心')
  cleanup(ctx.instance)
})

test('没配 beacon 时基地店是崇礼旗舰店 → 旗舰 + 全部门店；基地店是南山 → 区域不限 + 选中南山', async () => {
  const flagship = await ready(load({ staff: { base_shop_id: 9 } }))
  assert.deepEqual(checked(flagship.instance), ['旗舰'])
  assert.equal(flagship.events.pop().shop, '崇礼旗舰店')
  cleanup(flagship.instance)

  const nanshan = await ready(load({ staff: { base_shop_id: 4 } }))
  assert.deepEqual(checked(nanshan.instance), ['万龙', '旗舰'])
  assert.equal(shopOf(nanshan.instance), '南山')
  assert.equal(nanshan.events.pop().shop, '南山')
  cleanup(nanshan.instance)
})

test('没有基地店：沿用默认万龙服务中心，按万龙处理', async () => {
  const ctx = await ready(load({ staff: {} }))
  assert.deepEqual(checked(ctx.instance), ['万龙'])
  assert.equal(ctx.events.pop().shop, '万龙服务中心,万龙体验中心')
  cleanup(ctx.instance)
})

test('页面（如 AI 查询）指定了具体门店：区域随该店，下拉里选中它，不启动扫描', async () => {
  const ctx = await ready(load({ properties: { defaultShop: '崇礼旗舰店' } }))
  assert.deepEqual(checked(ctx.instance), ['旗舰'])
  assert.equal(ctx.events.pop().shop, '崇礼旗舰店')
  cleanup(ctx.instance)
})

test('用户手动勾选 / 选门店后，识别结果不再覆盖（手动优先）', async () => {
  const shops = withBeacon(SHOPS, { 万龙服务中心: UUID_SERVICE })
  const ctx = await ready(load({ shops }))
  const { instance, events, wxCalls } = ctx
  instance.areaChanged({ detail: { value: ['旗舰'] } })
  events.length = 0
  if (wxCalls.beaconHandler) wxCalls.beaconHandler({ beacons: [{ uuid: UUID_SERVICE, major: 1, minor: 1, rssi: -50 }] })
  assert.deepEqual(checked(instance), ['旗舰'])
  assert.deepEqual(events, [])
  cleanup(instance)
})

test('不开 show-area 的页面行为不变：首项「全部门店」，事件里没有 areas，勾选相关数据不存在', async () => {
  const ctx = await ready(load({ properties: { showArea: false }, staff: { base_shop_id: 10 } }))
  const { instance, events } = ctx
  assert.equal(instance.data.name_list[0], '全部门店')
  assert.deepEqual(instance.data.name_list.slice(1), ['万龙服务中心', '南山', '崇礼旗舰店', '万龙体验中心'])
  assert.equal(events.length, 1)
  assert.equal('areas' in events[0], false)
  assert.equal(events[0].shop, '万龙体验中心')            // 仍是具体的基地店
  cleanup(instance)
})

test('开单入口（scene=recept）首项文案是「请选择门店」', async () => {
  const ctx = await ready(load({ properties: { showArea: false, scene: 'recept' } }))
  assert.equal(ctx.instance.data.name_list[0], '请选择门店')
  cleanup(ctx.instance)
})

test('模板：只有 show-area 时才渲染「区域」行（万龙 / 旗舰两个 checkbox）和带「门店」标签的门店行', () => {
  const dir = path.join(__dirname, '..', 'components/shop_selector')
  const wxml = fs.readFileSync(path.join(dir, 'shop_selector.wxml'), 'utf8')
  assert.match(wxml, /wx:if="\{\{showArea\}\}"/)
  assert.match(wxml, /区域/)
  assert.match(wxml, /<checkbox value="万龙"/)
  assert.match(wxml, /<checkbox value="旗舰"/)
  assert.match(wxml, /bindchange="areaChanged"/)
  assert.match(wxml, /\{\{areaLabel\}\}/)
  assert.match(wxml, /\{\{shopLabel\}\}/)
  assert.equal(/店铺/.test(wxml), false)
})

test('样式类：组件声明 externalClasses，页面可传入各自的筛选行样式', async () => {
  const ctx = load()
  assert.deepEqual(ctx.definition.externalClasses, ['row-class', 'label-class', 'value-class'])
  assert.equal(ctx.definition.properties.showArea.value, false)
  assert.equal(ctx.definition.properties.areaLabel.value, '区域')
  assert.equal(ctx.definition.properties.shopLabel.value, '门店')
  cleanup(ctx.instance)
})
