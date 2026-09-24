// 入库表单 → PostReceipt 请求体。效期来源四选一：包装到期日 / 手填保质期 / 食材保质期规则（来源码仍为 category） / 按生产月份估算
const units = require('./units.js')
const expiry = require('./expiry.js')

function num(v) {
  return v === '' || v === null || v === undefined ? NaN : Number(v)
}

function fail(error) {
  return { ok: false, error }
}

// d.expireDate 只放手填（或识别）的到期日期：有它就以它为准，生产日期和保质期不参与计算、也不提交
function resolveExpiry(d, today) {
  const shelf = num(d.shelfValue)
  if (d.expireDate) {
    return { expireDate: d.expireDate, source: 'package', productionDate: null,
      shelfLifeValue: null, shelfLifeUnit: null, ruleId: null, note: null }
  }
  if (d.prodDate && shelf > 0) {
    const unit = d.shelfUnit || 'day'
    return { expireDate: expiry.calcExpiry(d.prodDate, shelf, unit), source: 'manual', productionDate: d.prodDate,
      shelfLifeValue: shelf, shelfLifeUnit: unit, ruleId: null, note: null }
  }
  if (d.prodDate && d.rule) {
    if (Number(d.prodDate.slice(5, 7)) !== d.rule.production_month) return { error: '食材规则与生产月份不一致，请重新选择日期' }
    return { expireDate: expiry.calcExpiry(d.prodDate, d.rule.shelf_life_value, d.rule.shelf_life_unit), source: 'category',
      productionDate: d.prodDate, shelfLifeValue: d.rule.shelf_life_value, shelfLifeUnit: d.rule.shelf_life_unit, ruleId: d.rule.id, note: null }
  }
  if (d.month && d.rule) {
    const band = expiry.isWarmMonth(d.month) ? '高温档' : '低温档'
    return { expireDate: expiry.calcExpiry(today, d.rule.shelf_life_value, d.rule.shelf_life_unit), source: 'estimated',
      productionDate: null, shelfLifeValue: null, shelfLifeUnit: null, ruleId: null,
      note: '按 ' + d.month + ' 月生产（' + band + '）的食材规则，自入库日 ' + today + ' 起估算' }
  }
  return { error: '请填写到期日期，或填写生产日期由系统按食材规则计算' }
}

function buildReceipt(d, today) {
  if (!d.material) return fail('请先选择食材')
  if (!d.photos || d.photos.length === 0) return fail('请至少拍一张批次照片')
  if (!d.batchNo) return fail('请填写批次号')
  if (!d.storage) return fail('请选择储存方式')
  const qty = num(d.qty)
  if (!(qty > 0)) return fail('请填写数量')
  const price = d.unitPrice === '' || d.unitPrice === undefined || d.unitPrice === null ? 0 : Number(d.unitPrice)
  if (isNaN(price) || price < 0) return fail('单价格式不正确')
  const e = resolveExpiry(d, today)
  if (e.error) return fail(e.error)
  if (e.expireDate < today) return fail('该批次已过期（' + e.expireDate + '），不能入库')
  const baseUnit = d.material.base_unit_code
  const body = {
    requestId: d.requestId, itemId: d.material.id, batchNo: String(d.batchNo).trim(), stockForm: d.packed ? 'sealed' : 'bulk',
    storageType: d.storage, storageLocation: null, quantity: qty, inputUnitCode: d.inputUnit || d.material.default_input_unit_code,
    unitPrice: price, productionDate: e.productionDate, shelfLifeValue: e.shelfLifeValue, shelfLifeUnit: e.shelfLifeUnit,
    expireDate: e.expireDate, warnDays: Number(d.warnDays) || 0, imageIds: d.photos.map(p => p.id),
    packSize: null, packUnitName: null, openStorageType: null, openShelfLifeDays: null,
    expirySource: e.source, expiryNote: e.note, shelfLifeRuleId: e.ruleId
  }
  if (d.packed) {
    if (!Number.isInteger(qty)) return fail('封装按件入库，件数须为整数')
    const size = num(d.packSize)
    if (!(size > 0)) return fail('请填写每件含量')
    if (!d.packName) return fail('请选择包装单位（瓶、袋、盒…）')
    if (!d.openStorage) return fail('请选择开封后储存方式')
    const openDays = num(d.openDays)
    if (!(openDays >= 0) || !Number.isInteger(openDays)) return fail('请填写开封后保质期天数')
    body.inputUnitCode = baseUnit
    body.packSize = units.toBase(size, d.contentUnit || baseUnit, d.units)
    body.packUnitName = d.packName
    body.openStorageType = d.openStorage
    body.openShelfLifeDays = openDays
  }
  return { ok: true, body }
}

// 服务端 GenBatchNo 按已入库批次计数，同一张入库单里未提交的条目会拿到同号，这里递增避让
function nextBatchNo(serverNo, used) {
  const taken = new Set(used || [])
  if (!taken.has(serverNo)) return serverNo
  const m = String(serverNo).match(/^(.*?)(\d+)$/)
  let n = m ? Number(m[2]) : 1
  const width = m ? m[2].length : 0
  const prefix = m ? m[1] : serverNo + '-'
  let candidate = serverNo
  while (taken.has(candidate)) {
    n += 1
    candidate = prefix + String(n).padStart(width, '0')
  }
  return candidate
}

module.exports = { buildReceipt, resolveExpiry, nextBatchNo }
