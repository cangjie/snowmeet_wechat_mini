// 半成品制作：选批数 → 预估原料 → 拍照、储存、到期 → PostPreparation（核销原料，产出新批次）
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const expiry = require('../common/expiry.js')
const units = require('../common/units.js')
const recipe = require('../common/recipe.js')
const forms = require('../common/forms.js')
const requestId = require('../common/request-id.js')

Page({
  data: {
    blocked: '', loading: true, isManager: false, cards: [], openId: 0, storages: expiry.STORAGE,
    n: 1, needs: [], canMake: false, outLabel: '', storage: 'chilled', expireDate: '', expireHint: '', photos: [], uploading: 0,
    batchNo: '', making: false, log: []
  },

  onLoad() {
    this.keeper = requestId.createKeeper()
    base.boot(this).then(() => this.load()).catch(() => {})
  },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    if (!this.ctx) return Promise.resolve()
    return Promise.all([
      api.get(this.ctx, 'FnbRecipe/ListRecipes'),
      api.getAll(this.ctx, 'FnbCatalog/ListMaterials'),
      api.get(this.ctx, 'FnbInventory/GetStock'),
      api.get(this.ctx, 'FnbCatalog/ListCategories'),
      api.get(this.ctx, 'FnbCatalog/ListShelfLifeRules'),
      api.getAll(this.ctx, 'FnbInventory/ListBatches')
    ]).then(([recipes, materials, stock, categories, rules, batches]) => {
      const available = {}
      ;(stock || []).forEach(s => { available[s.item_id] = s.availableQty })
      this.src = { materials, categories, rules, available }
      const cards = materials.filter(m => m.valid && m.item_type === 'prepared').map(m => {
        const r = recipe.latestFor(recipes, m.id).published
        const cat = categories.find(c => c.id === m.category_id) || {}
        return r ? { id: m.id, name: m.name, recipeId: r.id, outputQty: r.output_qty, unit: m.base_unit_code, category: cat,
          meta: '每批产出 ' + units.formatQty(r.output_qty, m.base_unit_code) + ' · 建议' + expiry.storageLabel(cat.default_storage) } : null
      }).filter(Boolean)
      const preparedIds = new Set(materials.filter(m => m.item_type === 'prepared').map(m => m.id))
      const log = batches.filter(r => preparedIds.has(r.stock.item_id) && String(r.batch.create_date).slice(0, 10) === this.data.today)
        .map(r => ({ id: r.batch.id, name: r.batch.name, batchNo: r.batch.batch_no,
          detail: units.formatQty(r.stock.quantity, (materials.find(m => m.id === r.stock.item_id) || {}).base_unit_code) + ' · ' + String(r.batch.expire_date).slice(0, 10) + ' 到期' }))
      this.setData({ loading: false, cards, log })
      if (this.data.openId) this.openCard(this.data.openId)
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onToggle(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (this.data.openId === id) { this.setData({ openId: 0 }); return }
    this.openCard(id)
  },
  openCard(id) {
    const card = this.data.cards.find(c => c.id === id)
    if (!card) { this.setData({ openId: 0 }); return }
    api.get(this.ctx, 'FnbRecipe/GetRecipe', { recipeId: card.recipeId }).then(res => {
      this.lines = res.lines
      this.expireManual = false
      this.setData({ openId: id, n: 1, photos: [], storage: card.category.default_storage || 'chilled' })
      this.refresh()
      this.newBatchNo()
    }).catch(base.fail)
  },
  card() { return this.data.cards.find(c => c.id === this.data.openId) },

  refresh() {
    const card = this.card()
    if (!card) return
    const r = recipe.prepNeeds(this.lines, this.data.n, this.src.available, this.src.materials)
    const month = Number(this.data.today.slice(5, 7))
    const rule = expiry.ruleFor(this.src.rules, card.category.id, this.data.storage, month)
    this.setData({ needs: r.rows, canMake: r.ok, outLabel: units.formatQty(card.outputQty * this.data.n, card.unit) })
    if (this.expireManual) return  // 手动选过到期日后，改批数或储存方式不再覆盖
    this.rule = rule
    this.setData({ expireDate: rule ? expiry.calcExpiry(this.data.today, rule.shelf_life_value, rule.shelf_life_unit) : '',
      expireHint: rule ? '按分类规则自今天起算，可改' : '该分类的' + expiry.storageLabel(this.data.storage) + '没有保质期规则，请选择到期日期' })
  },
  onN(e) { this.setData({ n: Math.max(1, Number(e.detail.value) || 1) }); this.refresh() },
  onStorage(e) { this.setData({ storage: e.currentTarget.dataset.code }); this.refresh() },
  onExpire(e) { this.rule = null; this.expireManual = true; this.setData({ expireDate: e.detail.date, expireHint: '手动选择的到期日期' }) },
  onPhotos(e) { this.setData({ photos: e.detail.photos, uploading: e.detail.uploading }) },
  newBatchNo() {
    api.get(this.ctx, 'FnbMaterial/GenBatchNo').then(res => this.setData({ batchNo: forms.nextBatchNo(res.batchNo, []) })).catch(() => {})
  },
  onBatchNo(e) { this.setData({ batchNo: e.detail.value }) },

  onMake() {
    const d = this.data
    if (d.making) return
    if (!d.canMake) { wx.showToast({ title: '原料可用量不足，需先开封或补货', icon: 'none' }); return }
    if (d.uploading > 0) { wx.showToast({ title: '照片还在上传', icon: 'none' }); return }
    const photos = d.photos.filter(p => p.id)
    if (!photos.length) { wx.showToast({ title: '请给产出批次拍照', icon: 'none' }); return }
    if (!d.expireDate || d.expireDate < d.today) { wx.showToast({ title: '请选择不早于今天的到期日期', icon: 'none' }); return }
    if (!d.batchNo) { wx.showToast({ title: '请填写批次号', icon: 'none' }); return }
    const card = this.card()
    const key = 'prep:' + card.recipeId + ':' + d.n + ':' + d.batchNo
    this.setData({ making: true })
    api.post(this.ctx, 'FnbInventory/PostPreparation', {
      requestId: this.keeper.get(key), recipeId: card.recipeId, outputQuantity: card.outputQty * d.n, batchNo: d.batchNo,
      storageType: d.storage, storageLocation: null, expireDate: d.expireDate, warnDays: card.category.warn_days || 0,
      imageIds: photos.map(p => p.id), expiryNote: this.rule ? '按分类规则自制作日起算' : null
    }).then(() => {
      this.keeper.done(key)
      this.setData({ making: false, openId: 0 })
      wx.showToast({ title: '已制作 ' + d.outLabel, icon: 'success' })
      this.load()
    }).catch(err => { this.setData({ making: false }); if (!err.retryable) this.keeper.done(key); base.fail(err) })
  }
})
