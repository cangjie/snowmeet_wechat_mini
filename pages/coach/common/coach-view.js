// 教练平台的展示与表单转换（纯函数，便于测试）：价格摘要、养护 4 格编辑模型、状态文案
const SHOPS = ['万龙服务中心', '崇礼旗舰店']
const TIERS = ['单项', '双项']
const SHORT = { 万龙服务中心: '万龙', 崇礼旗舰店: '崇礼' }
const MODES = [{ key: 'none', label: '无' }, { key: 'rate', label: '折扣' }, { key: 'fixed', label: '一口价' }]

const round1 = v => Math.round(v * 100) / 10          // 0.85 → 8.5
const num = v => (Math.round(Number(v) * 100) / 100).toString()

// 单格显示：无 / 8折 / ¥68
function cellText(cell) {
  if (!cell || cell.mode === 'none') return '无'
  if (cell.mode === 'rate') return round1(cell.value) + '折'
  return '¥' + num(cell.value)
}
function rentalText(rate) { return rate === null || rate === undefined ? '不优惠' : round1(rate) + '折' }

function findCell(cells, shop, tier) {
  return (cells || []).find(c => c.shop === shop && c.tier === tier) || null
}

// 列表里的价格摘要：[ '万龙 单8折 双8折', '崇礼 单¥68 双¥128', '租赁 9折' ]
function priceChips(carePrices, rentalRate) {
  const chips = SHOPS.map(shop => {
    const one = cellText(findCell(carePrices, shop, '单项'))
    const two = cellText(findCell(carePrices, shop, '双项'))
    return SHORT[shop] + ' 单' + one + ' 双' + two
  })
  chips.push('租赁 ' + rentalText(rentalRate))
  return chips
}

// 编辑模型：固定 4 格，value 用输入框文本（折扣按「折」填，如 8 = 8 折；一口价按元）
function editCells(carePrices) {
  const cells = []
  SHOPS.forEach(shop => TIERS.forEach(tier => {
    const c = findCell(carePrices, shop, tier)
    const mode = c ? c.mode : 'none'
    cells.push({
      key: shop + tier, shop, tier, mode,
      text: !c || mode === 'none' ? '' : (mode === 'rate' ? String(round1(c.value)) : num(c.value))
    })
  }))
  return cells
}

// 把编辑模型转成接口入参；校验不过返回 { error }
function cellsPayload(cells) {
  const care = []
  for (const c of cells) {
    if (c.mode === 'none') { care.push({ shop: c.shop, tier: c.tier, mode: 'none', value: 0 }); continue }
    const v = Number(c.text)
    const label = SHORT[c.shop] + c.tier
    if (c.text === '' || !isFinite(v)) return { error: label + '：请填写' + (c.mode === 'rate' ? '折扣' : '一口价') }
    if (c.mode === 'rate') {
      if (!(v > 0 && v <= 10)) return { error: label + '：折扣填 0.1～10（8 表示 8 折）' }
      care.push({ shop: c.shop, tier: c.tier, mode: 'rate', value: Math.round(v * 10) / 100 })
    } else {
      if (!(v >= 0)) return { error: label + '：一口价不能为负数' }
      care.push({ shop: c.shop, tier: c.tier, mode: 'fixed', value: Math.round(v * 100) / 100 })
    }
  }
  return { care }
}

// 租赁折扣率输入：空 = 不优惠；8.5 → 0.85
function rentalPayload(text) {
  const t = String(text === undefined || text === null ? '' : text).trim()
  if (t === '') return { rate: null }
  const v = Number(t)
  if (!isFinite(v) || !(v > 0 && v <= 10)) return { error: '租赁折扣填 0.1～10（9 表示 9 折），不优惠请留空' }
  return { rate: Math.round(v * 10) / 100 }
}
function rentalEditText(rate) { return rate === null || rate === undefined ? '' : String(round1(rate)) }

// 试算：养护按「原价」算优惠后的教练价
function previewPrice(cell, base) {
  if (!cell || cell.mode === 'none') return { price: base, discount: 0 }
  let price = base
  if (cell.mode === 'rate') price = Math.round(base * Number(cell.value) * 100) / 100
  else price = Math.min(base, Number(cell.value))
  return { price: Math.round(price * 100) / 100, discount: Math.round((base - price) * 100) / 100 }
}

const CARD_STATUS = {
  issued: { text: '待领取', tone: 'warn' },
  claimed: { text: '已领取', tone: 'ok' },
  revoked: { text: '已撤销', tone: 'danger' },
  merged: { text: '已作废', tone: 'muted' }
}
const statusTag = s => CARD_STATUS[s] || { text: s, tone: 'muted' }

function dateText(v) {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  const p = n => (n < 10 ? '0' + n : '' + n)
  return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}
function dayText(v) {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  const p = n => (n < 10 ? '0' + n : '' + n)
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// 学员卡权益三行：门店养护 + 租赁，用在教练首页卡面和领取页
function benefitLines(carePrices, rentalRate) {
  const lines = SHOPS.map(shop => ({
    label: shop + ' · 养护',
    one: cellText(findCell(carePrices, shop, '单项')),
    two: cellText(findCell(carePrices, shop, '双项'))
  }))
  return { lines, rental: rentalText(rentalRate) }
}

module.exports = {
  SHOPS, TIERS, SHORT, MODES, cellText, rentalText, priceChips, editCells, cellsPayload, rentalPayload, rentalEditText,
  previewPrice, statusTag, dateText, dayText, benefitLines
}
