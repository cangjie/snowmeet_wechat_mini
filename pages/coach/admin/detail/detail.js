// 分销商详情（管理员）：优惠券底价 / 会籍卡底价（只有机构）/ 他的卡 / 停用与改名。
// 2026-11-17：原来的「价格设置」改成「优惠券底价」——限制这位分销商自己生成的单张优惠券不能低于多少钱、多少折扣、减免不能超过多少；
// 原来的「底价」改名「会籍卡底价」，只管机构自己的会籍卡。
const api = require('../../common/api.js')
const base = require('../../common/page-base.js')
const view = require('../../common/coach-view.js')

Page({
  data: {
    blocked: '', loading: true, tab: 'coupon', coach: null,
    couponCells: [], couponDirty: false,
    cardFilter: '', cardCounts: null, cards: [], name: '',
    floorCells: [], floorRentalText: '', floorDirty: false
  },

  onLoad(options) {
    this.id = Number(options.id)
    base.boot(this, 'admin').then(() => this.load()).catch(() => {})
  },
  onShow() { if (this.loadedOnce && !this.data.couponDirty && !this.data.floorDirty) this.load() },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    return api.getCoach(this.id).then(c => {
      this.loadedOnce = true
      this.setData({
        loading: false, coach: c, name: c.name
      })
      wx.setNavigationBarTitle({ title: c.name })
      if (this.data.tab === 'coupon') return this.loadCouponFloors()
      if (this.data.tab === 'cards') return this.loadCards()
      if (this.data.tab === 'floor') return this.loadFloors()
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab })
    if (tab === 'coupon') this.loadCouponFloors()
    if (tab === 'cards') this.loadCards()
    if (tab === 'floor') this.loadFloors()
  },

  // ---- 优惠券底价：这位分销商自己生成单张优惠券时，一口价不能低于 / 折扣不能低于 / 减免不能超过；某种方式留空 = 没开放，他的界面不显示 ----
  loadCouponFloors() {
    return api.getCouponFloors(this.id).then(f => {
      this.setData({ couponCells: view.couponFloorEditCells(f), couponDirty: false })
    }).catch(base.fail)
  },
  onCouponFixed(e) { this.setCouponText(e, 'fixedText') },
  onCouponRate(e) { this.setCouponText(e, 'rateText') },
  onCouponOff(e) { this.setCouponText(e, 'offText') },
  setCouponText(e, key) {
    const patch = { couponDirty: true }
    patch['couponCells[' + Number(e.currentTarget.dataset.i) + '].' + key] = e.detail.value
    this.setData(patch)
  },
  onCouponSave() {
    if (!this.data.couponDirty) return
    const r = view.couponFloorsPayload(this.data.couponCells)
    if (r.error) { wx.showToast({ title: r.error, icon: 'none', duration: 2800 }); return }
    api.setCouponFloors(this.id, r.care).then(f => {
      this.setData({ couponCells: view.couponFloorEditCells(f), couponDirty: false })
      base.done('优惠券底价已保存')
    }).catch(base.fail)
  },

  // ---- 会籍卡底价（只有机构有）：机构自己制作会籍卡时，价格不能低于这里设的底价；没设的格子 = 不开放 ----
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
