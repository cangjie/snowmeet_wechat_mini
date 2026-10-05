const test = require('node:test')
const assert = require('node:assert/strict')

test('体验中心发起养护时沿用服务中心作为订单门店', () => {
  let definition
  let storedDraft
  let navigatedUrl
  global.getApp = () => ({ globalData: {} })
  global.Page = (value) => { definition = value }
  global.wx = {
    setStorageSync(key, value) { if (key === 'reception_draft') storedDraft = value },
    navigateTo({ url }) { navigatedUrl = url },
    showToast() { throw new Error('不应阻断养护开单') }
  }
  const pagePath = require.resolve('../pages/admin/reception/recept_entry.js')
  delete require.cache[pagePath]
  require(pagePath)
  delete global.Page

  const page = { data: { ...definition.data }, setData(patch) { Object.assign(this.data, patch) } }
  for (const [name, method] of Object.entries(definition)) {
    if (typeof method === 'function') page[name] = method.bind(page)
  }
  page.shopSelected({ detail: { shop: '万龙体验中心', sale: 1, rent: 1, care: 0 } })
  assert.equal(page.data.care, 1)
  Object.assign(page.data, { customerName: '测试', customerCell: '13800138000', gender: '男' })
  page.onBizTap({ currentTarget: { dataset: { type: 'maintain' } } })
  assert.equal(storedDraft.shopName, '万龙服务中心')
  assert.match(navigatedUrl, /shop=%E4%B8%87%E9%BE%99%E6%9C%8D%E5%8A%A1%E4%B8%AD%E5%BF%83/)

  delete global.getApp
  delete global.wx
})
