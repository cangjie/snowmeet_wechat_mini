// 菜品配方与半成品配方：店长新建菜品时直接填名称和用料（不设售价、分类）→ 存草稿 / 发布；员工只读
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const units = require('../common/units.js')
const recipe = require('../common/recipe.js')

Page({
  data: {
    blocked: '', loading: true, isManager: false, seg: 'dish',
    dishes: [], preps: [], openKey: '', lines: {},
    dishShow: false, dish: null, editShow: false, editor: null, pickShow: false, pickQuery: '', pickList: [], saving: false
  },

  onLoad() { base.boot(this).then(() => this.load()).catch(() => {}) },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    if (!this.ctx) return Promise.resolve()
    return Promise.all([
      api.get(this.ctx, 'FnbRecipe/ListDishes'),
      api.getAll(this.ctx, 'FnbCatalog/ListMaterials'),
      api.get(this.ctx, 'FnbCatalog/GetUnits'),
      api.get(this.ctx, 'FnbRecipe/ListRecipes')
    ]).then(([dishList, materials, unitList, recipes]) => {
      this.src = { materials: materials.filter(m => m.valid), units: unitList, recipes, dishes: dishList.dishes }
      const dishes = dishList.dishes.map(d => Object.assign({ key: 'd' + d.productId, status: recipe.dishStatus(d), meta: recipe.dishMeta(d) }, d))
      const preps = this.src.materials.filter(m => m.item_type === 'prepared').map(m => {
        const latest = recipe.latestFor(recipes, m.id)
        const status = latest.published ? { text: '已发布 v' + latest.published.version_no, tone: 'ok' }
          : latest.draft ? { text: '草稿未发布', tone: 'warn' } : { text: '未配置配方', tone: 'danger' }
        const out = latest.published || latest.draft
        return { key: 'p' + m.id, itemId: m.id, name: m.name, status, publishedRecipeId: latest.published ? latest.published.id : null,
          draftRecipeId: latest.draft ? latest.draft.id : null, yieldLabel: out ? '每次产出 ' + units.formatQty(out.output_qty, m.base_unit_code) : '' }
      })
      this.setData({ loading: false, dishes, preps, lines: {} })
      if (this.data.openKey) this.loadLines(this.data.openKey)
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onSeg(e) { this.setData({ seg: e.currentTarget.dataset.seg, openKey: '' }) },
  // 半成品食材放在半成品分类下：分类页新增分类选「半成品」，再点「＋ 食材」
  goCats() { wx.redirectTo({ url: '/pages/fnbinv/cats/cats' }) },

  cardOf(key) {
    return this.data.dishes.find(d => d.key === key) || this.data.preps.find(p => p.key === key)
  },
  onToggle(e) {
    const key = e.currentTarget.dataset.key
    const open = this.data.openKey === key ? '' : key
    this.setData({ openKey: open })
    if (open) this.loadLines(open)
  },
  loadLines(key) {
    const card = this.cardOf(key)
    const id = card && (card.publishedRecipeId || card.draftRecipeId)
    if (!id) { this.setData({ ['lines.' + key]: [] }); return }
    api.get(this.ctx, 'FnbRecipe/GetRecipe', { recipeId: id }).then(res => {
      this.setData({ ['lines.' + key]: recipe.linesView(res.lines, this.src.materials) })
    }).catch(base.fail)
  },

  guard() {
    if (this.data.isManager) return true
    wx.showToast({ title: '维护配方需要店长权限', icon: 'none' })
    return false
  },

  // ---- 菜品：新建时直接填名称和用料；「菜品资料」只改名称或停用（售价、分类不在这里维护）----
  newDish() {
    if (!this.guard()) return
    this.setData({ editShow: true, pickShow: false, editor: { key: '', isNew: true, name: '', title: '', kind: 'dish', dishSpecId: null,
      outputItemId: null, outputUnit: '', outputUnitLabel: '', outputQty: '', id: 0, rowVersion: null, lines: [] } })
  },
  setEditorName(e) { this.setData({ 'editor.name': e.detail.value }) },
  editDish(e) {
    if (!this.guard()) return
    const d = this.data.dishes.find(x => x.key === e.currentTarget.dataset.key)
    this.setData({ dishShow: true, dish: { id: d.productId, name: d.name } })
  },
  closeDish() { this.setData({ dishShow: false }) },
  setDish(e) { this.setData({ ['dish.' + e.currentTarget.dataset.field]: e.detail.value }) },
  saveDish(valid) {
    const d = this.data.dish
    if (!String(d.name).trim()) { wx.showToast({ title: '请填写菜品名称', icon: 'none' }); return }
    api.post(this.ctx, 'FnbRecipe/SaveDish', { id: d.id, name: String(d.name).trim(), valid: valid !== false })
      .then(() => { this.setData({ dishShow: false }); wx.showToast({ title: valid === false ? '已停用' : '已保存', icon: 'success' }); this.load() })
      .catch(base.fail)
  },
  onSaveDish() { this.saveDish(true) },
  onDisableDish() {
    wx.showModal({ title: '停用菜品', content: '停用后不能再建厨房单，已有订单不受影响。', confirmText: '停用', confirmColor: '#EF4444',
      success: res => { if (res.confirm) this.saveDish(false) } })
  },

  // ---- 配方编辑 ----
  editRecipe(e) {
    if (!this.guard()) return
    const card = this.cardOf(e.currentTarget.dataset.key)
    const prep = card.key[0] === 'p'
    const material = prep ? this.src.materials.find(m => m.id === card.itemId) : null
    const sourceId = card.draftRecipeId || card.publishedRecipeId
    // 库里早先建的菜品可能还没有「标准份」规格，先补上才能挂配方
    const spec = prep || card.specId ? Promise.resolve(card.specId)
      : api.post(this.ctx, 'FnbRecipe/SaveDishSpec', { id: 0, productId: card.productId, specCode: 'default', name: '标准份',
        salePrice: null, legacyProductId: null, isDefault: true, valid: true }).then(row => { card.specId = row.id; return row.id })
    const start = spec.then(() => sourceId ? api.get(this.ctx, 'FnbRecipe/GetRecipe', { recipeId: sourceId }) : null)
    start.then(res => {
      const fromDraft = !!card.draftRecipeId
      const outputUnit = material ? (material.default_input_unit_code || material.base_unit_code) : ''
      this.setData({ editShow: true, editor: {
        key: card.key, title: card.name, kind: prep ? 'prep' : 'dish', dishSpecId: prep ? null : card.specId,
        outputItemId: prep ? card.itemId : null, outputUnit, outputUnitLabel: units.unitName(outputUnit),
        outputQty: res && prep ? String(units.fromBase(res.recipe.output_qty, outputUnit, this.src.units)) : '',
        id: fromDraft ? res.recipe.id : 0, rowVersion: fromDraft ? res.recipe.row_version : null,
        lines: res ? recipe.editorLines(res.lines, this.src.materials, this.src.units) : []
      } })
    }).catch(base.fail)
  },
  closeEditor() { this.setData({ editShow: false, pickShow: false }) },
  setLineQty(e) { this.setData({ ['editor.lines[' + e.currentTarget.dataset.index + '].qty']: e.detail.value }) },
  setOutputQty(e) { this.setData({ 'editor.outputQty': e.detail.value }) },
  removeLine(e) {
    const lines = this.data.editor.lines.slice()
    lines.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ 'editor.lines': lines })
  },
  openPicker() { this.setData({ pickShow: true, pickQuery: '' }); this.filterPick('') },
  closePicker() { this.setData({ pickShow: false }) },
  onPickQuery(e) { this.setData({ pickQuery: e.detail.value }); this.filterPick(e.detail.value) },
  filterPick(q) {
    const used = new Set(this.data.editor.lines.map(l => l.itemId).concat([this.data.editor.outputItemId]))
    this.setData({ pickList: this.src.materials.filter(m => !used.has(m.id) && (!q || m.name.indexOf(q) >= 0)).slice(0, 60)
      .map(m => ({ id: m.id, name: m.name, unit: units.unitName(m.default_input_unit_code || m.base_unit_code), prepared: m.item_type === 'prepared' })) })
  },
  onPick(e) {
    const m = this.src.materials.find(x => x.id === Number(e.currentTarget.dataset.id))
    this.setData({ 'editor.lines': this.data.editor.lines.concat([recipe.editorLine(m, null, this.src.units)]), pickShow: false })
  },

  saveRecipe(publish) {
    if (this.data.saving) return
    const editor = this.data.editor
    const name = String(editor.name || '').trim()
    if (editor.isNew && !name) { wx.showToast({ title: '请填写菜品名称', icon: 'none' }); return }
    const built = recipe.draftBody(editor, this.src.units)
    if (built.error) { wx.showToast({ title: built.error, icon: 'none' }); return }
    this.setData({ saving: true })
    // 新菜品：先建菜品；建好后编辑框转为该菜品，配方保存失败再点也不会重复建菜
    const dish = editor.isNew
      ? api.post(this.ctx, 'FnbRecipe/SaveDish', { id: 0, name, valid: true }).then(row => {
        this.setData({ 'editor.isNew': false, 'editor.key': 'd' + row.productId, 'editor.title': row.name, 'editor.dishSpecId': row.specId })
        return row.specId
      })
      : Promise.resolve(editor.dishSpecId)
    dish.then(specId => {
      if (built.body.recipeType === 'dish') built.body.dishSpecId = specId
      return api.post(this.ctx, 'FnbRecipe/SaveRecipeDraft', built.body)
    }).then(res => {
      if (!publish) return res
      return api.post(this.ctx, 'FnbRecipe/PublishRecipe', { recipeId: res.id, rowVersion: res.rowVersion }).then(() => res)
    }).then(res => {
      this.setData({ saving: false, editShow: false, openKey: this.data.editor.key })
      wx.showToast({ title: publish ? '已发布 v' + res.version_no : '草稿已保存', icon: 'success' })
      this.load()
    }).catch(err => {
      this.setData({ saving: false })
      if (err.code === 4) { wx.showModal({ title: '配方已被他人修改', content: '请关闭后重新打开再编辑。', showCancel: false }); return }
      base.fail(err)
    })
  },
  onSaveDraft() { this.saveRecipe(false) },
  onPublish() { this.saveRecipe(true) }
})
