// 开单场景（scene='recept'）的店铺选择：首项「请选择店铺」、不默认选店，beacon 命中才选中，没命中由店员手动选
const test = require('node:test')
const assert = require('node:assert/strict')

const UUID = '12345678-1234-1234-1234-123456789ABC'
const SERVICE = { id: 1, name: '万龙服务中心', sale: 1, rent: 0, care: 1, restuarant: 0 }
const EXPERIENCE = { id: 10, name: '万龙体验中心', sale: 1, rent: 1, care: 0, restuarant: 0 }

function load(shops, staff) {
  const utilPath = require.resolve('../utils/util.js')
  const componentPath = require.resolve('../components/shop_selector/shop_selector.js')
  const originalUtil = require.cache[utilPath]
  delete require.cache[componentPath]
  require.cache[utilPath] = { id: utilPath, filename: utilPath, loaded: true, exports: { performWebRequest: async () => shops } }
  global.getApp = () => ({ loginPromiseNew: Promise.resolve(), globalData: { requestPrefix: 'https://x/api/', staff: staff || { base_shop_id: 10 } } })
  let definition = null
  global.Component = value => { definition = value }
  require(componentPath)
  delete global.Component
  if (originalUtil) require.cache[utilPath] = originalUtil
  else delete require.cache[utilPath]

  const events = []
  const toasts = []
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
    showToast(o) { toasts.push(o.title) }
  }
  const instance = {
    properties: { scene: 'recept', defaultShop: '' },
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(values) { Object.assign(this.data, values) },
    triggerEvent(name, detail) { if (name === 'ShopSelected') events.push(detail) }
  }
  Object.keys(definition.methods).forEach(name => { instance[name] = definition.methods[name].bind(instance) })
  return { definition, instance, events, toasts, wxCalls }
}

function cleanup(instance) {
  instance._stopScan()
  delete global.getApp
  delete global.wx
}

const flush = () => new Promise(resolve => setImmediate(resolve))

test('没配 beacon 的门店：停在「请选择店铺」，不默认选员工基地店', async () => {
  const { definition, instance, events } = load([SERVICE, EXPERIENCE])
  definition.lifetimes.ready.call(instance)
  await flush()
  assert.deepEqual(instance.data.name_list, ['请选择店铺', '万龙服务中心', '万龙体验中心'])
  assert.equal(instance.data.currentSelectedIndex, 0)
  assert.deepEqual(events, [])

  // 手动选店才有门店；再选回首项等于没选
  instance.selectChanged({ detail: { value: 2 } })
  assert.deepEqual(events.pop(), { shop: '万龙体验中心', sale: 1, care: 0, rent: 1, restuarant: 0 })
  instance.selectChanged({ detail: { value: 0 } })
  assert.deepEqual(events.pop(), { shop: '', sale: 0, care: 0, rent: 0, restuarant: 0 })
  cleanup(instance)
})

test('扫描中首项提示正在识别；beacon 命中后选中该店，首项恢复「请选择店铺」', async () => {
  const service = Object.assign({}, SERVICE, { beacon_uuid: UUID })
  const { definition, instance, events, wxCalls } = load([service, EXPERIENCE])
  definition.lifetimes.ready.call(instance)
  await flush()
  assert.equal(instance.data.name_list[0], '正在识别附近店铺…')
  assert.equal(instance.data.currentSelectedIndex, 0)
  assert.deepEqual(events, [])

  wxCalls.beaconHandler({ beacons: [{ uuid: UUID, major: 1, minor: 1, rssi: -50 }] })
  assert.equal(instance.data.name_list[0], '请选择店铺')
  assert.equal(instance.data.currentSelectedIndex, 1)
  assert.deepEqual(events, [{ shop: '万龙服务中心', sale: 1, rent: 0, care: 1, restuarant: 0 }])
  cleanup(instance)
})

test('30 秒没识别到店铺：提示手动选择，仍不默认选店', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const service = Object.assign({}, SERVICE, { beacon_uuid: UUID })
  const { definition, instance, events, toasts } = load([service, EXPERIENCE])
  definition.lifetimes.ready.call(instance)
  await flush()
  await flush()
  t.mock.timers.tick(30 * 1000)
  assert.deepEqual(toasts, ['没有识别到附近店铺，请手动选择店铺'])
  assert.equal(instance.data.name_list[0], '请选择店铺')
  assert.equal(instance.data.currentSelectedIndex, 0)
  assert.deepEqual(events, [])
  cleanup(instance)
})
