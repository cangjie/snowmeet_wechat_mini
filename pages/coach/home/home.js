// 分销商中心：机构发会籍卡并分享、看领取情况；所有分销商看顾客消费、看自己的优惠券。教练和 KOL 没有发卡（2026-11-17：只有机构能发整个雪季有效的会籍卡）
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/coach-view.js')
const shareCover = require('../common/share-cover.js')

const COUPON_STATE = {
  held: { text: '在手', tone: 'blue' }, pending: { text: '待接受', tone: 'warn' }, accepted: { text: '已被接受', tone: 'ok' },
  used: { text: '已使用', tone: 'muted' }, expired: { text: '已过期', tone: 'muted' }
}

Page({
  data: {
    blocked: '', loading: true, tab: 'share', coach: null, counts: null, benefit: null, validUntil: '',
    cards: [], pending: [], statusRows: [], templates: [],
    students: [], studentSummary: null,
    couponSummary: null, coupons: [], creating: false
  },

  onLoad(options) {
    if (options && options.tab) this.setData({ tab: options.tab })
    // 只允许用卡片里的按钮分享，不让右上角菜单把教练中心本身分享出去
    if (wx.hideShareMenu) wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    this.boot()
  },
  onShow() { if (this.loadedOnce) this.load() },
  onReady() { this._membershipCanvasReady = true; shareCover.prepareList(this, 'templates', '学员卡'); shareCover.prepareList(this, 'pending', '学员卡') },
  onUnload() { this._membershipCanvasClosed = true },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  boot() {
    return base.boot(this, 'coach').then(() => this.load()).catch(() => {})
  },

  load() {
    return api.getMyCoach().then(d => {
      if (!d.isCoach) {
        this.setData({ loading: false, blocked: '你还不是分销商，请联系管理员添加' })
        return
      }
      this.loadedOnce = true
      this.setData({
        loading: false, blocked: '', coach: d.coach, counts: d.cards,
        benefit: view.benefitLines(d.coach.carePrices, d.coach.rentalRate), validUntil: view.dayText(d.coach.validUntil)
      })
      // 教练 / KOL 没有发卡和领取情况：从旧入口带 tab=share 进来也落到「我的券」
      if (d.coach.introducerType !== '机构' && (this.data.tab === 'share' || this.data.tab === 'status')) this.setData({ tab: 'coupons' })
      return this.loadTab()
    }).catch(err => { this.setData({ loading: false }); if (err && err.code === 3) this.setData({ blocked: '你还不是分销商，请联系管理员添加' }); else base.fail(err) })
  },

  loadTab() {
    const tab = this.data.tab
    if (tab === 'students') return this.loadStudents()
    if (tab === 'coupons') return this.loadCoupons()
    return this.loadCards().then(() => this.data.coach && this.data.coach.introducerType === '机构' ? this.loadTemplates() : null)
  },

  onTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); this.loadTab() },
  loadTemplates() { return api.listCardTemplates().then(d => {
    const rows = (d.templates || []).map(t => Object.assign({}, t, { benefit: view.benefitLines(t.carePrices, t.rentalRate) }))
    this.setData({ templates: shareCover.decorate(this, rows, '学员卡') })
    shareCover.prepareList(this, 'templates', '学员卡')
  }).catch(base.fail) },
  onManageTemplates() { wx.navigateTo({ url: '../card_standard/card_standard' }) },
  onRetryCover(e) {
    const d = e.currentTarget.dataset
    if (d.field === 'templates' || d.field === 'pending') shareCover.retry(this, d.field, d.name, '学员卡')
  },

  // ---- 发卡 / 领取情况 ----
  loadCards() {
    return api.listMyCards().then(d => {
      const rows = d.cards.map(x => Object.assign({}, x.card, {
        sharePath: x.sharePath, name: x.card.cardName || '学员卡', tag: view.statusTag(x.card.status),
        created: view.dateText(x.card.createDate), claimed: view.dateText(x.card.claimedAt)
      }))
      this.setData({
        counts: d.counts, cards: rows,
        pending: shareCover.decorate(this, rows.filter(r => r.status === 'issued'), '学员卡'),
        statusRows: rows
      })
      shareCover.prepareList(this, 'pending', '学员卡')
    }).catch(base.fail)
  },

  onCreateForTemplate(e) {
    if (this.data.creating) return
    const id = Number(e.currentTarget.dataset.id)
    const template = this.data.templates.find(t => t.id === id)
    if (!template) return
    this.setData({ creating: true })
    return api.createCard(id).then(card => {
      const pending = this.data.pending.concat([{ id: card.cardId, name: card.cardName || template.name, tokenTail: card.tokenTail, sharePath: card.sharePath }])
      this.setData({ creating: false, pending: shareCover.decorate(this, pending, '学员卡') })
      shareCover.prepareList(this, 'pending', '学员卡')
      base.done('已生成，请分享给一位顾客')
    }).catch(err => { this.setData({ creating: false }); base.fail(err) })
  },

  onCreate() {
    if (this.data.creating) return
    this.setData({ creating: true })
    api.createCard().then(() => {
      this.setData({ creating: false })
      base.done('已生成，点「分享给顾客」发出去')
      return this.loadCards()
    }).catch(err => { this.setData({ creating: false }); base.fail(err) })
  },

  onRevoke(e) {
    const id = e.currentTarget.dataset.id
    base.confirm('撤销学员卡', '撤销后这张卡不能再被领取。', '撤销').then(ok => {
      if (ok) api.revokeMyCard(id).then(() => { this.setData({ pending: this.data.pending.filter(c => c.id !== id) }); base.done('已撤销'); this.loadCards() }).catch(base.fail)
    })
  },

  // 分享按钮（open-type="share"）：路径由服务端给，指向学员领取页
  onShareAppMessage(e) {
    const d = this.data
    const target = e && e.target && e.target.dataset
    const name = d.coach ? d.coach.name : '分销商'
    const path = (target && target.path) || (d.pending[0] && d.pending[0].sharePath) || '/pages/mine/mine'
    return { title: name + '送你一张' + ((target && target.name) || '学员卡'), path, imageUrl: (target && target.cover) || shareCover.FALLBACK }
  },

  // ---- 学员消费 ----
  loadStudents() {
    return api.getStudents().then(d => {
      const students = d.students.map(s => Object.assign({}, s, {
        sourceText: s.sources.map(x => (x === 'card' ? '学员卡' : '优惠券')).join(' · '),
        sourceTone: s.sources.indexOf('card') >= 0 ? 'blue' : 'warn', last: view.dayText(s.lastOrderDate)
      }))
      this.setData({ studentSummary: d.summary, students })
    }).catch(base.fail)
  },
  onStudent(e) { wx.navigateTo({ url: '../student/student?id=' + e.currentTarget.dataset.id }) },

  // ---- 我的优惠券 ----
  loadCoupons() {
    return api.getMyCoupons().then(d => {
      const coupons = d.items.map(i => Object.assign({}, i, {
        tag: COUPON_STATE[i.state] || COUPON_STATE.held, accepted: view.dateText(i.acceptedAt), expire: view.dayText(i.expireDate)
      }))
      this.setData({ couponSummary: d.summary, coupons })
    }).catch(base.fail)
  },
  onGoTickets() { wx.navigateTo({ url: '/pages/mine/ticket/ticket_list' }) }
})
