// 分类维护：二级分类只有名称和建议储存方式；
// 计量单位、临期提醒、开封后默认和三种储存方式的保质期规则（全年 / 高低温分档）都在具体食材上
const expiry = require('./expiry.js')

const BASE_BY_DIMENSION = { 1: 'g', 2: 'ml', 3: 'piece' }
// 新建食材的临期提前提醒默认天数，按分类建议储存方式给：生鲜 1 天、冻品 7 天、干货 30 天
const WARN_BY_STORAGE = { chilled: 1, frozen: 7, ambient: 30 }

function baseUnitFor(unitCode, units) {
  const unit = (units || []).find(u => u.code === unitCode)
  return unit ? BASE_BY_DIMENSION[unit.dimension] : 'g'
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

function categoryEditState(category) {
  return { id: category.id || 0, parentId: category.parent_id || null, level: category.level, name: category.name || '',
    defaultStorage: category.default_storage || 'chilled', sort: category.sort || 0, valid: category.valid !== false }
}

function categoryBody(edit) {
  const l2 = edit.level === 2
  return { id: edit.id, parentId: l2 ? edit.parentId : null, level: edit.level, name: String(edit.name).trim(),
    defaultStorage: l2 ? edit.defaultStorage : null, sort: edit.sort, valid: edit.valid }
}

function validateCategory(edit) {
  if (!String(edit.name || '').trim()) return '请填写分类名称'
  if (edit.level === 2 && !edit.defaultStorage) return '请选择建议储存方式'
  return ''
}

// 食材编辑态；新建（material 无 id）时按所属二级分类的建议储存方式给默认值
function materialEditState(material, category, rules) {
  const m = material || {}
  const storage = (category && category.default_storage) || 'chilled'
  const own = m.id ? (rules || []).filter(r => r.item_id === m.id) : []
  const edit = {
    id: m.id || 0, code: m.code || '', name: m.name || '', categoryId: m.category_id || (category ? category.id : 0),
    categoryName: category ? category.name : '', itemType: m.item_type || 'raw',
    inputUnit: m.default_input_unit_code || 'kg', baseUnit: m.base_unit_code || '',
    warnDays: m.id ? str(m.warn_days) : String(WARN_BY_STORAGE[storage]),
    openStorage: m.id ? (m.default_open_storage || '') : storage, openDays: m.id ? str(m.default_open_days) : '',
    imageId: m.image_id || null, remark: m.remark || null, rules: {}
  }
  expiry.STORAGE.forEach(s => { edit.rules[s.code] = ruleEdit(m.id ? expiry.summarizeRules(own, s.code) : null) })
  return edit
}

function materialBody(edit, units, now) {
  return {
    id: edit.id, code: edit.code || newMaterialCode(now), name: String(edit.name).trim(), categoryId: edit.categoryId,
    itemType: edit.itemType, baseUnitCode: edit.id ? edit.baseUnit : baseUnitFor(edit.inputUnit, units),
    defaultInputUnitCode: edit.inputUnit, warnDays: Number(edit.warnDays),
    defaultOpenStorage: edit.openStorage || null, defaultOpenDays: edit.openDays === '' ? null : Number(edit.openDays),
    imageId: edit.imageId || null, remark: edit.remark || null, valid: true
  }
}

// null=不适用（停用该储存方式规则）；'custom' 不在此修改
function ruleSpec(r) {
  if (r.mode === 'none') return null
  if (r.mode === 'custom') return 'custom'
  if (r.mode === 'all') return { unit: r.unit, warm: Number(r.all), cold: Number(r.all) }
  return { unit: r.unit, warm: Number(r.warm), cold: Number(r.cold) }
}

// 食材保存后要补发的 SaveShelfLifeRule 请求体（只含有变化的月份）
function rulePlans(existing, itemId, rules) {
  return expiry.STORAGE.reduce((all, s) => {
    const spec = ruleSpec(rules[s.code])
    return spec === 'custom' ? all : all.concat(expiry.planRuleSaves(existing, itemId, s.code, spec))
  }, [])
}

function positiveInt(v) {
  return v !== '' && Number.isInteger(Number(v)) && Number(v) > 0
}

function nonNegativeInt(v) {
  return String(v).trim() !== '' && Number.isInteger(Number(v)) && Number(v) >= 0
}

function validateMaterial(edit, units) {
  if (!String(edit.name || '').trim()) return '请填写食材名称'
  if (!edit.inputUnit) return '请选择计量单位'
  if (edit.id && baseUnitFor(edit.inputUnit, units) !== edit.baseUnit) return '录入单位须与原计量方式一致'
  if (!nonNegativeInt(edit.warnDays)) return '临期提醒天数须为不小于 0 的整数'
  if (edit.openDays !== '' && !nonNegativeInt(edit.openDays)) return '开封后天数须为不小于 0 的整数'
  for (const s of expiry.STORAGE) {
    const r = edit.rules[s.code]
    if (r.mode === 'all' && !positiveInt(r.all)) return s.label + '保质期须为正整数'
    if (r.mode === 'band' && (!positiveInt(r.warm) || !positiveInt(r.cold))) return s.label + '高温档、低温档保质期都要填正整数'
  }
  return ''
}

// 删除即停用；分类下还有可用食材时不能删（服务端同样校验）。一级分类连同其下二级分类一起删
function deleteCheck(name, subs, withSubs) {
  const list = subs || []
  const count = list.reduce((n, s) => n + s.items.length, 0)
  if (count) return { blocked: true, message: '「' + name + '」下还有 ' + count + ' 种可用食材，请先停用这些食材再删除' }
  const extra = withSubs && list.length ? '，其下 ' + list.length + ' 个二级分类会一并删除' : ''
  return { blocked: false, message: '删除「' + name + '」' + extra + '。已有库存和出入库记录不受影响。' }
}

function newMaterialCode(now) {
  const suffix = Math.floor(Math.random() * 36 * 36).toString(36)
  return ('M' + Number(now || Date.now()).toString(36) + suffix).toUpperCase().slice(0, 64)
}

module.exports = { baseUnitFor, categoryEditState, categoryBody, validateCategory, materialEditState, materialBody,
  ruleSpec, rulePlans, validateMaterial, deleteCheck, newMaterialCode }
