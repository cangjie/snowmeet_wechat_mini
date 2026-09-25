// 每日入库八步：分类 → 名称 → 拍照 → 批次号 → 储存 → 日期 → 包装 → 数量；点「提交入库」直接 PostReceipt
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const expiry = require('../common/expiry.js')
const units = require('../common/units.js')
const forms = require('../common/forms.js')
const catalog = require('../common/catalog.js')
const view = require('../common/stock-view.js')
const requestId = require('../common/request-id.js')

const PACK_NAMES = ['瓶', '袋', '盒', '桶', '罐', '箱', '件']
const DELETE_WINDOW_MS = 10 * 60 * 1000  // 与服务端 FnbReceiptService.DeleteWindow 一致

// 入库请求体 → 「2 袋 × 500 g · 冷冻 · 2026-11-22 到期」
function receiptLine(b, baseUnit) {
  const qty = b.stockForm === 'sealed' ? b.quantity + ' ' + b.packUnitName + ' × ' + units.formatQty(b.packSize, baseUnit)
    : units.trimNum(b.quantity) + ' ' + units.unitName(b.inputUnitCode)
  return qty + ' · ' + expiry.storageLabel(b.storageType) + ' · ' + b.expireDate + ' 到期'
}

Page({
  data: {
    blocked: '', isManager: false, tree: [], l1: 0, subs: [], sub: null,
    nameQuery: '', hints: [], material: null, canCreate: false,
    photos: [], uploading: 0, batchNo: '', storages: expiry.STORAGE, storage: '',
    prodDate: '', shelfValue: '', shelfUnit: 'day', expireDate: '',
    ruleText: '', expireShown: '', packed: false, packNames: PACK_NAMES, packName: '瓶', packSize: '', contentUnit: '', contentUnits: [],
    openStorage: '', openDays: '', openKeep: false, qty: 1, inputUnit: '', inputUnits: [], unitPrice: '', priceUnit: '',
    done: [], submitting: false, scan: { show: false, mode: 'all' }, printShow: false, printBatch: null
  },

  onLoad() {
    base.boot(this).then(() => this.load()).catch(() => {})
  },
  onHide() { this.setData({ 'scan.show': false }) },

  load() {
    return Promise.all([
      api.get(this.ctx, 'FnbCatalog/ListCategories'),
      api.getAll(this.ctx, 'FnbCatalog/ListMaterials'),
      api.get(this.ctx, 'FnbCatalog/GetUnits'),
      api.get(this.ctx, 'FnbCatalog/ListShelfLifeRules')
    ]).then(([categories, materials, unitList, rules]) => {
      this.src = { categories, materials: materials.filter(m => m.valid), units: unitList.filter(u => u.valid), rules }
      const tree = view.categoryTree(categories)
      this.setData({ tree, contentUnits: units.contentUnitOptions(null, this.src.units) })
      if (tree.length) this.pickL1(tree[0].id)
      this.newBatchNo()
    }).catch(base.fail)
  },

  // ---- 1. 分类 ----
  pickL1(id) {
    const group = this.data.tree.find(g => g.id === id)
    this.setData({ l1: id, subs: group ? group.subs : [] })
    if (group && group.subs.length) this.pickSub(group.subs[0].id)
    else this.setData({ sub: null, material: null, hints: [] })
  },
  onL1(e) { this.pickL1(Number(e.currentTarget.dataset.id)) },
  onL2(e) { this.pickSub(Number(e.currentTarget.dataset.id)) },
  pickSub(id) {
    const sub = this.src.categories.find(c => c.id === id)
    this.setData({ sub, storage: sub.default_storage || 'chilled', openStorage: sub.default_storage || 'chilled', openDays: '', openKeep: false })
    this.clearMaterial()
  },
  goCats() { wx.redirectTo({ url: '/pages/fnbinv/cats/cats' }) },

  // ---- 2. 名称 ----
  clearMaterial() {
    this.setData({ material: null, nameQuery: '', canCreate: false, contentUnits: units.contentUnitOptions(null, this.src.units) })
    this.refreshHints('')
  },
  refreshHints(q) {
    const sub = this.data.sub
    const list = sub ? this.src.materials.filter(m => m.category_id === sub.id) : []
    const hints = list.filter(m => !q || m.name.indexOf(q) >= 0).slice(0, 12).map(m => ({ id: m.id, name: m.name }))
    const exact = list.some(m => m.name === q.trim())
    this.setData({ hints, canCreate: !!q.trim() && !exact })
  },
  // 输入与本分类下已建档食材同名时直接选中，不用再点候选
  onName(e) {
    const q = e.detail.value
    const sub = this.data.sub
    const same = sub && this.src.materials.find(m => m.category_id === sub.id && m.name === q.trim())
    if (same) {
      if (!this.data.material || this.data.material.id !== same.id) this.pickMaterial(same)
      this.setData({ nameQuery: q })
      return
    }
    // 没建档的新名字：数量单位、含量单位列出全部，选哪个就按哪个计量方式建档
    const all = this.src.units.map(u => ({ code: u.code, label: units.unitName(u.code) }))
    this.setData({ nameQuery: q, material: null, inputUnits: all, contentUnits: units.contentUnitOptions(null, this.src.units),
      inputUnit: all.some(u => u.code === this.data.inputUnit) ? this.data.inputUnit : 'kg' })
    this.refreshHints(q)
    this.refreshPriceUnit()
  },
  // 开封后默认、临期提醒、保质期规则都取自食材档案；已选的含量单位与食材计量方式一致时保留
  pickMaterial(material) {
    const inputUnits = units.inputUnitsFor(material.base_unit_code, this.src.units).map(u => ({ code: u.code, label: units.unitName(u.code) }))
    const contentUnits = units.contentUnitOptions(material.base_unit_code, this.src.units)
    const kept = contentUnits.find(u => u.code === this.data.contentUnit && !u.off)
    const sub = this.data.sub
    this.setData({ material, nameQuery: material.name, hints: [], canCreate: false, inputUnits,
      inputUnit: material.default_input_unit_code, contentUnits, contentUnit: kept ? kept.code : material.base_unit_code,
      openStorage: material.default_open_storage || (sub && sub.default_storage) || 'chilled',
      openKeep: material.default_open_days === expiry.OPEN_KEEP_DAYS,
      openDays: material.default_open_days === null || material.default_open_days === undefined || material.default_open_days === expiry.OPEN_KEEP_DAYS
        ? '' : String(material.default_open_days) })
    this.refreshRule()
    this.refreshPriceUnit()
  },
  onHint(e) { this.pickMaterial(this.src.materials.find(m => m.id === Number(e.currentTarget.dataset.id))) },
  // 新名字不单独建档：提交入库时自动建。计量单位取散装的数量单位 / 封装的含量单位，
  // 临期提醒按分类储存方式给默认，开封后默认取本次填写的；保质期规则等到「分类」页补
  newMaterialEdit() {
    const d = this.data
    const name = d.nameQuery.trim()
    const unit = d.packed ? d.contentUnit : d.inputUnit
    if (d.material || !d.canCreate || !name || !d.sub || !unit) return null
    const edit = Object.assign(catalog.materialEditState({ name, category_id: d.sub.id }, d.sub, []), { inputUnit: unit })
    if (d.packed) Object.assign(edit, { openStorage: d.openStorage, openDays: d.openDays, openKeep: d.openKeep })
    return edit
  },
  pendingMaterial() {
    const edit = this.newMaterialEdit()
    return edit ? { id: 0, name: edit.name, category_id: edit.categoryId, base_unit_code: catalog.baseUnitFor(edit.inputUnit, this.src.units),
      default_input_unit_code: edit.inputUnit, warn_days: Number(edit.warnDays) } : null
  },

  // ---- 3. 照片 / 4. 批次号 ----
  onPhotos(e) { this.setData({ photos: e.detail.photos, uploading: e.detail.uploading }) },
  newBatchNo() {
    api.get(this.ctx, 'FnbMaterial/GenBatchNo').then(res => {
      this.setData({ batchNo: res.batchNo })
    }).catch(() => {})
  },
  onBatchNo(e) { this.setData({ batchNo: e.detail.value }) },

  // ---- 5. 储存 / 6. 日期 ----
  // 到期日期由生产日期 + 保质期（或食材规则）自动算出并显示在「到期日期」框里；
  // 一旦手填（或识别）到期日期，data.expireDate 有值，生产日期和保质期置灰、不参与计算
  locked() { return !!this.data.expireDate },
  onStorage(e) { this.setData({ storage: e.currentTarget.dataset.code }); this.refreshRule() },
  onProdDate(e) { if (this.locked()) return; this.setData({ prodDate: e.detail.date }); this.refreshRule() },
  onExpireDate(e) { this.setData({ expireDate: e.detail.date }); this.refreshRule() },
  clearExpire() { this.setData({ expireDate: '' }); this.refreshRule() },
  onShelf(e) { if (this.locked()) return; this.setData({ shelfValue: e.detail.value }); this.refreshRule() },
  onShelfUnit(e) { if (this.locked()) return; this.setData({ shelfUnit: e.currentTarget.dataset.unit }); this.refreshRule() },
  clearDates() {
    this.setData({ prodDate: '', expireDate: '', shelfValue: '' })
    this.refreshRule()
  },
  // 保质期规则按生产日期所在月份取（高温档 / 低温档）
  currentRule() {
    const d = this.data
    if (!d.material || !d.prodDate) return null
    return expiry.ruleFor(this.src.rules, d.material.id, d.storage, Number(d.prodDate.slice(5, 7)))
  },
  refreshRule() {
    const d = this.data
    const rule = this.currentRule()
    const draft = this.draftState()
    const resolved = forms.resolveExpiry(draft)
    let ruleText = ''
    if (!resolved.error) {
      const source = { package: '按填写的到期日期', manual: '按生产日期 + 保质期', category: '按食材规则' }[resolved.source]
      ruleText = source + ' → ' + resolved.expireDate + ' 到期' + (resolved.expireDate < d.today ? '（已过期，不能入库）' : '')
    } else if (d.material && d.prodDate && !rule) {
      ruleText = '该食材的' + expiry.storageLabel(d.storage) + '没有保质期规则，请直接填写到期日期或保质期'
    }
    this.setData({ ruleText, ruleBad: !resolved.error && resolved.expireDate < d.today,
      expireShown: d.expireDate || (resolved.error ? '' : resolved.expireDate) })
  },

  // ---- OCR 识别（到期日期已手填时，生产日期和保质期的识别不再生效）----
  onScan(e) {
    const mode = e.currentTarget.dataset.mode
    if (this.locked() && mode !== 'expire') return
    this.setData({ scan: { show: true, mode } })
  },
  onScanClose() { this.setData({ 'scan.show': false }) },
  onScanFill(e) {
    const d = e.detail
    this.setData({ 'scan.show': false })
    if (d.field === 'expire_date') this.setData({ expireDate: d.value })
    else if (this.locked()) return
    else if (d.field === 'produce_date') this.setData({ prodDate: d.value })
    else if (d.field === 'shelf') this.setData({ shelfValue: String(d.value.value), shelfUnit: d.value.unit === '月' ? 'month' : 'day' })
    this.refreshRule()
  },
  onScanConfirm(e) {
    this.setData({ 'scan.show': false })
    if (e.detail.produceDate && !this.locked()) { this.setData({ prodDate: e.detail.produceDate }); this.refreshRule() }
  },

  // ---- 7. 包装 / 8. 数量 / 单价 ----
  onPacked(e) {
    this.setData({ packed: e.currentTarget.dataset.v === '1', qty: 1 })
    this.refreshPriceUnit()
  },
  onPackName(e) { this.setData({ packName: e.currentTarget.dataset.v }); this.refreshPriceUnit() },
  onPackSize(e) { this.setData({ packSize: e.detail.value }) },
  onContentUnit(e) {
    const option = this.data.contentUnits.find(u => u.code === e.currentTarget.dataset.code)
    if (option.off) {
      const m = this.data.material
      wx.showToast({ title: '「' + m.name + '」按' + units.unitName(m.base_unit_code) + '计量，含量单位要同一计量方式', icon: 'none' })
      return
    }
    this.setData({ contentUnit: option.code })
  },
  onOpenStorage(e) { this.setData({ openStorage: e.currentTarget.dataset.code }) },
  onOpenDays(e) { this.setData({ openDays: e.detail.value }) },
  // 开封后保质期不变：开封后的到期日期就是封装的到期日期
  onOpenKeep() { this.setData({ openKeep: !this.data.openKeep, openDays: '' }) },
  onQty(e) { this.setData({ qty: e.detail.value }) },
  onInputUnit(e) { this.setData({ inputUnit: e.currentTarget.dataset.code }); this.refreshPriceUnit() },
  onPrice(e) { this.setData({ unitPrice: e.detail.value }) },
  refreshPriceUnit() {
    this.setData({ priceUnit: this.data.packed ? this.data.packName : units.unitName(this.data.inputUnit) })
  },

  draftState() {
    const d = this.data
    const material = d.material || (this.src ? this.pendingMaterial() : null)
    return { material, photos: d.photos.filter(p => p.id), batchNo: d.batchNo, storage: d.storage,
      warnDays: material ? material.warn_days : 0, prodDate: d.prodDate, shelfValue: d.shelfValue, shelfUnit: d.shelfUnit,
      expireDate: d.expireDate, rule: this.currentRule(), packed: d.packed, packSize: d.packSize,
      contentUnit: d.contentUnit, packName: d.packName, openStorage: d.openStorage, openDays: d.openDays, openKeep: d.openKeep,
      qty: d.qty, inputUnit: d.inputUnit, unitPrice: d.unitPrice, units: this.src ? this.src.units : [] }
  },

  // 提交入库：校验通过后先弹确认框防误触；确认后新食材先建档，再 PostReceipt。
  // 失败时表单保留；网络类失败重试沿用同一请求号，服务端据此去重
  submit() {
    const d = this.data
    if (d.submitting) return
    if (d.uploading > 0) { wx.showToast({ title: '照片还在上传', icon: 'none' }); return }
    const isNew = !d.material && d.canCreate
    if (isNew && !d.isManager) { wx.showToast({ title: '「' + d.nameQuery.trim() + '」还没建档，需店长入库或先建档', icon: 'none', duration: 2500 }); return }
    if (isNew && d.packed && !d.contentUnit) { wx.showToast({ title: '请选择每' + d.packName + '含量的单位', icon: 'none' }); return }
    const state = this.draftState()
    this.pendingRequestId = this.pendingRequestId || requestId.newRequestId()
    const built = forms.buildReceipt(Object.assign(state, { requestId: this.pendingRequestId }), d.today)
    if (!built.ok) { wx.showToast({ title: built.error, icon: 'none', duration: 2500 }); return }
    const b = built.body
    const line = receiptLine(b, state.material.base_unit_code)
    wx.showModal({
      title: '确认入库', content: state.material.name + '：' + line + (isNew ? '。新食材，将同时建档' : ''), confirmText: '入库',
      success: res => { if (res.confirm) this.postReceipt(b, isNew, line) }
    })
  },
  postReceipt(b, isNew, line) {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    const ready = isNew
      ? api.post(this.ctx, 'FnbCatalog/SaveMaterial', catalog.materialBody(this.newMaterialEdit(), this.src.units, Date.now()))
        .then(row => { this.src.materials.push(row); this.setData({ material: row, canCreate: false, hints: [] }); return row })
      : Promise.resolve(this.data.material)
    ready.then(material => {
      b.itemId = material.id
      return api.post(this.ctx, 'FnbInventory/PostReceipt', b).then(res => {
        this.pendingRequestId = null
        const row = { batchId: res.batchId, name: material.name, batchNo: b.batchNo, expireDate: b.expireDate, line,
          deleteUntil: Date.now() + DELETE_WINDOW_MS, canDelete: true }
        this.setData({ submitting: false, done: [row].concat(this.freshDone()),
          photos: [], prodDate: '', expireDate: '', shelfValue: '', qty: 1, unitPrice: '', packSize: '' })
        this.clearMaterial()
        this.refreshRule()
        this.newBatchNo()
        wx.showToast({ title: '已入库', icon: 'success' })
      })
    }).catch(err => {
      if (!err.retryable) this.pendingRequestId = null
      this.setData({ submitting: false })
      base.fail(err)
    })
  },

  // ---- 本次已入库：打标签；入库 10 分钟内、还没开封使用的可删除（服务端再校验）----
  freshDone() {
    const now = Date.now()
    return this.data.done.map(r => Object.assign({}, r, { canDelete: r.canDelete && now < r.deleteUntil }))
  },
  onShow() {
    if (this.data.done.length) this.setData({ done: this.freshDone() })
  },
  onDeleteDone(e) {
    const row = this.data.done.find(d => d.batchId === Number(e.currentTarget.dataset.id))
    if (Date.now() >= row.deleteUntil) {
      this.setData({ done: this.freshDone() })
      wx.showToast({ title: '入库已超过 10 分钟，不能删除', icon: 'none' })
      return
    }
    wx.showModal({
      title: '删除这次入库', content: '「' + row.name + '」' + row.line + '，删除后库存里不再有这一批。', confirmText: '删除', confirmColor: '#EF4444',
      success: res => {
        if (!res.confirm) return
        api.post(this.ctx, 'FnbInventory/DeleteReceipt', { batchId: row.batchId }).then(() => {
          this.setData({ done: this.data.done.filter(d => d.batchId !== row.batchId) })
          wx.showToast({ title: '已删除', icon: 'success' })
        }).catch(err => {
          this.setData({ done: this.data.done.map(d => d.batchId === row.batchId ? Object.assign({}, d, { canDelete: false }) : d) })
          base.fail(err)
        })
      }
    })
  },

  onPrint(e) {
    const row = this.data.done.find(d => d.batchId === Number(e.currentTarget.dataset.id))
    this.setData({ printShow: true, printBatch: { id: row.batchId, name: row.name, batch_no: row.batchNo, expire_date: row.expireDate } })
  },
  onPrintClose() { this.setData({ printShow: false }) }
})
