// 分类维护：一级 / 二级分类（二级只有名称和建议储存方式）、食材档案（计量、临期、开封默认、保质期规则）
// 维护需店长权限，员工只读
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const expiry = require('../common/expiry.js')
const catalog = require('../common/catalog.js')

const MODES = [{ code: 'none', label: '不适用' }, { code: 'all', label: '全年' }, { code: 'band', label: '分高低温档' }]

Page({
  data: {
    blocked: '', loading: true, loadError: false, isManager: false, groups: [], openL1: 0, storages: expiry.STORAGE, modes: MODES,
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
          return { id: s.id, name: s.name, storage: expiry.storageLabel(s.default_storage),
            items: items.map(m => ({ id: m.id, name: m.name, prepared: m.item_type === 'prepared' })) }
        })
        return { id: g.id, name: g.name, subs, meta: subs.length + ' 个二级分类 · ' + subs.reduce((n, s) => n + s.items.length, 0) + ' 种食材' }
      })
      this.setData({ loading: false, loadError: false, groups, unitOpts: unitList.filter(u => u.valid).map(u => ({ code: u.code, label: u.name })),
        openL1: this.data.openL1 || (groups[0] ? groups[0].id : 0) })
    }).catch(err => { this.setData({ loading: false, loadError: true }); base.fail(err) })
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

  // 二级分类：名称 + 建议储存方式
  openEditor(category) {
    this.setData({ editShow: true, edit: catalog.categoryEditState(category) })
  },
  addL2(e) {
    if (!this.guard()) return
    const parentId = Number(e.currentTarget.dataset.id)
    const siblings = this.src.categories.filter(c => c.parent_id === parentId)
    this.openEditor({ id: 0, parent_id: parentId, level: 2, name: '', default_storage: 'chilled', sort: siblings.length + 1, valid: true })
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

  saveEditor() {
    if (this.data.saving) return
    const edit = this.data.edit
    const error = catalog.validateCategory(edit)
    if (error) { wx.showToast({ title: error, icon: 'none' }); return }
    this.setData({ saving: true })
    api.post(this.ctx, 'FnbCatalog/SaveCategory', catalog.categoryBody(edit)).then(() => {
      this.setData({ saving: false, editShow: false })
      wx.showToast({ title: '已保存', icon: 'success' })
      this.load()
    }).catch(err => { this.setData({ saving: false }); base.fail(err) })
  },

  // 删除分类：分类下还有可用食材时只提示原因，不发请求
  removeCategory(id, name, subs, withSubs) {
    if (!this.guard()) return
    const check = catalog.deleteCheck(name, subs, withSubs)
    if (check.blocked) { wx.showModal({ title: '不能删除', content: check.message, showCancel: false }); return }
    wx.showModal({ title: '删除分类', content: check.message, confirmText: '删除', confirmColor: '#EF4444', success: res => {
      if (!res.confirm) return
      api.post(this.ctx, 'FnbCatalog/DeleteCategory', { id }).then(() => {
        this.setData({ editShow: false, openL1: withSubs ? 0 : this.data.openL1 })
        wx.showToast({ title: '已删除', icon: 'success' })
        this.load()
      }).catch(err => { base.fail(err); this.load() })
    } })
  },
  onDeleteL1(e) {
    const g = this.data.groups.find(x => x.id === Number(e.currentTarget.dataset.id))
    if (g) this.removeCategory(g.id, g.name, g.subs, true)
  },
  onDeleteL2() {
    const id = this.data.edit.id
    const s = this.data.groups.reduce((all, g) => all.concat(g.subs), []).find(x => x.id === id)
    if (s) this.removeCategory(s.id, s.name, [s], false)
  },

  // 食材档案：计量单位、临期提醒、开封后默认、保质期规则
  addMaterial(e) {
    if (!this.guard()) return
    const category = this.src.categories.find(c => c.id === Number(e.currentTarget.dataset.id))
    this.setData({ matShow: true, mat: catalog.materialEditState(null, category, []) })
  },
  editMaterial(e) {
    if (!this.guard()) return
    const m = this.src.materials.find(x => x.id === Number(e.currentTarget.dataset.id))
    const category = this.src.categories.find(c => c.id === m.category_id)
    this.setData({ matShow: true, mat: catalog.materialEditState(m, category, this.src.rules) })
  },
  closeMat() { this.setData({ matShow: false }) },
  setMat(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['mat.' + field]: e.detail.value !== undefined ? e.detail.value : e.currentTarget.dataset.value })
  },
  // 开封后储存方式可以不设：再点一次已选中的取消
  pickOpenStorage(e) {
    const code = e.currentTarget.dataset.value
    this.setData({ 'mat.openStorage': this.data.mat.openStorage === code ? '' : code })
  },
  // 开封后保质期不变：开封后的到期日期就是封装的到期日期
  toggleOpenKeep() { this.setData({ 'mat.openKeep': !this.data.mat.openKeep, 'mat.openDays': '' }) },
  saveMat(del) {
    if (this.data.saving) return
    const m = this.data.mat
    const error = del === true ? '' : catalog.validateMaterial(m, this.src.units)
    if (error) { wx.showToast({ title: error, icon: 'none' }); return }
    const body = Object.assign(catalog.materialBody(m, this.src.units, Date.now()), { valid: del !== true })
    this.setData({ saving: true })
    api.post(this.ctx, 'FnbCatalog/SaveMaterial', body).then(row => {
      const plans = del === true ? [] : catalog.rulePlans(this.src.rules, row.id, m.rules)
      return plans.reduce((p, rule) => p.then(() => api.post(this.ctx, 'FnbCatalog/SaveShelfLifeRule', rule)), Promise.resolve())
    }).then(() => {
      this.setData({ saving: false, matShow: false })
      wx.showToast({ title: del === true ? '已停用' : '已保存', icon: 'success' })
      this.load()
    }).catch(err => { this.setData({ saving: false }); base.fail(err); this.load() })
  },
  onSaveMat() { this.saveMat(false) },
  onDisableMat() {
    wx.showModal({ title: '停用食材', content: '停用后不能再入库或选入配方，已有库存不受影响。', confirmText: '停用', confirmColor: '#EF4444',
      success: res => { if (res.confirm) this.saveMat(true) } })
  }
})
