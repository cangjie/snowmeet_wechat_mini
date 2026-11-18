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


// ---- 机构自己制作会员卡：管理员设底价（下限），机构在底价之内设置 ----
function floorHint(c) {
  if (!c || !c.open) return '管理员未开放'
  const parts = []
  if (c.minRate !== null && c.minRate !== undefined) parts.push('折扣不低于 ' + round1(c.minRate) + ' 折')
  if (c.minFixed !== null && c.minFixed !== undefined) parts.push('一口价不低于 ¥' + num(c.minFixed))
  return parts.join('，')
}

// 会籍卡每格能用的方式（一口价 / 折扣）：只列管理员在「会籍卡底价」里设置了的；没设置的方式不出现，免得误导（用户 2026-11-17）
const CARD_MODE_LABEL = { fixed: '一口价', rate: '折扣' }

function cardUnit(c) {
  const key = c.mode !== 'none' ? c.mode : (c.modes.length === 1 ? c.modes[0].key : '')
  return key === 'rate' ? '折' : (key === 'fixed' ? '元' : '')
}
function cardPlaceholder(c) {
  if (c.modes.length === 1) return CARD_MODE_LABEL[c.modes[0].key] + '，' + (c.modes[0].key === 'rate' ? '8 表示 8 折' : '元') + '；留空 = 不优惠'
  return '先选方式；留空 = 不优惠'
}

// 服务端卡种 / 会籍卡标准的 cells → 编辑模型。固定 4 格，但**只有管理员开放了的格子才显示**（visible），
// 每格只显示底价里设置了的方式（modes）；只设置了一种方式的格子不出方式按钮，直接一个输入框，留空 = 不优惠。
// 已经设置着、但现在底价里不再开放的方式仍然显示出来（标红提示），否则机构看不到也改不掉。
function standardCells(cells) {
  const base = editCells(cells)
  let lastShop = null
  return base.map(b => {
    const c = findCell(cells, b.shop, b.tier) || {}
    const minRate = c.minRate === undefined ? null : c.minRate
    const minFixed = c.minFixed === undefined ? null : c.minFixed
    const modes = []
    if (minFixed !== null) modes.push({ key: 'fixed', label: CARD_MODE_LABEL.fixed })
    if (minRate !== null) modes.push({ key: 'rate', label: CARD_MODE_LABEL.rate })
    if (b.mode !== 'none' && !modes.some(m => m.key === b.mode)) modes.push({ key: b.mode, label: CARD_MODE_LABEL[b.mode] || b.mode })
    const visible = !!c.open || b.mode !== 'none'
    const cell = Object.assign({}, b, {
      open: !!c.open, minRate, minFixed, belowFloor: !!c.belowFloor, hint: floorHint(c), modes, visible,
      showShop: visible && lastShop !== b.shop
    })
    if (visible) lastShop = b.shop
    cell.unit = cardUnit(cell)
    cell.placeholder = cardPlaceholder(cell)
    return cell
  })
}

// 把表单里的格子整理成「有效方式」：留空 = 不优惠；只有一种方式的格子填了数就是那种方式；有多种方式却没选的返回 ambiguous
function effectiveStandardCell(c) {
  const blank = String(c.text === undefined || c.text === null ? '' : c.text).trim() === ''
  if (blank) return Object.assign({}, c, { mode: 'none', text: '' })
  if (c.modes.length === 0) return Object.assign({}, c, { mode: 'closed' })        // 没开放的格子里不该有数
  if (c.mode !== 'none' && c.modes.some(m => m.key === c.mode)) return c
  if (c.modes.length === 1) return Object.assign({}, c, { mode: c.modes[0].key })
  return Object.assign({}, c, { mode: 'ambiguous' })
}

function rentalStandard(rental) {
  const r = rental || {}
  const minRate = r.minRate === undefined ? null : r.minRate
  return {
    text: rentalEditText(r.rate), open: !!r.open, minRate, belowFloor: !!r.belowFloor,
    hint: r.open && minRate !== null ? '折扣不低于 ' + round1(minRate) + ' 折' : '管理员未开放'
  }
}

