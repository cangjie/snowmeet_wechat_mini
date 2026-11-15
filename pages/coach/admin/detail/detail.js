// 教练详情（管理员）：价格设置 / 他的卡 / 停用与改名。价格只影响之后领取的新卡
const api = require('../../common/api.js')
const base = require('../../common/page-base.js')
const view = require('../../common/coach-view.js')

Page({
  data: {
    blocked: '', loading: true, tab: 'price', coach: null, modes: view.MODES,
    cells: [], rentalText: '', dirty: false, trialBase: '168', trial: [],
    cardFilter: '', cardCounts: null, cards: [], name: '',
    floorCells: [], floorRentalText: '', floorDirty: false
  },

  onLoad(options) {
    this.id = Number(options.id)
    base.boot(this, 'admin').then(() => this.load()).catch(() => {})
  },
  onShow() { if (this.loadedOnce && !this.data.dirty) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    return api.getCoach(this.id).then(c => {
      this.loadedOnce = true
      this.setData({
        loading: false, coach: c, name: c.name, dirty: false,
        cells: view.editCells(c.carePrices), rentalText: view.rentalEditText(c.rentalRate)
      })
      wx.setNavigationBarTitle({ title: c.name })
      this.refreshTrial()
      if (this.data.tab === 'cards') return this.loadCards()
      if (this.data.tab === 'floor') return this.loadFloors()
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
    if (tab === 'cards') this.loadCards()
    if (tab === 'floor') this.loadFloors()
  },

  // ---- 底价（只有机构有）：机构自己制作会员卡时，价格不能低于这里设的底价；没设的格子 = 不开放 ----
  loadFloors() {
    return api.getCoachFloors(this.id).then(f => {
      this.setData({ floorCells: view.floorEditCells(f), floorRentalText: view.floorRentalText(f), floorDirty: false })
    }).catch(base.fail)
  },
  onFloorRate(e) {
    const patch = { floorDirty: true }
    patch['floorCells[' + Number(e.currentTarget.dataset.i) + '].rateText'] = e.detail.value
    this.setData(patch)
  },
  onFloorFixed(e) {
    const patch = { floorDirty: true }
    patch['floorCells[' + Number(e.currentTarget.dataset.i) + '].fixedText'] = e.detail.value
    this.setData(patch)
  },
  onFloorRental(e) { this.setData({ floorRentalText: e.detail.value, floorDirty: true }) },
  onFloorSave() {
    if (!this.data.floorDirty) return
    const r = view.floorsPayload(this.data.floorCells, this.data.floorRentalText)
    if (r.error) { wx.showToast({ title: r.error, icon: 'none', duration: 2800 }); return }
    api.setCoachFloors(this.id, r.care, r.rentalMinRate).then(f => {
      this.setData({ floorCells: view.floorEditCells(f), floorRentalText: view.floorRentalText(f), floorDirty: false })
      base.done('底价已保存')
    }).catch(base.fail)
  },

  // ---- 价格设置 ----
  onMode(e) {
    const i = Number(e.currentTarget.dataset.i)
    const patch = {}
    patch['cells[' + i + '].mode'] = e.currentTarget.dataset.mode
    if (e.currentTarget.dataset.mode === 'none') patch['cells[' + i + '].text'] = ''
    patch.dirty = true
    this.setData(patch)
    this.refreshTrial()
  },
  onCellText(e) {
    const patch = { dirty: true }
    patch['cells[' + Number(e.currentTarget.dataset.i) + '].text'] = e.detail.value
    this.setData(patch)
    this.refreshTrial()
  },
  onRentalText(e) { this.setData({ rentalText: e.detail.value, dirty: true }) },
  onTrialBase(e) { this.setData({ trialBase: e.detail.value }); this.refreshTrial() },

  // 试算：按填写的原价，算各门店单项/双项的教练价。4 格每格都显示：没设价格显示「无优惠」，
  // 填得不对（如折扣填了 80）显示红色提示，同一句话也挂在那一行下面——不能悄悄跳过
  refreshTrial() {
    const base = Number(this.data.trialBase)
    const patch = {}
    const trial = []
    this.data.cells.forEach((c, i) => {
      const label = view.SHORT[c.shop] + c.tier
      const payload = view.cellsPayload([c])
      // 单格校验的提示去掉「万龙单项：」前缀，行内显示更紧凑
      const err = payload.error ? payload.error.replace(/^[^：]*：/, '') : ''
      patch['cells[' + i + '].err'] = err
      if (err) { trial.push({ key: c.key, label, error: err }); return }
      if (c.mode === 'none') { trial.push({ key: c.key, label, none: true }); return }
      if (!(base > 0)) return
      const r = view.previewPrice(payload.care[0], base)
      trial.push({ key: c.key, label, price: r.price, discount: r.discount })
    })
    patch.trial = trial
    this.setData(patch)
  },

  onSave() {
    if (!this.data.dirty) return
    const care = view.cellsPayload(this.data.cells)
    if (care.error) { wx.showToast({ title: care.error, icon: 'none', duration: 2800 }); return }
    const rental = view.rentalPayload(this.data.rentalText)
    if (rental.error) { wx.showToast({ title: rental.error, icon: 'none', duration: 2800 }); return }
    api.setPricing(this.id, care.care, rental.rate).then(() => { base.done('已保存'); this.load() }).catch(base.fail)
  },

  // ---- 他的卡 ----
  loadCards() {
    return api.listCoachCards(this.id, this.data.cardFilter).then(d => {
      this.setData({ cardCounts: d.counts, cards: d.cards.map(c => this.cardRow(c)) })
    }).catch(base.fail)
  },
  cardRow(c) {
    const lines = view.benefitLines(c.carePrices, c.rentalRate)
    return Object.assign({}, c, {
      tag: view.statusTag(c.status), created: view.dateText(c.createDate), claimed: view.dateText(c.claimedAt),
      until: view.dayText(c.validUntil), care1: lines.lines[0].one + ' / ' + lines.lines[0].two,
      care2: lines.lines[1].one + ' / ' + lines.lines[1].two, rental: lines.rental
    })
  },
  onCardFilter(e) { this.setData({ cardFilter: e.currentTarget.dataset.s }); this.loadCards() },
  onRevoke(e) {
    const id = e.currentTarget.dataset.id
    const card = this.data.cards.find(c => c.id === id)
    const claimed = card && card.status === 'claimed'
    base.confirm('撤销学员卡', claimed ? '这张卡学员已领取，撤销后不再用于新订单，已有的使用记录保留。' : '撤销后这张卡不能再被领取。', '撤销').then(ok => {
      if (ok) api.revokeCard(id).then(() => { base.done('已撤销'); this.loadCards(); this.load() }).catch(base.fail)
    })
  },

  // ---- 停用 / 改名 ----
  onName(e) { this.setData({ name: e.detail.value }) },
  onRename() {
    const name = (this.data.name || '').trim()
    if (!name || name === this.data.coach.name) return
    api.updateCoach(this.id, name, null).then(() => { base.done('已保存'); this.load() }).catch(base.fail)
  },
  onToggleValid() {
    const valid = this.data.coach.valid
    base.confirm(valid ? '停用分销商' : '恢复分销商', valid
      ? '停用后，已领的学员卡继续有效，但这位分销商不能再发新卡，没领的卡也不能再领。'
      : '恢复后分销商可以继续发卡，原来的价格保留。', valid ? '停用' : '恢复').then(ok => {
      if (ok) api.updateCoach(this.id, null, !valid).then(() => { base.done(valid ? '已停用' : '已恢复'); this.load() }).catch(base.fail)
    })
  }
})
