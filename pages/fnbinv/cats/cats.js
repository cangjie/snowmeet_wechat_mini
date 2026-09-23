// 分类维护：一级 / 二级分类、保质期规则、食材档案（维护需店长权限，员工只读）
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const expiry = require('../common/expiry.js')
const units = require('../common/units.js')
const catalog = require('../common/catalog.js')

const MODES = [{ code: 'none', label: '不适用' }, { code: 'all', label: '全年' }, { code: 'band', label: '分高低温档' }]

Page({
  data: {
    blocked: '', loading: true, isManager: false, groups: [], openL1: 0, storages: expiry.STORAGE, modes: MODES,
    unitOpts: [], editShow: false, edit: null, saving: false, matShow: false, mat: null
  },

  onLoad() { base.boot(this).then(() => this.load()).catch(() => {}) },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    if (!this.ctx) return Promise.resolve()
    return Promise.all([
      api.get(this.ctx, 'FnbCatalog/ListCategories'),
      api.get(this.ctx, 'FnbCatalog/ListShelfLifeRules'),
      api.getAll(this.ctx, 'FnbCatalog/ListMaterials'),
      api.get(this.ctx, 'FnbCatalog/GetUnits')
    ]).then(([categories, rules, materials, unitList]) => {
      this.src = { categories, rules, materials, units: unitList }
      const valid = categories.filter(c => c.valid)
      const groups = valid.filter(c => c.level === 1).map(g => {
        const subs = valid.filter(c => c.level === 2 && c.parent_id === g.id).map(s => {
          const items = materials.filter(m => m.category_id === s.id && m.valid)
          return { id: s.id, name: s.name, storage: expiry.storageLabel(s.default_storage), unit: units.unitName(s.default_unit_code),
            warn: s.warn_days, ruleLine: catalog.ruleLine(rules, s.id), items: items.map(m => ({ id: m.id, name: m.name, prepared: m.item_type === 'prepared' })) }
        })
        return { id: g.id, name: g.name, subs, meta: subs.length + ' 个二级分类 · ' + subs.reduce((n, s) => n + s.items.length, 0) + ' 种食材' }
      })
      this.setData({ loading: false, groups, unitOpts: unitList.filter(u => u.valid).map(u => ({ code: u.code, label: u.name })),
        openL1: this.data.openL1 || (groups[0] ? groups[0].id : 0) })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onToggle(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({ openL1: this.data.openL1 === id ? 0 : id })
  },

  guard() {
    if (this.data.isManager) return true
    wx.showToast({ title: '维护分类需要店长权限', icon: 'none' })
    return false
  },

  addL1() {
    if (!this.guard()) return
    wx.showModal({ title: '新增一级分类', editable: true, placeholderText: '如：生鲜、冻品、干货', success: res => {
      const name = (res.content || '').trim()
      if (!res.confirm || !name) return
      api.post(this.ctx, 'FnbCatalog/SaveCategory', { id: 0, parentId: null, level: 1, name, sort: this.data.groups.length + 1, valid: true })
        .then(row => { this.setData({ openL1: row.id }); this.load() }).catch(base.fail)
    } })
  },

  openEditor(category) {
    this.setData({ editShow: true, edit: catalog.editState(category, this.src.rules) })
  },
  addL2(e) {
    if (!this.guard()) return
    const parentId = Number(e.currentTarget.dataset.id)
    const siblings = this.src.categories.filter(c => c.parent_id === parentId)
    this.openEditor({ id: 0, parent_id: parentId, level: 2, name: '', default_storage: 'chilled', default_unit_code: 'kg', warn_days: 1,
      default_open_storage: 'chilled', default_open_days: 1, sort: siblings.length + 1, valid: true })
  },
  editL2(e) {
    if (!this.guard()) return
    this.openEditor(this.src.categories.find(c => c.id === Number(e.currentTarget.dataset.id)))
  },
  closeEditor() { this.setData({ editShow: false }) },
  setEdit(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value !== undefined ? e.detail.value : e.currentTarget.dataset.value
    this.setData({ ['edit.' + field]: value })
  },
  pickEdit(e) {
    this.setData({ ['edit.' + e.currentTarget.dataset.field]: e.currentTarget.dataset.value })
  },

  saveEditor() {
    if (this.data.saving) return
    const edit = this.data.edit
    const error = catalog.validate(edit)
    if (error) { wx.showToast({ title: error, icon: 'none' }); return }
    this.setData({ saving: true })
    api.post(this.ctx, 'FnbCatalog/SaveCategory', catalog.categoryBody(edit)).then(row => {
      const plans = expiry.STORAGE.reduce((all, s) => {
        const spec = catalog.ruleSpec(edit.rules[s.code])
        return spec === 'custom' ? all : all.concat(expiry.planRuleSaves(this.src.rules, row.id, s.code, spec))
      }, [])
      return plans.reduce((p, body) => p.then(() => api.post(this.ctx, 'FnbCatalog/SaveShelfLifeRule', body)), Promise.resolve())
    }).then(() => {
      this.setData({ saving: false, editShow: false })
      wx.showToast({ title: '已保存', icon: 'success' })
      this.load()
    }).catch(err => { this.setData({ saving: false }); base.fail(err); this.load() })
  },

  bumpWarn(e) {
    if (!this.guard()) return
    const id = Number(e.currentTarget.dataset.id)
    const delta = Number(e.currentTarget.dataset.delta)
    const c = this.src.categories.find(x => x.id === id)
    const next = Math.max(0, (c.warn_days || 0) + delta)
    if (next === c.warn_days) return
    const body = catalog.categoryBody(Object.assign(catalog.editState(c, []), { warnDays: String(next) }))
    api.post(this.ctx, 'FnbCatalog/SaveCategory', body).then(() => this.load()).catch(base.fail)
  },

  // 食材档案
  addMaterial(e) {
    if (!this.guard()) return
    const category = this.src.categories.find(c => c.id === Number(e.currentTarget.dataset.id))
    this.setData({ matShow: true, mat: { id: 0, code: '', name: '', categoryId: category.id, categoryName: category.name,
      itemType: 'raw', inputUnit: category.default_unit_code, hasStock: false } })
  },
  editMaterial(e) {
    if (!this.guard()) return
    const m = this.src.materials.find(x => x.id === Number(e.currentTarget.dataset.id))
    const category = this.src.categories.find(c => c.id === m.category_id)
    this.setData({ matShow: true, mat: { id: m.id, code: m.code, name: m.name, categoryId: m.category_id, categoryName: category ? category.name : '',
      itemType: m.item_type, inputUnit: m.default_input_unit_code, baseUnit: m.base_unit_code, hasStock: true } })
  },
  closeMat() { this.setData({ matShow: false }) },
  setMat(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['mat.' + field]: e.detail.value !== undefined ? e.detail.value : e.currentTarget.dataset.value })
  },
  saveMat(del) {
    const m = this.data.mat
    if (!String(m.name).trim()) { wx.showToast({ title: '请填写食材名称', icon: 'none' }); return }
    const baseUnit = m.id ? m.baseUnit : catalog.baseUnitFor(m.inputUnit, this.src.units)
    if (catalog.baseUnitFor(m.inputUnit, this.src.units) !== baseUnit) { wx.showToast({ title: '录入单位须与原计量方式一致', icon: 'none' }); return }
    const body = { id: m.id, code: m.code || catalog.newMaterialCode(Date.now()), name: String(m.name).trim(), categoryId: m.categoryId,
      itemType: m.itemType, baseUnitCode: baseUnit, defaultInputUnitCode: m.inputUnit, imageId: null, remark: null, valid: del !== true }
    api.post(this.ctx, 'FnbCatalog/SaveMaterial', body).then(() => {
      this.setData({ matShow: false })
      wx.showToast({ title: del === true ? '已停用' : '已保存', icon: 'success' })
      this.load()
    }).catch(base.fail)
  },
  onSaveMat() { this.saveMat(false) },
  onDisableMat() {
    wx.showModal({ title: '停用食材', content: '停用后不能再入库或选入配方，已有库存不受影响。', confirmText: '停用', confirmColor: '#EF4444',
      success: res => { if (res.confirm) this.saveMat(true) } })
  }
})
