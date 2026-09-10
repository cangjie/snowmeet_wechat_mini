const test = require('node:test')
const assert = require('node:assert/strict')

test('AI 查询未指定门店时店铺选择器保持全部店铺', async () => {
  const utilPath = require.resolve('../utils/util.js')
  const componentPath = require.resolve('../components/shop_selector/shop_selector.js')
  delete require.cache[componentPath]
  require.cache[utilPath] = {
    id: utilPath,
    filename: utilPath,
    loaded: true,
    exports: {
      performWebRequest: async function () {
        return [{ id: 1, name: '万龙服务中心', sale: 1, care: 1, rent: 1, restuarant: 0 }]
      }
    }
  }

  global.getApp = function () {
    return { loginPromiseNew: Promise.resolve(), globalData: { staff: {} } }
  }
  let definition = null
  global.Component = function (value) { definition = value }
  require(componentPath)
  delete global.Component

  let selected = null
  const instance = {
    properties: { defaultShop: '全部店铺', scene: '' },
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(values) { Object.assign(this.data, values) },
    triggerEvent(name, detail) {
      if (name === 'ShopSelected') selected = detail
    }
  }
  Object.keys(definition.methods).forEach(function (name) {
    instance[name] = definition.methods[name].bind(instance)
  })

  definition.lifetimes.ready.call(instance)
  await new Promise(function (resolve) { setImmediate(resolve) })

  assert.equal(instance.data.currentSelectedIndex, 0)
  assert.deepEqual(selected, { shop: '', sale: 0, care: 0, rent: 0, restuarant: 0 })

  delete global.getApp
})