// 保存前先在本地按底价检查一遍（服务端仍会再校验）；返回 { care, rate } 或 { error }
function standardPayload(rawCells, rentalText, rental) {
  const cells = rawCells.map(effectiveStandardCell)
  const closed = cells.find(c => c.mode === 'closed')
  if (closed) return { error: SHORT[closed.shop] + closed.tier + '：管理员还没有开放这一项' }
  const unclear = cells.find(c => c.mode === 'ambiguous')
  if (unclear) return { error: SHORT[unclear.shop] + unclear.tier + '：请选择一口价或折扣' }
  const parsed = cellsPayload(cells)
  if (parsed.error) return parsed
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    const p = parsed.care[i]
    const label = SHORT[c.shop] + c.tier
    if (p.mode === 'none') continue
    if (!c.open) return { error: label + '：管理员还没有开放这一项' }
    if (p.mode === 'rate') {
      if (c.minRate === null) return { error: label + '：这一项只开放了一口价，不能设折扣' }
      if (p.value + 1e-9 < c.minRate) return { error: label + '：折扣不能低于 ' + round1(c.minRate) + ' 折' }
    } else {
      if (c.minFixed === null) return { error: label + '：这一项只开放了折扣，不能设一口价' }
      if (p.value + 1e-9 < c.minFixed) return { error: label + '：一口价不能低于 ¥' + num(c.minFixed) }
    }
  }
  const r = rentalPayload(rentalText)
  if (r.error) return r
  if (r.rate !== null) {
    if (!rental || !rental.open || rental.minRate === null) return { error: '租赁：管理员还没有开放租赁折扣' }
    if (r.rate + 1e-9 < rental.minRate) return { error: '租赁：折扣不能低于 ' + round1(rental.minRate) + ' 折' }
  }
  return { care: parsed.care, rate: r.rate }
}

// ---- 管理员设底价 ----
function floorEditCells(floorView) {
  const list = (floorView && floorView.care) || []
  const cells = []
  SHOPS.forEach(shop => TIERS.forEach(tier => {
    const f = list.find(x => x.shop === shop && x.tier === tier) || {}
    cells.push({
      key: shop + tier, shop, tier,
      rateText: f.minRate === null || f.minRate === undefined ? '' : String(round1(f.minRate)),
      fixedText: f.minFixed === null || f.minFixed === undefined ? '' : num(f.minFixed)
    })
  }))
  return cells
}

function floorRentalText(floorView) {
  const r = floorView && floorView.rentalMinRate
  return r === null || r === undefined ? '' : String(round1(r))
}

// 空 = 不设（该方式不开放）；折扣按「折」填（7 = 7 折），一口价按元
function floorsPayload(cells, rentalText) {
  const care = []
  for (const c of cells) {
    const label = SHORT[c.shop] + c.tier
    let minRate = null, minFixed = null
    const rt = String(c.rateText === undefined || c.rateText === null ? '' : c.rateText).trim()
    const ft = String(c.fixedText === undefined || c.fixedText === null ? '' : c.fixedText).trim()
    if (rt !== '') {
      const v = Number(rt)
      if (!isFinite(v) || !(v > 0 && v <= 10)) return { error: label + '：最低折扣填 0.1～10（7 表示 7 折）' }
      minRate = Math.round(v * 10) / 100
    }
    if (ft !== '') {
      const v = Number(ft)
      if (!isFinite(v) || !(v >= 0)) return { error: label + '：最低一口价不能为负数' }
      minFixed = Math.round(v * 100) / 100
    }
    care.push({ shop: c.shop, tier: c.tier, min_rate: minRate, min_fixed: minFixed })
  }
  const rt = String(rentalText === undefined || rentalText === null ? '' : rentalText).trim()
  let rentalMin = null
  if (rt !== '') {
    const v = Number(rt)
    if (!isFinite(v) || !(v > 0 && v <= 10)) return { error: '租赁：最低折扣填 0.1～10（8 表示 8 折）' }
    rentalMin = Math.round(v * 10) / 100
  }
  return { care, rentalMinRate: rentalMin }
}

// ---- 分销商（教练 / KOL / 机构）自己生成单张优惠券：能做的格子和方式来自管理员设的「优惠券底价」----
const COUPON_MAX = 50
const COUPON_MODE_LABEL = { fixed: '一口价', rate: '折扣', off: '减免' }
const COUPON_MODE_ORDER = ['fixed', 'rate', 'off']

function couponModeHint(c) {
  const parts = []
  if (c.minFixed !== null && c.minFixed !== undefined) parts.push('一口价不低于 ¥' + num(c.minFixed))
  if (c.minRate !== null && c.minRate !== undefined) parts.push('折扣不低于 ' + round1(c.minRate) + ' 折')
  if (c.maxOff !== null && c.maxOff !== undefined) parts.push('减免不超过 ¥' + num(c.maxOff))
  return parts.join('，')
}

