// 门店选择组件：已经有选定的门店时，beacon 识别必须终止，识别结果不能再改掉它（2026-11-14 用户要求）。
// 「已经选定」包括：店员手动选门店、店员勾选 / 取消勾选区域（哪怕门店列表还没加载回来）、页面在组件启动后才给出门店
// （AI 查询、草稿恢复）；识别或兜底已经自动选过一次之后，别的回调也不能再改。
const test = require('node:test')
const assert = require('node:assert/strict')

const UUID = '12345678-1234-1234-1234-123456789ABC'
const SHOPS = [
  { id: 1, name: '万龙服务中心', sale: 1, rent: 1, care: 1, restuarant: 0, beacon_uuid: UUID },
  { id: 4, name: '南山', sale: 1, rent: 1, care: 1, restuarant: 0 },
  { id: 9, name: '崇礼旗舰店', sale: 1, rent: 1, care: 1, restuarant: 0 },
  { id: 10, name: '万龙体验中心', sale: 1, rent: 1, care: 1, restuarant: 0 }
]

// deferred = true：GetShops 的响应由测试手动放行，用来模拟「门店列表还没回来」
function load({ shops = SHOPS, staff = { base_shop_id: 4 }, properties = {}, deferred = false } = {}) {
  const utilPath = require.resolve('../utils/util.js')
  const componentPath = require.resolve('../components/shop_selector/shop_selector.js')
  const originalUtil = require.cache[utilPath]
  delete require.cache[componentPath]
  let release = null
  const request = deferred ? () => new Promise(resolve => { release = () => resolve(shops) }) : async () => shops
  require.cache[utilPath] = { id: utilPath, filename: utilPath, loaded: true, exports: { performWebRequest: request } }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { requestPrefix: 'https://x/api/', staff } })
  let definition = null
  global.Component = value => { definition = value }
  require(componentPath)
  delete global.Component
  if (originalUtil) require.cache[utilPath] = originalUtil
  else delete require.cache[utilPath]

  const events = []
  const wxCalls = { beaconHandler: null, started: 0, startFail: null }
  global.wx = {
    getSystemInfoSync: () => ({ platform: 'devtools' }),
    stopBeaconDiscovery(o) { if (o && o.complete) o.complete() },
    startBeaconDiscovery(o) { wxCalls.started++; wxCalls.startFail = o.fail; o.success({}) },
    onBeaconUpdate(fn) { wxCalls.beaconHandler = fn },
    offBeaconUpdate() {},
    onBeaconServiceChange() {},
    stopBluetoothDevicesDiscovery(o) { if (o && o.complete) o.complete() },
    closeBluetoothAdapter() {},
    showToast() {}
  }
  const instance = {
    properties: Object.assign({ scene: '', defaultShop: '', showArea: false }, properties),
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(values) { Object.assign(this.data, values) },
    triggerEvent(name, detail) { if (name === 'ShopSelected') events.push(detail) }
  }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  return { definition, instance, events, wxCalls, release: () => release() }
}

function cleanup(instance) {
  instance._stopScan()
  delete global.getApp
  delete global.wx
}

const flush = () => new Promise(resolve => setImmediate(resolve))
const HIT = { beacons: [{ uuid: UUID, major: 1, minor: 1, rssi: -50 }] }
const shopOf = i => i.data.currentSelectedIndex === 0 ? '' : i.data.name_list[i.data.currentSelectedIndex]
const checked = i => [i.data.areaWanlong ? '万龙' : null, i.data.areaFlagship ? '旗舰' : null].filter(Boolean)

async function ready(ctx) {
  ctx.definition.lifetimes.ready.call(ctx.instance)
  await flush()
  return ctx
}

test('扫描中店员手动选了门店：识别结果之后不能再改（普通页面）', async () => {
  const ctx = await ready(load())
  const { instance, events, wxCalls } = ctx
  assert.ok(wxCalls.beaconHandler, '前提：已经在扫描')
  instance.selectChanged({ detail: { value: 3 } })                       // 崇礼旗舰店
  assert.equal(events.pop().shop, '崇礼旗舰店')
  wxCalls.beaconHandler(HIT)                                             // 此时才识别到万龙服务中心
  assert.equal(shopOf(instance), '崇礼旗舰店')
  assert.deepEqual(events, [])
  cleanup(instance)
})

test('扫描中店员手动选了门店：识别结果之后不能再改（开单入口 scene=recept）', async () => {
  const ctx = await ready(load({ properties: { scene: 'recept' } }))
  const { instance, events, wxCalls } = ctx
  instance.selectChanged({ detail: { value: 2 } })                       // 首项是「请选择门店」，2 = 南山
  assert.equal(events.pop().shop, '南山')
  wxCalls.beaconHandler(HIT)
  assert.equal(shopOf(instance), '南山')
  assert.deepEqual(events, [])
  cleanup(instance)
})

