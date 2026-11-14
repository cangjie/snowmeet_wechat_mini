// 门店选择的「区域」规则（utils/shop_area.js，纯函数）：
//   万龙 = 名字含「万龙」的门店；旗舰 = 崇礼旗舰店；南山 / 怀北 / 渔阳 / 总部等不属于任何区域。
//   两项都勾（默认）和都不勾 = 不限区域；单勾才限定。
//   全部门店时对外发出的 shop：不限区域 → ''；仅万龙 → '万龙服务中心,万龙体验中心'（按门店表顺序）；仅旗舰 → '崇礼旗舰店'（后端按逗号拆开联合查询）。
const test = require('node:test')
const assert = require('node:assert/strict')
const area = require('../utils/shop_area.js')

const SHOPS = [
  { id: 1, name: '万龙服务中心' }, { id: 3, name: '怀北' }, { id: 4, name: '南山' }, { id: 5, name: '渔阳' },
  { id: 9, name: '崇礼旗舰店' }, { id: 10, name: '万龙体验中心' }, { id: 11, name: '总部' }, { id: 12, name: '多呆一会儿吧' }
]
const names = list => list.map(s => s.name)

test('areaOf：万龙看名字含万龙，旗舰只有崇礼旗舰店，其余不属于任何区域', () => {
  assert.equal(area.areaOf('万龙服务中心'), '万龙')
  assert.equal(area.areaOf('万龙体验中心'), '万龙')
  assert.equal(area.areaOf('崇礼旗舰店'), '旗舰')
  for (const other of ['南山', '怀北', '渔阳', '总部', '多呆一会儿吧', '', null, undefined]) assert.equal(area.areaOf(other), '')
})

test('isLimited：只有恰好勾了一项才限定区域；都勾和都不勾都是不限', () => {
  assert.equal(area.isLimited(['万龙', '旗舰']), false)
  assert.equal(area.isLimited([]), false)
  assert.equal(area.isLimited(['万龙']), true)
  assert.equal(area.isLimited(['旗舰']), true)
})

test('shopsForAreas：不限区域列出全部门店，单勾只列该区域的门店（保持原顺序）', () => {
  assert.deepEqual(names(area.shopsForAreas(SHOPS, ['万龙', '旗舰'])), names(SHOPS))
  assert.deepEqual(names(area.shopsForAreas(SHOPS, [])), names(SHOPS))
  assert.deepEqual(names(area.shopsForAreas(SHOPS, ['万龙'])), ['万龙服务中心', '万龙体验中心'])
  assert.deepEqual(names(area.shopsForAreas(SHOPS, ['旗舰'])), ['崇礼旗舰店'])
})

test('shopParam：具体门店发店名；全部门店按区域发空串或逗号串', () => {
  assert.equal(area.shopParam(SHOPS, ['万龙', '旗舰'], ''), '')
  assert.equal(area.shopParam(SHOPS, [], ''), '')
  assert.equal(area.shopParam(SHOPS, ['万龙'], ''), '万龙服务中心,万龙体验中心')
  assert.equal(area.shopParam(SHOPS, ['旗舰'], ''), '崇礼旗舰店')
  assert.equal(area.shopParam(SHOPS, ['万龙'], '万龙体验中心'), '万龙体验中心')
  assert.equal(area.shopParam(SHOPS, ['万龙', '旗舰'], '南山'), '南山')
})

test('shopParam：门店表里缺这个区域的门店时用固定店名兜底，不能悄悄变成查全部', () => {
  assert.equal(area.shopParam([{ id: 4, name: '南山' }], ['万龙'], ''), '万龙服务中心,万龙体验中心')
  assert.equal(area.shopParam([{ id: 4, name: '南山' }], ['旗舰'], ''), '崇礼旗舰店')
})

test('fromShop：由一家店推断区域和门店（beacon 命中 / 基地店兜底共用）', () => {
  assert.deepEqual(area.fromShop('万龙服务中心'), { areas: ['万龙'], shop: '' })      // 万龙任一家 → 只勾万龙 + 全部门店
  assert.deepEqual(area.fromShop('万龙体验中心'), { areas: ['万龙'], shop: '' })
  assert.deepEqual(area.fromShop('崇礼旗舰店'), { areas: ['旗舰'], shop: '' })        // 只勾旗舰（取消万龙）
  assert.deepEqual(area.fromShop('南山'), { areas: ['万龙', '旗舰'], shop: '南山' })   // 不属于任何区域：区域不限 + 选中该店
})

test('contains：当前选中的门店是否还在这组区域的下拉里', () => {
  assert.equal(area.contains(SHOPS, ['万龙'], '万龙服务中心'), true)
  assert.equal(area.contains(SHOPS, ['万龙'], '崇礼旗舰店'), false)
  assert.equal(area.contains(SHOPS, ['旗舰'], '南山'), false)
  assert.equal(area.contains(SHOPS, ['万龙', '旗舰'], '南山'), true)
  assert.equal(area.contains(SHOPS, ['万龙'], ''), true)                             // 全部门店永远在
})

test('isAllLabel：兼容旧的「全部店铺」和新的「全部门店」', () => {
  assert.equal(area.isAllLabel('全部店铺'), true)
  assert.equal(area.isAllLabel('全部门店'), true)
  assert.equal(area.isAllLabel('万龙服务中心'), false)
  assert.equal(area.isAllLabel(''), false)
})
