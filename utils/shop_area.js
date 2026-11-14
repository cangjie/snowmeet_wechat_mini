// 门店「区域」规则（shop-selector 组件的纯函数部分，好单测）。
//   万龙 = 名字含「万龙」的门店（万龙体验中心、万龙服务中心）；旗舰 = 崇礼旗舰店；
//   南山 / 怀北 / 渔阳 / 总部等不属于任何区域，只在区域不限时出现在门店下拉里。
//   两项都勾（默认）和都不勾 = 不限区域；恰好勾一项才限定。
//   区域不改库、不加字段：和后端 TenpayController.GetMchId 一样按店名判断。
const WANLONG = '万龙'
const FLAGSHIP = '旗舰'
const AREAS = [WANLONG, FLAGSHIP]
const FLAGSHIP_SHOP = '崇礼旗舰店'
const WANLONG_SHOPS = ['万龙服务中心', '万龙体验中心']
const ALL_LABEL = '全部门店'
const ALL_LABELS = ['全部门店', '全部店铺']   // 旧页面 / AI 查询传的是「全部店铺」

function isAllLabel(name) { return ALL_LABELS.indexOf(name) >= 0 }

function areaOf(name) {
  if (!name) return ''
  if (String(name).indexOf('万龙') >= 0) return WANLONG
  if (name === FLAGSHIP_SHOP) return FLAGSHIP
  return ''
}

function isLimited(areas) {
  return (areas || []).filter(function (a) { return AREAS.indexOf(a) >= 0 }).length === 1
}

function shopsForAreas(shopList, areas) {
  var list = shopList || []
  if (!isLimited(areas)) return list.slice()
  var want = areas.filter(function (a) { return AREAS.indexOf(a) >= 0 })[0]
  return list.filter(function (s) { return areaOf(s.name) === want })
}

// 对外发出的 shop：具体门店 → 店名；全部门店 → 不限区域是 ''（后端当全部），限定区域是该区域的店名（万龙是逗号串，后端联合查询）
function shopParam(shopList, areas, shopName) {
  if (shopName) return shopName
  if (!isLimited(areas)) return ''
  var names = shopsForAreas(shopList, areas).map(function (s) { return s.name })
  if (names.length > 0) return names.join(',')
  // 门店表里没有这个区域的门店时用固定店名兜底，不能悄悄变成查全部
  return areas.indexOf(WANLONG) >= 0 ? WANLONG_SHOPS.join(',') : FLAGSHIP_SHOP
}

// 由一家店推断区域和门店：万龙 → 只勾万龙 + 全部门店；崇礼旗舰店 → 只勾旗舰 + 全部门店；其它 → 区域不限 + 选中该店
function fromShop(shopName) {
  var a = areaOf(shopName)
  if (a) return { areas: [a], shop: '' }
  return { areas: AREAS.slice(), shop: shopName || '' }
}

// 当前选中的门店是否还在这组区域的下拉里（全部门店永远在）
function contains(shopList, areas, shopName) {
  if (!shopName) return true
  return shopsForAreas(shopList, areas).some(function (s) { return s.name === shopName })
}

module.exports = {
  WANLONG, FLAGSHIP, AREAS, ALL_LABEL, ALL_LABELS,
  isAllLabel, areaOf, isLimited, shopsForAreas, shopParam, fromShop, contains
}
