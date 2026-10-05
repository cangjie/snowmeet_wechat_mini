const test = require('node:test')
const assert = require('node:assert/strict')

test('开单入口由 beacon 命中覆盖基地店，店名和养护能力跟随信号', () => {
  const utilPath = require.resolve('../utils/util.js')
  const componentPath = require.resolve('../components/shop_selector/shop_selector.js')
  require.cache[utilPath] = { id: utilPath, filename: utilPath, loaded: true, exports: {} }
  delete require.cache[componentPath]

  global.getApp = () => ({ globalData: { staff: { shop: { name: '万龙体验中心' } } } })
  let definition
  global.Component = (value) => { definition = value }
  require(componentPath)
  delete global.Component

  const uuid = '12345678-1234-1234-1234-123456789ABC'
  const service = { id: 1, name: '万龙服务中心', sale: 1, rent: 0, care: 1, restuarant: 0, beacon_uuid: uuid }
  const experience = { id: 10, name: '万龙体验中心', sale: 1, rent: 1, care: 0, restuarant: 0 }
  let selected
  const instance = {
    properties: { scene: 'recept' },
    data: { shop_list: [service, experience], name_list: [service.name, experience.name] },
    setData(values) { Object.assign(this.data, values) },
    triggerEvent(name, detail) { if (name === 'ShopSelected') selected = detail }
  }
  for (const [name, method] of Object.entries(definition.methods)) {
    instance[name] = method.bind(instance)
  }
  // 扫描开始前按员工基地店兜底。
  instance._applySelectedShop(experience, -1)
  assert.equal(instance.data.currentSelectedIndex, 1)
  assert.deepEqual(selected, { shop: experience.name, sale: 1, rent: 1, care: 0, restuarant: 0 })

  // 随后的 iBeacon 命中服务中心，必须覆盖基地店，且显示与业务能力一致。
  instance._scanActive = true
  instance._scanShopList = [service, experience]
  instance._beaconHitMap = {}
  instance._diagSeenBeaconSet = {}
  instance._stopScan = () => { instance._scanActive = false }
  instance._onBeaconUpdate({ beacons: [{ uuid, major: 1, minor: 1, rssi: -45 }] }, { [uuid]: service })
  assert.equal(instance.data.currentSelectedIndex, 0)
  assert.deepEqual(selected, { shop: service.name, sale: 1, rent: 0, care: 1, restuarant: 0 })

  // 用户再手选体验中心，也不会被已停的扫描反向覆盖。
  instance.selectChanged({ detail: { value: 1 } })
  assert.deepEqual(selected, { shop: experience.name, sale: 1, rent: 1, care: 0, restuarant: 0 })

  // 非开单页面保留原先的万龙基地店规则。
  instance.properties.scene = 'orders'
  instance._applySelectedShop(service, -1)
  assert.equal(instance.data.currentSelectedIndex, 1)
  assert.deepEqual(selected, { shop: experience.name, sale: 1, rent: 1, care: 0, restuarant: 0 })

  delete global.getApp
})
