const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

test('租赁订单列表始终显示门店，领取店仍只在异店列表显示', () => {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/admin/rent/new_rent_list.wxml'), 'utf8')
  assert.match(wxml, /<view class="order-row">\s*<text class="row-label">门店<\/text><text class="row-value row-value--wide">\{\{item\.shop \|\| '--'\}\}<\/text>\s*<\/view>/)
  assert.equal((wxml.match(/>门店<\/text>/g) || []).length, 1)
  assert.match(wxml, /<view wx:if="\{\{crossShopOnly && item\.crossShopsText\}\}" class="order-row">\s*<text class="row-label">领取店<\/text>/)
})
