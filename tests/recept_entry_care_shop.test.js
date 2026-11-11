const test = require('node:test')
const assert = require('node:assert/strict')

// 2026-10-22 用户决定：养护只按门店自己的养护能力（shop_list.care）判断，前端不再按店名特判。
// 2026-11-09 万龙体验中心的 care 在库里改成 1，也能开养护单——前端这里一行没改，开关就是服务端回传的标志。
// 订单店名和收款商户是后端的事：体验中心开的养护单店名就是万龙体验中心（单号 WT_YH_…），收款进服务中心养护商户（后端 CareExperienceCenterOrderTests）。
test('养护只按门店自己的养护能力判断：care=0 的门店不能发起养护', () => {
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

  page.shopSelected({ detail: { shop: '不做养护的门店', sale: 1, rent: 1, care: 0 } })
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

test('万龙体验中心服务端放开养护（care=1）后能开养护单，开单店名就是体验中心', () => {
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

  // 服务端 shop_list 里体验中心 care=1（租赁 rent=1 本来就有）：养护和租赁都能开
  page.shopSelected({ detail: { shop: '万龙体验中心', sale: 1, rent: 1, care: 1 } })
  assert.equal(page.data.care, 1)
  page.onBizTap({ currentTarget: { dataset: { type: 'maintain' } } })
  assert.deepEqual(toasts, [])
  // 前端不做店名改写：草稿和跳转带的就是所选门店；收款进服务中心商户在后端付款时处理
  assert.equal(storedDraft.shopName, '万龙体验中心')
  assert.match(navigatedUrl, /bizType=maintain/)
  assert.match(navigatedUrl, /shop=%E4%B8%87%E9%BE%99%E4%BD%93%E9%AA%8C%E4%B8%AD%E5%BF%83/)

  navigatedUrl = undefined
  page.onBizTap({ currentTarget: { dataset: { type: 'rent' } } })
  assert.match(navigatedUrl, /bizType=rent/)

  delete global.getApp
  delete global.wx
})

