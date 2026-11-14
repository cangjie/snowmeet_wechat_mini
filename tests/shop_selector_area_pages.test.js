// 7 个查询 / 报表页用带区域行的门店选择；开单入口和租赁设置页（门店是写入目标）保持不带区域。
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
const QUERY_PAGES = [
  'pages/admin/care/care_order_list', 'pages/admin/care/care_unfinished_list', 'pages/admin/care/care_unpicked_list',
  'pages/admin/rent/new_rent_list', 'pages/admin/retail/retail_order_list', 'pages/admin/rent/unreturned',
  'pages/careadmin/workload/workload'
]
const WRITE_PAGES = [
  'pages/admin/reception/recept_entry', 'pages/admin/reception/recept_member',
  'pages/admin/rent/settings/rent_package', 'pages/admin/rent/settings/rent_product', 'pages/admin/rent/settings/rent_product_add'
]

function selectorTags(wxml) {
  return wxml.match(/<shop-selector[^>]*>/gs) || []
}

test('查询 / 报表页：每个 shop-selector 都带 show-area 和各页的行样式类', () => {
  for (const page of QUERY_PAGES) {
    const tags = selectorTags(read(page + '.wxml'))
    assert.ok(tags.length >= 1, page)
    for (const tag of tags) {
      assert.match(tag, /show-area="\{\{true\}\}"/, page)
      assert.match(tag, /row-class="[\w-]+"/, page)
      assert.match(tag, /label-class="[\w-]+"/, page)
      assert.match(tag, /value-class="[\w-]+"/, page)
    }
  }
})

test('查询 / 报表页：行样式类在页面 wxss 里确实有定义，页面里不再有手写的「店铺」筛选标签', () => {
  for (const page of QUERY_PAGES) {
    const wxml = read(page + '.wxml')
    const wxss = read(page + '.wxss')
    for (const tag of selectorTags(wxml)) {
      for (const attr of ['row-class', 'label-class', 'value-class']) {
        const cls = tag.match(new RegExp(attr + '="([\\w-]+)"'))[1]
        assert.ok(new RegExp('\\.' + cls + '\\b').test(wxss), page + ' 缺少 .' + cls)
      }
    }
    assert.equal(/class="filter-label">店铺</.test(wxml), false, page)
    assert.equal(/【店铺】/.test(wxml), false, page)
    assert.equal(/全部店铺/.test(wxml), false, page + ' 还在传旧的「全部店铺」')
  }
})

test('开单入口 / 设置页不带区域行（门店是写入目标）', () => {
  for (const page of WRITE_PAGES) {
    for (const tag of selectorTags(read(page + '.wxml'))) assert.equal(/show-area/.test(tag), false, page)
  }
})
