// 菜品配方与半成品配方：店长建菜品、编辑用料 → 存草稿 → 发布；员工只读
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const units = require('../common/units.js')
const recipe = require('../common/recipe.js')

Page({
  data: {
    blocked: '', loading: true, isManager: false, seg: 'dish',
    dishes: [], categories: [], preps: [], openKey: '', lines: {},
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
      const dishes = dishList.dishes.map(d => Object.assign({ key: 'd' + d.productId, status: recipe.dishStatus(d),
        priceLabel: units.money(d.salePrice) }, d))
      const preps = this.src.materials.filter(m => m.item_type === 'prepared').map(m => {
        const latest = recipe.latestFor(recipes, m.id)
        const status = latest.published ? { text: '已发布 v' + latest.published.version_no, tone: 'ok' }
          : latest.draft ? { text: '草稿未发布', tone: 'warn' } : { text: '未配置配方', tone: 'danger' }
        const out = latest.published || latest.draft
        return { key: 'p' + m.id, itemId: m.id, name: m.name, status, publishedRecipeId: latest.published ? latest.published.id : null,
          draftRecipeId: latest.draft ? latest.draft.id : null, yieldLabel: out ? '每次产出 ' + units.formatQty(out.output_qty, m.base_unit_code) : '' }
      })
      this.setData({ loading: false, dishes, preps, categories: dishList.categories, lines: {} })
      if (this.data.openKey) this.loadLines(this.data.openKey)
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onSeg(e) { this.setData({ seg: e.currentTarget.dataset.seg, openKey: '' }) },

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

  // ---- 菜品资料 ----
  newDish() {
    if (!this.guard()) return
    const first = this.data.categories[0]
    this.setData({ dishShow: true, dish: { id: 0, name: '', price: '', categoryId: first ? first.id : 0, categoryName: first ? '' : '热菜' } })
  },
  editDish(e) {
    if (!this.guard()) return
    const d = this.data.dishes.find(x => x.key === e.currentTarget.dataset.key)
    this.setData({ dishShow: true, dish: { id: d.productId, name: d.name, price: String(d.salePrice), categoryId: d.categoryId, categoryName: '' } })
  },
  closeDish() { this.setData({ dishShow: false }) },
  setDish(e) {
    const f = e.currentTarget.dataset.field
    const v = e.detail.value !== undefined ? e.detail.value : e.currentTarget.dataset.value
    this.setData({ ['dish.' + f]: f === 'categoryId' ? Number(v) : v })
    if (f === 'categoryId') this.setData({ 'dish.categoryName': '' })
    if (f === 'categoryName' && v) this.setData({ 'dish.categoryId': 0 })
  },
  saveDish(valid) {
    const d = this.data.dish
    if (!String(d.name).trim()) { wx.showToast({ title: '请填写菜品名称', icon: 'none' }); return }
    const price = d.price === '' ? 0 : Number(d.price)
    if (isNaN(price) || price < 0) { wx.showToast({ title: '售价格式不正确', icon: 'none' }); return }
    if (!d.categoryId && !String(d.categoryName).trim()) { wx.showToast({ title: '请选择或填写分类', icon: 'none' }); return }
    api.post(this.ctx, 'FnbRecipe/SaveDish', { id: d.id, name: String(d.name).trim(), salePrice: Math.round(price * 100) / 100,
      categoryId: d.categoryId || null, categoryName: d.categoryId ? null : String(d.categoryName).trim(), valid: valid !== false })
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
    const built = recipe.draftBody(this.data.editor, this.src.units)
    if (built.error) { wx.showToast({ title: built.error, icon: 'none' }); return }
    this.setData({ saving: true })
    api.post(this.ctx, 'FnbRecipe/SaveRecipeDraft', built.body).then(res => {
      if (!publish) return res
      return api.post(this.ctx, 'FnbRecipe/PublishRecipe', { recipeId: res.id, rowVersion: res.rowVersion }).then(() => res)
    }).then(res => {
      this.setData({ saving: false, editShow: false })
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