// 服务端 GetMyCouponMaker 的 cells → 选择项。**只保留管理员开放了的格子，每格只保留设置了的方式**；
// 没设置的格子和方式不返回，页面上就不会出现（用户 2026-11-17：没设置的不要显示出来，免得误导）
function couponCells(cells) {
  return (cells || []).filter(c => c.open && c.productReady && Array.isArray(c.modes) && c.modes.length > 0).map(c => {
    const modes = COUPON_MODE_ORDER.filter(k => c.modes.indexOf(k) >= 0).map(k => ({ key: k, label: COUPON_MODE_LABEL[k] }))
    return {
      key: c.shop + c.tier, shop: c.shop, tier: c.tier, label: SHORT[c.shop] + c.tier, modes,
      minFixed: c.minFixed === undefined ? null : c.minFixed, minRate: c.minRate === undefined ? null : c.minRate, maxOff: c.maxOff === undefined ? null : c.maxOff,
      hint: couponModeHint(c)
    }
  })
}

// 表单 → 接口入参；校验不过返回 { error }（服务端仍会再按底价校验一遍）
// max：这一批最多多少张（服务端 GetMyCouponMaker 的 maxBatchSize；不传按旧版「一次生成」的 50）
function couponPayload(cell, mode, valueText, countText, max) {
  if (!cell) return { error: '请选择一个项目' }
  if (!mode || !cell.modes.some(m => m.key === mode)) return { error: '请选择优惠方式' }
  const t = String(valueText === undefined || valueText === null ? '' : valueText).trim()
  const v = Number(t)
  if (t === '' || !isFinite(v)) return { error: '请填写' + COUPON_MODE_LABEL[mode] }
  let value
  if (mode === 'rate') {
    if (!(v > 0 && v <= 10)) return { error: '折扣填 0.1～10（8 表示 8 折）' }
    value = Math.round(v * 10) / 100
    if (value + 1e-9 < cell.minRate) return { error: cell.label + '：折扣不能低于 ' + round1(cell.minRate) + ' 折' }
  } else if (mode === 'fixed') {
    if (!(v >= 0)) return { error: '一口价不能为负数' }
    value = Math.round(v * 100) / 100
    if (value + 1e-9 < cell.minFixed) return { error: cell.label + '：一口价不能低于 ¥' + num(cell.minFixed) }
  } else {
    if (!(v > 0)) return { error: '减免金额要大于 0' }
    value = Math.round(v * 100) / 100
    if (value > cell.maxOff + 1e-9) return { error: cell.label + '：减免不能超过 ¥' + num(cell.maxOff) }
  }
  const n = Number(countText)
  const limit = Number.isInteger(max) && max > 0 ? max : COUPON_MAX
  if (!Number.isInteger(n) || n < 1 || n > limit) return { error: '张数填 1～' + limit }
  return { shop: cell.shop, tier: cell.tier, mode, value, count: n }
}

// ---- 创建优惠券批次的表单（用户 2026-11-18：一张优惠券可以适用于不同的服务，和做会员卡选项目一样，每个服务各自定价）----
// 每个管理员开放了的服务（门店 × 单项 / 双项）一行：有多种方式（一口价 / 折扣 / 减免）的出方式按钮，只有一种的直接一个输入框；
// 留空 = 这张券不适用于这个服务。每格的底价提示来自管理员设的优惠券底价。
function couponUnit(c) {
  const key = c.mode && c.mode !== 'none' ? c.mode : (c.modes.length === 1 ? c.modes[0].key : '')
  return key === 'rate' ? '折' : (key === 'fixed' || key === 'off' ? '元' : '')
}
function couponPlaceholder(c) {
  const key = c.mode && c.mode !== 'none' ? c.mode : (c.modes.length === 1 ? c.modes[0].key : '')
  if (!key) return '先选方式；留空 = 不适用'
  return (key === 'rate' ? '折扣，8 表示 8 折' : (key === 'fixed' ? '一口价，元' : '减免金额，元')) + '；留空 = 不适用'
}
function couponEditCells(cells) {
  let lastShop = null
  return couponCells(cells).map(c => {
    const cell = Object.assign({}, c, { mode: c.modes.length === 1 ? c.modes[0].key : 'none', text: '', showShop: lastShop !== c.shop })
    lastShop = c.shop
    cell.unit = couponUnit(cell)
    cell.placeholder = couponPlaceholder(cell)
    return cell
  })
}

