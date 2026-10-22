const test = require('node:test')
const assert = require('node:assert/strict')

// 2026-10-22 用户决定：养护只按门店自己的养护能力判断。万龙体验中心 care=0，养护置灰，不再改记到服务中心
test('万龙体验中心不能发起养护，只按门店自己的养护能力判断', () => {
  let definition
  let storedDraft
  let navigatedUrl
  const toasts = []
  global.getApp = () => ({ globalData: {} })
  global.Page = (value) => { definition = value }
  global.wx = {
    setStorageSync(key, value) { if (key === 'reception_draft') storedDraft = value },
    navigateTo({ url }) { navigatedUrl = url },
    showToast(o) { toasts.push(o.title) }
  }
  const pagePath = require.resolve('../pages/admin/reception/recept_entry.js')
  delete require.cache[pagePath]
  require(pagePath)
  delete global.Page

  const page = { data: { ...definition.data }, setData(patch) { Object.assign(this.data, patch) } }
  for (const [name, method] of Object.entries(definition)) {
    if (typeof method === 'function') page[name] = method.bind(page)
  }
  Object.assign(page.data, { customerName: '测试', customerCell: '13800138000', gender: '男' })

  page.shopSelected({ detail: { shop: '万龙体验中心', sale: 1, rent: 1, care: 0 } })
  assert.equal(page.data.care, 0)
  page.onBizTap({ currentTarget: { dataset: { type: 'maintain' } } })
  assert.deepEqual(toasts, ['当前店铺不支持养护'])
  assert.equal(navigatedUrl, undefined)

  // 能做养护的门店照常开单，订单门店就是所选门店
  page.shopSelected({ detail: { shop: '万龙服务中心', sale: 1, rent: 1, care: 1 } })
  page.onBizTap({ currentTarget: { dataset: { type: 'maintain' } } })
  assert.equal(storedDraft.shopName, '万龙服务中心')
  assert.match(navigatedUrl, /shop=%E4%B8%87%E9%BE%99%E6%9C%8D%E5%8A%A1%E4%B8%AD%E5%BF%83/)

  delete global.getApp
  delete global.wx
})
