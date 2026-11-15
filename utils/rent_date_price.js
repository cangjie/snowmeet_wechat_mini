// 租赁开单：起租日期变了，租金/日要按新日期重新算。
// 价格预设（rental.pricePresets[0]）是开单时按当时的起租日期生成的：平日/周末、日场/下午场/夜场都跟日期绑定。
// 改成明天或别的日期后如果不重算，屏幕上的租金还是今天的价（今天 16 点后是夜场价），后端也按这条预设收钱。
// 规则：
//   - 店员手改过租金（manual，含「招待」把租金归零）：价格不动，只把预设挪到新日期；店员定的价不能被日期一改就冲掉。
//   - 否则按价目表取新日期的价：周末/平日看星期几；起租日是今天时按现在的钟点分日场/下午场/夜场，其它日期是日场
//     （和 util.createRentalDetail 开单时的取法一致）。价目表里没有这个日期的价就保留原价，只挪日期。
// 这里只放纯函数；取价目表、写 setData 在 rent_recept_form。
const util = require('./util.js')

function parseLocalDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// 起租日是今天时按钟点分场次，其它日期一律日场
function rentTypeForDate(dateStr, now) {
  const current = now || new Date()
  if (dateStr === util.formatDate(current)) {
    if (current.getHours() >= 16) return '夜场'
    if (current.getHours() >= 13) return '下午场'
  }
  return '日场'
}

function dayTypeForDate(dateStr) {
  const d = parseLocalDate(dateStr)
  return d && util.isWeekend(d) ? '周末' : '平日'
}

// 返回新的价格预设；没有预设也没有价目表价格时返回 null（调用方保持原样）
function repricePreset(preset, priceList, dateStr, now) {
  const date = parseLocalDate(dateStr)
  if (!date) return preset || null
  const rentType = rentTypeForDate(dateStr, now)
  const catalog = (priceList && priceList.length) ? util.getRentPrice(priceList, date, rentType) : null

  if (!preset) {
    if (!catalog) return null
    return {
      id: 0, rental_id: 0, rent_type: catalog.rent_type, rent_date: dateStr, day_type: catalog.day_type,
      scene: catalog.scene || '门市', price: Number(catalog.price) || 0, discount: 0, manual: false,
    }
  }
  const moved = Object.assign({}, preset, { rent_date: dateStr })
  if (preset.manual || !catalog) {
    moved.day_type = dayTypeForDate(dateStr)
    moved.rent_type = rentType
    return moved
  }
  moved.day_type = catalog.day_type
  moved.rent_type = catalog.rent_type
  moved.scene = catalog.scene || preset.scene || '门市'
  moved.price = Number(catalog.price) || 0
  return moved
}

// 价目表（某个场景：门市 / 预约 的价目）里，这一天、现在这个钟点的价；没有就返回 null。
// 租赁开单选「门市价 / 预约价」时用它判断：选中的场景在这一天有没有价（没有就不能切过去）。
function catalogPriceFor(priceList, dateStr, now) {
  const date = parseLocalDate(dateStr)
  if (!date || !priceList || !priceList.length) return null
  return util.getRentPrice(priceList, date, rentTypeForDate(dateStr, now)) || null
}

// 店员改起租日期时，租赁模式怎么跟着变（返回 'delay' / 'now'，不用变返回 null）：
//   改成晚于今天的日期 → 延时租赁，起租钟点自动 00:00（装备当晚发放，那天才开始计费）；
//   改回今天，且原来是延时租赁 → 回到立即租赁，起租钟点是现在；
//   其它情况（改到今天但本来就是立即租赁/先租后取）不动模式。
function modeForDateChange(dateStr, pickType, todayStr) {
  if (!dateStr || !todayStr) return null
  if (dateStr > todayStr) return 'delay'
  if (pickType === '延时租赁') return 'now'
  return null
}

// 开单时新加的租赁（套餐、搜索单品、无码物品）默认怎么起租（2026-11-14 用户要求）：
//   万龙系店铺 → 立即租赁，从现在起；
//   崇礼旗舰店 → 每天 18:00（含）到 24:00 默认「延时租赁」，起租日期是第二天、钟点 00:00，
//                和店员自己点「延时租赁」一样（装备当晚发放，第二天才开始计费，租金按第二天的价）；
//                过了 0 点（0:00～17:59）恢复成「立即租赁」，从现在起，商品和租赁物都一样；
//   其它店 → 不预选，由店员自己选。
// 只决定「这一刻新加的租赁」的默认值：购物车里已有的租赁保持各自的模式，不会跟着时间变。
// 返回的 startDateTime 直接写 rental.start_date；startDateIsWeekend 按起租日期算（不是按今天）。
const CHONGLI_SHOP = '崇礼旗舰店'
const CHONGLI_DELAY_FROM_HOUR = 18

function defaultRentStart(shop, now) {
  const current = now || new Date()
  const name = String(shop || '').trim()
  let pickType = null
  if (name.indexOf('万龙') === 0) pickType = '立即租赁'
  else if (name === CHONGLI_SHOP) pickType = current.getHours() >= CHONGLI_DELAY_FROM_HOUR ? '延时租赁' : '立即租赁'
  const start = new Date(current.getTime())
  let time = String(current.getHours()).padStart(2, '0') + ':' + String(current.getMinutes()).padStart(2, '0')
  if (pickType === '延时租赁') {
    start.setDate(start.getDate() + 1)
    time = '00:00'
  }
  const date = util.formatDate(start)
  return {
    pickType,
    date,
    time,
    startDateTime: `${date}T${time}:00`,
    startDateIsWeekend: util.isWeekend(start),
    // 立即租赁、延时租赁装备当场（当晚）发放；先租后取不发放；没选模式时按未发放
    atOnce: pickType === '立即租赁' || pickType === '延时租赁',
  }
}

module.exports = { parseLocalDate, rentTypeForDate, dayTypeForDate, repricePreset, modeForDateChange, defaultRentStart, catalogPriceFor }