// 券名：最多 24 个汉字（服务端 varchar(50)，汉字 2 字节，按 48 字节算），不能带表情、¥ 这类 GBK 里没有的符号
function couponNameError(raw) {
  const name = String(raw === undefined || raw === null ? '' : raw).trim()
  if (!name) return '请填写券名'
  if (/[\u0000-\u001f\u007f-\u009f\ud800-\udfff¥￥]/.test(name)) return '券名里不要用表情、¥ 等特殊符号，写成「68元」这样'
  const bytes = Array.from(name).reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)
  if (bytes > 48) return '券名太长了，最多 24 个汉字'
  return ''
}

// 表单 → 批次入参：券名、每个填了价格的服务（门店、档位、方式、数值）、张数。校验不过返回 { error }（逐格校验，一次说清所有问题；
// 服务端仍会再按底价校验一遍）
function couponBatchPayload(editCells, nameText, countText, max) {
  const nameError = couponNameError(nameText)
  if (nameError) return { error: nameError }
  const problems = []
  const items = []
  ;(editCells || []).forEach(c => {
    const blank = String(c.text === undefined || c.text === null ? '' : c.text).trim() === ''
    if (blank) return
    const mode = c.mode !== 'none' && c.modes.some(m => m.key === c.mode) ? c.mode : (c.modes.length === 1 ? c.modes[0].key : '')
    if (!mode) { problems.push(c.label + '：请选择优惠方式'); return }
    const r = couponPayload(c, mode, c.text, '1', 1)
    if (r.error) { problems.push(r.error.indexOf(c.label) >= 0 ? r.error : c.label + '：' + r.error); return }
    items.push({ shop: r.shop, tier: r.tier, mode: r.mode, value: r.value })
  })
  if (problems.length) return { error: problems.join('；') }
  if (!items.length) return { error: '请至少给一个服务设置价格' }
  const limit = Number.isInteger(max) && max > 0 ? max : COUPON_MAX
  const n = Number(countText)
  if (!Number.isInteger(n) || n < 1 || n > limit) return { error: '张数填 1～' + limit }
  return { name: String(nameText).trim(), items, count: n }
}

// 优惠券批次的一行（用户 2026-11-18）：每做一次 = 一个分享批次，规定张数；领取人（头像、昵称、券码、有没有用）在展开的领取记录里
function batchRow(b) {
  const x = b || {}
  const total = Number(x.total) || 0, claimed = Number(x.claimed) || 0
  const claimers = (x.claimers || []).map(c => {
    const nick = c.nickName || c.name || ''
    return {
      memberId: c.memberId, ticketCode: c.ticketCode || '', codeTail: String(c.ticketCode || '').slice(-4), used: !!c.used,
      nickName: nick || '顾客', avatarUrl: c.avatarUrl || '', initial: nick ? Array.from(nick)[0] : '客', phoneTail: c.phoneTail || '', claimed: dateText(c.claimedAt)
    }
  })
  return {
    id: x.id, name: x.name || '优惠券', memo: x.memo || '', total, claimed, remaining: Number(x.remaining) || Math.max(0, total - claimed),
    soldOut: !!x.soldOut, statusText: x.soldOut ? '已领完' : '领取中', tone: x.soldOut ? 'muted' : 'ok',
    progress: '已领 ' + claimed + ' / ' + total + ' 张', canDelete: !!x.canDelete, sharePath: x.sharePath || '', created: dateText(x.createDate), claimers
  }
}

// ---- 管理员设「优惠券底价」（原来的价格设置）：每格三种方式各自可空，空 = 没开放 ----
function couponFloorEditCells(floorView) {
  const list = (floorView && floorView.care) || []
  const cells = []
  SHOPS.forEach(shop => TIERS.forEach(tier => {
    const f = list.find(x => x.shop === shop && x.tier === tier) || {}
    cells.push({
      key: shop + tier, shop, tier,
      fixedText: f.minFixed === null || f.minFixed === undefined ? '' : num(f.minFixed),
      rateText: f.minRate === null || f.minRate === undefined ? '' : String(round1(f.minRate)),
      offText: f.maxOff === null || f.maxOff === undefined ? '' : num(f.maxOff)
    })
  }))
  return cells
}

