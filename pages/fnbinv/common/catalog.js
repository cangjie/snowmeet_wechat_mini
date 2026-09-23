// 分类维护：二级分类默认值 + 三种储存方式的保质期规则（全年 / 高低温分档）
const expiry = require('./expiry.js')

const BASE_BY_DIMENSION = { 1: 'g', 2: 'ml', 3: 'piece' }

function baseUnitFor(unitCode, units) {
  const unit = (units || []).find(u => u.code === unitCode)
  return unit ? BASE_BY_DIMENSION[unit.dimension] : 'g'
}

function unitWord(unit) {
  return unit === 'month' ? ' 个月' : ' 天'
}

function ruleLine(rules, categoryId) {
  const own = (rules || []).filter(r => r.category_id === categoryId)
  const parts = expiry.STORAGE.map(s => {
    const sum = expiry.summarizeRules(own, s.code)
    if (!sum) return ''
    if (sum.mode === 'all') return s.label + ' ' + sum.value + unitWord(sum.unit)
    if (sum.mode === 'band') return s.label + ' 高温档 ' + sum.warm + unitWord(sum.unit) + ' / 低温档 ' + sum.cold + unitWord(sum.unit)
    return s.label + ' 逐月自定义'
  }).filter(Boolean)
  return parts.length ? parts.join(' · ') : '未设置保质期规则'
}

function ruleEdit(sum) {
  if (!sum) return { mode: 'none', unit: 'day', all: '', warm: '', cold: '' }
  if (sum.mode === 'all') return { mode: 'all', unit: sum.unit, all: String(sum.value), warm: '', cold: '' }
  if (sum.mode === 'band') return { mode: 'band', unit: sum.unit, all: '', warm: String(sum.warm), cold: String(sum.cold) }
  return { mode: 'custom', unit: sum.unit, all: '', warm: '', cold: '' }
}

function str(v) {
  return v === null || v === undefined ? '' : String(v)
}

function editState(category, rules) {
  const own = (rules || []).filter(r => r.category_id === category.id)
  const edit = {
    id: category.id || 0, parentId: category.parent_id || null, level: category.level, name: category.name || '',
    defaultStorage: category.default_storage || 'chilled', defaultUnitCode: category.default_unit_code || 'kg',
    warnDays: category.level === 2 ? str(category.warn_days) : '', defaultOpenStorage: category.default_open_storage || '',
    defaultOpenDays: str(category.default_open_days), sort: category.sort || 0, valid: category.valid !== false, rules: {}
  }
  expiry.STORAGE.forEach(s => { edit.rules[s.code] = ruleEdit(category.id ? expiry.summarizeRules(own, s.code) : null) })
  return edit
}

function categoryBody(edit) {
  const l2 = edit.level === 2
  return {
    id: edit.id, parentId: l2 ? edit.parentId : null, level: edit.level, name: String(edit.name).trim(),
    defaultStorage: l2 ? edit.defaultStorage : null, defaultUnitCode: l2 ? edit.defaultUnitCode : null,
    warnDays: l2 ? Number(edit.warnDays) : null, defaultOpenStorage: l2 && edit.defaultOpenStorage ? edit.defaultOpenStorage : null,
    defaultOpenDays: l2 && edit.defaultOpenDays !== '' ? Number(edit.defaultOpenDays) : null, sort: edit.sort, valid: edit.valid
  }
}

// null=不适用（停用该储存方式规则）；'custom' 不在此修改
function ruleSpec(r) {
  if (r.mode === 'none') return null
  if (r.mode === 'custom') return 'custom'
  if (r.mode === 'all') return { unit: r.unit, warm: Number(r.all), cold: Number(r.all) }
  return { unit: r.unit, warm: Number(r.warm), cold: Number(r.cold) }
}

function positiveInt(v) {
  return v !== '' && Number.isInteger(Number(v)) && Number(v) > 0
}

function validate(edit) {
  if (!String(edit.name || '').trim()) return '请填写分类名称'
  if (edit.level !== 2) return ''
  if (!edit.defaultUnitCode) return '请选择默认计量单位'
  if (edit.warnDays === '' || !Number.isInteger(Number(edit.warnDays)) || Number(edit.warnDays) < 0) return '临期预警天数须为不小于 0 的整数'
  if (edit.defaultOpenDays !== '' && (!Number.isInteger(Number(edit.defaultOpenDays)) || Number(edit.defaultOpenDays) < 0)) return '开封后天数须为不小于 0 的整数'
  for (const s of expiry.STORAGE) {
    const r = edit.rules[s.code]
    if (r.mode === 'all' && !positiveInt(r.all)) return s.label + '保质期须为正整数'
    if (r.mode === 'band' && (!positiveInt(r.warm) || !positiveInt(r.cold))) return s.label + '高温档、低温档保质期都要填正整数'
  }
  return ''
}

function newMaterialCode(now) {
  const suffix = Math.floor(Math.random() * 36 * 36).toString(36)
  return ('M' + Number(now || Date.now()).toString(36) + suffix).toUpperCase().slice(0, 64)
}

module.exports = { baseUnitFor, ruleLine, editState, categoryBody, ruleSpec, validate, newMaterialCode }
