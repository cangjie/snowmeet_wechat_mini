// 食材数量与单位：服务端以 g / ml / piece 为基本单位保存，界面满 1000 换成 kg / L 显示
const NAMES = { g: 'g', kg: 'kg', ml: 'ml', l: 'L', piece: '个' }
const BIG = { g: 'kg', ml: 'L' }

function trimNum(n) {
  const value = Number(n) || 0
  const digits = Math.abs(value) < 0.1 ? 3 : 2
  return String(Number(value.toFixed(digits)))
}

function unitName(code) {
  return NAMES[code] || code || ''
}

function formatQty(qty, baseUnit) {
  const value = Number(qty) || 0
  if (BIG[baseUnit] && Math.abs(value) >= 1000) return trimNum(value / 1000) + ' ' + BIG[baseUnit]
  return trimNum(value) + ' ' + unitName(baseUnit)
}

function toBase(qty, unitCode, units) {
  const unit = (units || []).find(u => u.code === unitCode)
  return Math.round(Number(qty) * (unit ? Number(unit.factor_to_base) : 1) * 1e6) / 1e6
}

function fromBase(qty, unitCode, units) {
  const unit = (units || []).find(u => u.code === unitCode)
  return Math.round(Number(qty) / (unit ? Number(unit.factor_to_base) : 1) * 1e6) / 1e6
}

function inputUnitsFor(baseUnit, units) {
  const base = (units || []).find(u => u.code === baseUnit)
  if (!base) return []
  return units.filter(u => u.dimension === base.dimension && u.valid !== false)
}

// 封装含量的单位选项：全部单位都列出；选了食材后，与其计量方式（重量 / 体积 / 个数）不同的置灰，因为换算不到库存基本单位
function contentUnitOptions(baseUnit, units) {
  const base = (units || []).find(u => u.code === baseUnit)
  return (units || []).filter(u => u.valid !== false)
    .map(u => ({ code: u.code, label: unitName(u.code), off: !!base && u.dimension !== base.dimension }))
}

function money(amount) {
  return '¥' + Number(amount || 0).toFixed(2)
}

module.exports = { trimNum, unitName, formatQty, toBase, fromBase, inputUnitsFor, contentUnitOptions, money }
