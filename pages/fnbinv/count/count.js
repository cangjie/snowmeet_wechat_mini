// 盘点核对：只盘散装与已开封余量。店长建快照 → 员工录实盘 → 预览差异 → 店长过账（盘亏 FEFO 扣减，盘盈建承接批次）
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const units = require('../common/units.js')
const expiry = require('../common/expiry.js')
const forms = require('../common/forms.js')
const stocktake = require('../common/stocktake.js')
const requestId = require('../common/request-id.js')

Page({
  data: {
    blocked: '', loading: true, isManager: false, documentId: '', rows: [], pending: 0, diffCount: 0, changed: false,
    candidates: 0, gains: {}, gainShow: false, gain: null, storages: expiry.STORAGE, posting: false
  },

  onLoad() {
    this.keeper = requestId.createKeeper()
    base.boot(this).then(() => this.load()).catch(() => {})
  },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  key() { return 'fnbinv_count_' + this.ctx.shopId },
  storedId() { try { return wx.getStorageSync(this.key()) || '' } catch (e) { return '' } },
  store(id) { try { if (id) wx.setStorageSync(this.key(), id); else wx.removeStorageSync(this.key()) } catch (e) { /* 忽略 */ } },

  load() {
    if (!this.ctx) return Promise.resolve()
    return Promise.all([api.getAll(this.ctx, 'FnbCatalog/ListMaterials'), api.get(this.ctx, 'FnbInventory/GetStock'), api.get(this.ctx, 'FnbCatalog/GetUnits')])
      .then(([materials, stock, unitList]) => {
        this.src = { materials, units: unitList }
        this.candidateIds = (stock || []).filter(s => s.availableQty > 0).map(s => s.item_id)
        this.setData({ candidates: this.candidateIds.length })
        const id = this.storedId()
        if (!id) { this.setData({ loading: false, documentId: '', rows: [] }); return }
        return this.loadSnapshot(id)
      }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  loadSnapshot(id) {
    return api.get(this.ctx, 'FnbStocktake/GetSnapshot', { documentId: id }).then(snap => {
      if (snap.status !== 'draft') {
        this.store('')
        this.setData({ loading: false, documentId: '', rows: [] })
        wx.showToast({ title: '上次盘点已过账', icon: 'none' })
        return
      }
      const byId = {}
      this.src.materials.forEach(m => { byId[m.id] = m })
      const rows = stocktake.mergeRows(snap.rows, this.src.materials).map(r => {
        const m = byId[r.itemId] || {}
        const inputUnit = m.default_input_unit_code || r.unit
        return Object.assign(r, { inputUnit, inputLabel: units.unitName(inputUnit),
          countedInput: r.counted === null ? '' : String(units.fromBase(r.counted, inputUnit, this.src.units)) })
      })
      this.setData({ loading: false, documentId: id, rows, changed: false, pending: stocktake.pendingCount(rows),
        diffCount: rows.filter(r => r.diff).length })
    })
  },

  onStart() {
    if (!this.data.isManager) { wx.showToast({ title: '开始盘点需要店长权限', icon: 'none' }); return }
    if (!this.candidateIds.length) { wx.showToast({ title: '没有可盘点的散装或已开封库存', icon: 'none' }); return }
    api.post(this.ctx, 'FnbStocktake/CreateSnapshot', { requestId: this.keeper.get('snapshot'), itemIds: this.candidateIds }).then(res => {
      this.keeper.done('snapshot')
      this.store(res.documentId)
      this.setData({ gains: {} })
      return this.loadSnapshot(res.documentId)
    }).catch(err => { if (!err.retryable) this.keeper.done('snapshot'); base.fail(err) })
  },

  onAbandon() {
    wx.showModal({ title: '放弃本次盘点', content: '已录入的实盘数不会过账，之后可重新开始盘点。', confirmText: '放弃', confirmColor: '#EF4444',
      success: r => { if (r.confirm) { this.store(''); this.setData({ documentId: '', rows: [], gains: {} }) } } })
  },

  onCount(e) {
    const index = Number(e.currentTarget.dataset.index)
    const row = this.data.rows[index]
    const text = String(e.detail.value).trim()
    if (text === '' || text === row.countedInput) return
    const value = Number(text)
    if (isNaN(value) || value < 0) { wx.showToast({ title: '实盘数不能为负', icon: 'none' }); return }
    api.post(this.ctx, 'FnbStocktake/SaveCount', { documentId: this.data.documentId, itemId: row.itemId,
      countedQuantity: units.toBase(value, row.inputUnit, this.src.units), rowVersion: row.rowVersion })
      .then(res => {
        const merged = stocktake.mergeRows([{ item_id: row.itemId, system_qty: row.systemQty, counted_qty: res.counted_qty, rowVersion: res.rowVersion }], this.src.materials)[0]
        const rows = this.data.rows.slice()
        rows[index] = Object.assign({}, row, merged, { countedInput: text })
        this.setData({ rows, pending: stocktake.pendingCount(rows), diffCount: rows.filter(r => r.diff).length })
      }).catch(err => {
        if (err.code === 4) { wx.showToast({ title: '这一行被别人改过，已刷新', icon: 'none' }); this.loadSnapshot(this.data.documentId); return }
        base.fail(err)
      })
  },

  onPreview() {
    return api.get(this.ctx, 'FnbStocktake/PreviewAdjustment', { documentId: this.data.documentId }).then(list => {
      const changed = list.some(x => x.snapshotChanged)
      this.setData({ changed })
      if (changed) wx.showModal({ title: '盘点期间库存有变动', content: '有食材在盘点期间发生了入库、出餐或开封，需要重新开始盘点。', showCancel: false })
      return !changed
    }).catch(err => { base.fail(err); return false })
  },

  // ---- 盘盈承接批次 ----
  openGain(e) {
    const row = this.data.rows[Number(e.currentTarget.dataset.index)]
    const saved = this.data.gains[row.itemId]
    const gain = saved ? Object.assign({}, saved) : { itemId: row.itemId, name: row.name, diffText: row.diffText, batchNo: '', expireDate: '',
      storage: 'chilled', unitCost: '', photos: [], uploading: 0 }
    this.setData({ gainShow: true, gain })
    if (!gain.batchNo) {
      api.get(this.ctx, 'FnbMaterial/GenBatchNo').then(res => {
        const used = Object.keys(this.data.gains).map(k => this.data.gains[k].batchNo)
        this.setData({ 'gain.batchNo': forms.nextBatchNo(res.batchNo, used) })
      }).catch(() => {})
    }
  },
  closeGain() { this.setData({ gainShow: false }) },
  setGain(e) { this.setData({ ['gain.' + e.currentTarget.dataset.field]: e.detail.value !== undefined ? e.detail.value : e.currentTarget.dataset.value }) },
  onGainExpire(e) { this.setData({ 'gain.expireDate': e.detail.date }) },
  onGainPhotos(e) { this.setData({ 'gain.photos': e.detail.photos, 'gain.uploading': e.detail.uploading }) },
  saveGain() {
    const g = this.data.gain
    if (g.uploading > 0) { wx.showToast({ title: '照片还在上传', icon: 'none' }); return }
    if (!g.batchNo || !g.expireDate || g.expireDate < this.data.today) { wx.showToast({ title: '请填批次号和不早于今天的到期日期', icon: 'none' }); return }
    if (!g.photos.some(p => p.id)) { wx.showToast({ title: '请给盘盈的实物拍照', icon: 'none' }); return }
    this.setData({ ['gains.' + g.itemId]: g, gainShow: false })
  },

  onPost() {
    if (!this.data.isManager) { wx.showToast({ title: '过账需要店长权限', icon: 'none' }); return }
    if (this.data.posting) return
    if (this.data.pending) { wx.showToast({ title: '还有 ' + this.data.pending + ' 项没录实盘数', icon: 'none' }); return }
    const missing = stocktake.gainItems(this.data.rows).filter(r => !this.data.gains[r.itemId])
    if (missing.length) { wx.showToast({ title: missing[0].name + ' 盘盈，请补承接批次信息', icon: 'none' }); return }
    this.onPreview().then(okToPost => {
      if (!okToPost) return
      wx.showModal({ title: '提交盘点', content: '以实盘数量为准更新库存，差异进损耗台账，过账后不可撤回。', confirmText: '过账',
        success: r => {
          if (!r.confirm) return
          const gains = stocktake.gainItems(this.data.rows).map(row => {
            const g = this.data.gains[row.itemId]
            return { itemId: row.itemId, batchNo: g.batchNo, expireDate: g.expireDate, storageType: g.storage,
              unitCost: g.unitCost === '' ? 0 : Number(g.unitCost), imageIds: g.photos.filter(p => p.id).map(p => p.id), expiryNote: null }
          })
          this.setData({ posting: true })
          api.post(this.ctx, 'FnbStocktake/PostStocktake', { documentId: this.data.documentId, gains }).then(() => {
            this.store('')
            this.setData({ posting: false, documentId: '', rows: [], gains: {} })
            wx.showToast({ title: '盘点已过账', icon: 'success' })
            this.load()
          }).catch(err => { this.setData({ posting: false }); base.fail(err) })
        } })
    })
  }
})