function couponFloorsPayload(cells) {
  const care = []
  for (const c of cells) {
    const label = SHORT[c.shop] + c.tier
    const read = text => String(text === undefined || text === null ? '' : text).trim()
    let minFixed = null, minRate = null, maxOff = null
    if (read(c.fixedText) !== '') {
      const v = Number(read(c.fixedText))
      if (!isFinite(v) || !(v >= 0)) return { error: label + '：最低一口价不能为负数' }
      minFixed = Math.round(v * 100) / 100
    }
    if (read(c.rateText) !== '') {
      const v = Number(read(c.rateText))
      if (!isFinite(v) || !(v > 0 && v <= 10)) return { error: label + '：最低折扣填 0.1～10（7 表示 7 折）' }
      minRate = Math.round(v * 10) / 100
    }
    if (read(c.offText) !== '') {
      const v = Number(read(c.offText))
      if (!isFinite(v) || !(v > 0)) return { error: label + '：最高减免要大于 0' }
      maxOff = Math.round(v * 100) / 100
    }
    care.push({ shop: c.shop, tier: c.tier, min_fixed: minFixed, min_rate: minRate, max_off: maxOff })
  }
  return { care }
}

const CARD_STATUS = {
  issued: { text: '待领取', tone: 'warn' },
  claimed: { text: '已领取', tone: 'ok' },
  revoked: { text: '已撤销', tone: 'danger' },
  merged: { text: '已作废', tone: 'muted' }
}
const statusTag = s => CARD_STATUS[s] || { text: s, tone: 'muted' }

// 分享记录里的状态：没人领的叫「待领取」；机构自己「删除」的分享（没人领取就撤销）服务端不再列出，
// 列表里还能看到的「已撤销」只会是领取后被管理员撤销的卡（用户 2026-11-18：没领取的可以直接删除）
const SHARE_STATUS = {
  issued: { text: '待领取', tone: 'warn' },
  claimed: { text: '已领取', tone: 'ok' },
  revoked: { text: '已撤销', tone: 'muted' },
  merged: { text: '已作废', tone: 'muted' }
}
const SHARE_CHANNEL = { qr: '二维码', card: '小程序卡片' }

function dateText(v) {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  const p = n => (n < 10 ? '0' + n : '' + n)
  return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}
// 分享列表的一行：每次分享一条（待领取 / 已领取）；已领取的带领取人的头像、昵称和会籍卡卡号；
// 待领取的可以再次看二维码、再次分享小程序卡片（同一张卡，sharePath 来自服务端），也可以直接删除
function shareRow(card) {
  const c = card || {}
  const st = SHARE_STATUS[c.status] || { text: c.status || '', tone: 'muted' }
  const nick = c.nickName || c.studentName || ''
  return {
    id: c.id, status: c.status, name: c.cardName || '会籍卡', statusText: st.text, tone: st.tone,
    channelText: SHARE_CHANNEL[c.channel] || '', created: dateText(c.createDate), claimed: dateText(c.claimedAt),
    cardNo: c.cardNo || '', nickName: nick, avatarUrl: c.avatarUrl || '', initial: nick ? Array.from(nick)[0] : '',
    canDelete: c.status === 'issued', sharePath: c.sharePath || '', templateId: c.templateId == null ? null : c.templateId, tokenTail: c.tokenTail || ''
  }
}

// 分享记录按卡种分组（每个卡种一个默认折叠的分享记录）；卡种已不在列表里的（旧卡、卡种被停用）归到 other
function groupShares(rows, templateIds) {
  const known = {}
  ;(templateIds || []).forEach(id => { known[id] = true })
  const byTemplate = {}, other = []
  ;(rows || []).forEach(r => {
    if (r.templateId != null && known[r.templateId]) (byTemplate[r.templateId] = byTemplate[r.templateId] || []).push(r)
    else other.push(r)
  })
  const stat = list => ({ total: list.length, pending: list.filter(r => r.status === 'issued').length, claimed: list.filter(r => r.status === 'claimed').length })
  const stats = {}
  ;(templateIds || []).forEach(id => { stats[id] = stat(byTemplate[id] || []) })
  return { byTemplate, stats, other, otherStats: stat(other) }
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
  previewPrice, statusTag, shareRow, groupShares, dateText, dayText, benefitLines,
  floorHint, standardCells, effectiveStandardCell, cardUnit, rentalStandard, standardPayload, floorEditCells, floorRentalText, floorsPayload,
  COUPON_MAX, couponCells, couponPayload, couponUnit, couponPlaceholder, couponEditCells, couponNameError, couponBatchPayload, batchRow, couponFloorEditCells, couponFloorsPayload
}