test('门店列表还没回来时店员先勾选了区域：不再启动 beacon 扫描，按店员的区域出结果', async () => {
  const ctx = load({ properties: { showArea: true }, deferred: true })
  const { instance, events, wxCalls, definition } = ctx
  definition.lifetimes.ready.call(instance)
  await flush()
  instance.areaChanged({ detail: { value: ['旗舰'] } })                  // 列表还没回来就动了区域
  assert.deepEqual(events, [], '列表没回来之前不发事件')
  ctx.release(); await flush()
  assert.equal(wxCalls.started, 0, '不能再启动扫描')
  assert.equal(wxCalls.beaconHandler, null)
  assert.deepEqual(checked(instance), ['旗舰'])
  assert.deepEqual(instance.data.name_list, ['全部门店', '崇礼旗舰店'])
  assert.equal(events.length, 1)
  assert.equal(events[0].shop, '崇礼旗舰店')
  assert.deepEqual(events[0].areas, ['旗舰'])
  cleanup(instance)
})

test('页面在组件已经开始扫描之后才给出门店（AI 查询 / 草稿恢复）：终止扫描，界面显示该门店，识别结果不能改', async () => {
  const ctx = await ready(load())
  const { instance, events, wxCalls, definition } = ctx
  assert.ok(wxCalls.beaconHandler, '前提：已经在扫描')
  events.length = 0
  instance.properties.defaultShop = '南山'
  definition.properties.defaultShop.observer.call(instance, '南山', '')
  assert.equal(shopOf(instance), '南山')
  assert.deepEqual(events, [], '页面自己已经知道，不重复发事件')
  wxCalls.beaconHandler(HIT)
  assert.equal(shopOf(instance), '南山')
  assert.deepEqual(events, [])
  cleanup(instance)
})

test('门店列表还没回来时页面给出的门店不在这里处理（ready 会按最新的 defaultShop 处理）', async () => {
  const ctx = load({ deferred: true })
  const { instance, events, definition } = ctx
  definition.lifetimes.ready.call(instance)
  await flush()
  instance.properties.defaultShop = '南山'
  definition.properties.defaultShop.observer.call(instance, '南山', '')
  assert.deepEqual(events, [])
  ctx.release(); await flush()
  assert.equal(shopOf(instance), '南山')
  assert.equal(events.pop().shop, '南山')
  assert.equal(ctx.wxCalls.started, 0, '指定了门店就不扫描')
  cleanup(instance)
})

test('带区域行的页面指定了具体门店：就是这一家，不会被推断成「万龙全部门店」', async () => {
  const ctx = await ready(load({ properties: { showArea: true, defaultShop: '万龙服务中心' } }))
  assert.deepEqual(checked(ctx.instance), ['万龙'])
  assert.equal(shopOf(ctx.instance), '万龙服务中心')
  assert.equal(ctx.events.pop().shop, '万龙服务中心')
  assert.equal(ctx.wxCalls.started, 0)
  cleanup(ctx.instance)
})

test('带区域行的页面在扫描后才收到具体门店：区域和门店都按这一家显示', async () => {
  const ctx = await ready(load({ properties: { showArea: true } }))
  const { instance, events, wxCalls, definition } = ctx
  events.length = 0
  instance.properties.defaultShop = '万龙体验中心'
  definition.properties.defaultShop.observer.call(instance, '万龙体验中心', '')
  assert.deepEqual(checked(instance), ['万龙'])
  assert.equal(shopOf(instance), '万龙体验中心')
  wxCalls.beaconHandler && wxCalls.beaconHandler(HIT)
  assert.equal(shopOf(instance), '万龙体验中心')
  assert.deepEqual(events, [])
  cleanup(instance)
})

test('已经选定后，扫描失败触发的兜底也不能再改选', async () => {
  const ctx = await ready(load({ staff: { base_shop_id: 4 } }))
  const { instance, events, wxCalls } = ctx
  instance.selectChanged({ detail: { value: 4 } })                       // 万龙体验中心
  events.length = 0
  if (wxCalls.startFail) wxCalls.startFail({ errCode: 1 })               // 之后才回调「启动扫描失败」
  instance._fallback(SHOPS)
  assert.equal(shopOf(instance), '万龙体验中心')
  assert.deepEqual(events, [])
  cleanup(instance)
})

test('识别 / 兜底自动选过一次之后，别的回调也不能再改', async () => {
  const ctx = await ready(load())
  const { instance, events, wxCalls } = ctx
  wxCalls.beaconHandler(HIT)                                             // 识别到万龙服务中心
  assert.equal(events.pop().shop, '万龙服务中心')
  instance._fallback(SHOPS)                                              // 迟到的兜底
  assert.equal(shopOf(instance), '万龙服务中心')
  assert.deepEqual(events, [])
  cleanup(instance)
})
