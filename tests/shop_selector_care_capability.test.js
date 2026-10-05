const test = require('node:test')
const assert = require('node:assert/strict')

test('万龙自动换店时店名、养护能力和选择框保持一致', () => {
  const utilPath = require.resolve('../utils/util.js')
  const componentPath = require.resolve('../components/shop_selector/shop_selector.js')
  require.cache[utilPath] = { id: utilPath, filename: utilPath, loaded: true, exports: {} }
  delete require.cache[componentPath]

  global.getApp = () => ({ globalData: { staff: { shop: { name: '万龙体验中心' } } } })
  let definition
  global.Component = (value) => { definition = value }
  require(componentPath)
  delete global.Component

  const service = { name: '万龙服务中心', sale: 1, rent: 0, care: 1, restuarant: 0 }
  const experience = { name: '万龙体验中心', sale: 1, rent: 1, care: 0, restuarant: 0 }
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
  instance._applySelectedShop(service, -1)
  assert.equal(instance.data.currentSelectedIndex, 1)
  assert.deepEqual(selected, { shop: experience.name, sale: 1, rent: 1, care: 0, restuarant: 0 })

  instance._stopScan = () => {}
  instance.selectChanged({ detail: { value: 0 } })
  assert.deepEqual(selected, { shop: service.name, sale: 1, rent: 0, care: 1, restuarant: 0 })

  delete global.getApp
})
