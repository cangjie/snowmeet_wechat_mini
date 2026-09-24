// 批次详情：效期依据、照片；开封 / 报损（店长）/ 打印标签
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const expiry = require('../common/expiry.js')
const units = require('../common/units.js')
const view = require('../common/stock-view.js')
const requestId = require('../common/request-id.js')
const IMG_HOST = 'https://snowmeet.wanlonghuaxue.com'
const SOURCE = { manual: '手填保质期推算', package: '包装标注', category: '食材规则计算', estimated: '按生产月份估算', opened: '开封后重算' }

function parseId(options) {
  if (options.id) return Number(options.id)
  if (options.q) {
    const m = decodeURIComponent(options.q).match(/[?&]id=(\d+)/)
    if (m) return Number(m[1])
  }
  return 0
}

Page({
  data: { blocked: '', loading: true, isManager: false, info: null, photos: [], printShow: false, printBatch: null },

  onLoad(options) {
    this.batchId = parseId(options)
    this.keeper = requestId.createKeeper()
    base.boot(this).then(() => this.load()).catch(() => {})
  },

  load() {
    if (!this.ctx || !this.batchId) { this.setData({ loading: false, blocked: this.batchId ? this.data.blocked : '批次不存在' }); return Promise.resolve() }
    return api.get(this.ctx, 'FnbInventory/GetBatch', { batchId: this.batchId }).then(res => {
      this.raw = res
      return api.get(this.ctx, 'FnbCatalog/GetMaterial', { id: res.stock.item_id })
    }).then(material => {
      const b = this.raw.batch
      const s = this.raw.stock
      const unit = material.base_unit_code
      const days = expiry.daysBetween(this.data.today, b.expire_date)
      const packs = s.stock_form === 'sealed'
      const info = {
        name: b.name, batchNo: b.batch_no, form: s.stock_form, formLabel: view.FORM_LABEL[s.stock_form] || s.stock_form,
        storage: expiry.storageLabel(s.storage_type), qtyLabel: packs ? (s.sealed_pack_count || 0) + ' ' + (s.pack_unit_name || '件') + ' × ' + units.formatQty(s.pack_size, unit) : units.formatQty(s.quantity, unit),
        totalLabel: units.formatQty(s.quantity, unit), quantity: s.quantity, unit,
        expireDate: String(b.expire_date).slice(0, 10), expireText: view.expireText(days), tone: view.tone(days, b.warn_days),
        produceDate: b.produce_date ? String(b.produce_date).slice(0, 10) : '', shelfLife: b.shelf_life_value ? b.shelf_life_value + ' ' + (b.shelf_life_unit || '天') : '',
        source: SOURCE[s.expiry_source] || s.expiry_source || '', note: s.expiry_note || '', warnDays: b.warn_days,
        openedDate: s.opened_date ? String(s.opened_date).slice(0, 10) : '', originalExpire: s.original_expire_date ? String(s.original_expire_date).slice(0, 10) : '',
        openRule: packs && s.open_storage_type ? '开封后' + expiry.storageLabel(s.open_storage_type) + ' ' + s.open_shelf_life_days + ' 天' : '',
        cost: s.stock_amount === null || s.stock_amount === undefined ? '' : units.money(s.stock_amount),
        destroyed: s.is_destroyed, empty: s.quantity <= 0,
        canOpen: packs && (s.sealed_pack_count || 0) > 0 && days >= 0 && !s.is_destroyed,
        packName: s.pack_unit_name || '件', packSizeLabel: units.formatQty(s.pack_size, unit)
      }
      this.setData({ loading: false, info })
      wx.setNavigationBarTitle({ title: b.name })
      if (b.image_ids) {
        api.get(this.ctx, 'FnbMaterial/GetImages', { ids: b.image_ids })
          .then(list => this.setData({ photos: (list || []).map(p => IMG_HOST + p.file_path_name) })).catch(() => {})
      }
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onPreview(e) { wx.previewImage({ current: e.currentTarget.dataset.url, urls: this.data.photos }) },

  onOpen() {
    const info = this.data.info
    wx.showModal({
      title: '开封 1 ' + info.packName, content: '放出 ' + info.packSizeLabel + '，之后按' + (info.openRule || '开封后保质期') + '计算。', confirmText: '开封',
      success: res => {
        if (!res.confirm) return
        const key = 'open:' + this.batchId
        api.post(this.ctx, 'FnbInventory/PostOpen', { requestId: this.keeper.get(key), parentBatchId: this.batchId, packCount: 1 })
          .then(() => { this.keeper.done(key); wx.showToast({ title: '已开封', icon: 'success' }); this.load() })
          .catch(err => { if (!err.retryable) this.keeper.done(key); base.fail(err) })
      }
    })
  },

  onWaste() {
    if (!this.data.isManager) { wx.showToast({ title: '报损需要店长权限', icon: 'none' }); return }
    const info = this.data.info
    wx.showActionSheet({
      itemList: ['损坏', '临期报损', '其他'],
      success: pick => {
        const reasonCode = ['damage', 'near_expiry', 'other'][pick.tapIndex]
        wx.showModal({
          title: '报损数量（' + units.unitName(info.unit) + '）', editable: true, content: String(info.quantity),
          placeholderText: '在库 ' + info.totalLabel, confirmText: '报损', confirmColor: '#EF4444',
          success: res => {
            if (!res.confirm) return
            const qty = Number(res.content)
            if (!(qty > 0) || qty > info.quantity) { wx.showToast({ title: '数量需大于 0 且不超过在库量', icon: 'none' }); return }
            const key = 'waste:' + this.batchId + ':' + reasonCode + ':' + qty
            api.post(this.ctx, 'FnbInventory/PostWaste', { requestId: this.keeper.get(key), batchId: this.batchId, quantity: qty, reasonCode, remark: null })
              .then(() => { this.keeper.done(key); wx.showToast({ title: '已报损', icon: 'success' }); this.load() })
              .catch(err => { if (!err.retryable) this.keeper.done(key); base.fail(err) })
          }
        })
      }
    })
  },

  onPrint() {
    const b = this.raw.batch
    this.setData({ printShow: true, printBatch: { id: b.id, name: b.name, batch_no: b.batch_no, expire_date: String(b.expire_date).slice(0, 10) } })
  },
  onPrintClose() { this.setData({ printShow: false }) }
})
