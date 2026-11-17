// 分销商中心：机构看会籍卡的领取情况（每次分享一条，没领取的可直接删除）、去「制作会员卡」分享；所有分销商看顾客消费、看自己的优惠券。
// 教练和 KOL 没有发卡（2026-11-17：只有机构能发整个雪季有效的会籍卡）。分享二维码 / 分享小程序卡片都在 pages/coach/card_standard。
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/coach-view.js')

const COUPON_STATE = {
  held: { text: '在手', tone: 'blue' }, pending: { text: '待接受', tone: 'warn' }, accepted: { text: '已被接受', tone: 'ok' },
  used: { text: '已使用', tone: 'muted' }, expired: { text: '已过期', tone: 'muted' }
}

Page({
  data: {
    blocked: '', loading: true, tab: 'share', coach: null, counts: null, benefit: null, validUntil: '',
    statusRows: [],
    students: [], studentSummary: null,
    couponSummary: null, coupons: []
  },

  onLoad(options) {
    if (options && options.tab) this.setData({ tab: options.tab })
    // 这个页面本身不分享（分享在「制作会员卡」页），不让右上角菜单把分销商中心转发出去
    if (wx.hideShareMenu) wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    this.boot()
  },
  onShow() { if (this.loadedOnce) this.load() },
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
    if (tab === 'status') return this.loadCards()
    return null    // 发卡/分享：只是去「制作会员卡」的入口，不用加载
  },

  onTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); this.loadTab() },
  onGoShare() { wx.navigateTo({ url: '../card_standard/card_standard' }) },

  // ---- 领取情况：每次分享一条，领取人的头像昵称和卡号；没领取的可以直接删除 ----
  loadCards() {
    return api.listMyCards().then(d => {
      this.setData({ counts: d.counts, statusRows: (d.cards || []).map(x => view.shareRow(x.card)) })
    }).catch(base.fail)
  },

  // 删除还没人领取的分享：删除后二维码和小程序卡片都不能再领，这条记录不再列出
  onDeleteShare(e) {
    const id = Number(e.currentTarget.dataset.id)
    return base.confirm('删除这条分享', '删除后，这条分享记录会消失，对方扫码或点开都不能再领取这张会籍卡。', '删除').then(ok => {
      if (ok) return api.revokeMyCard(id).then(() => { base.done('已删除'); return this.loadCards() }).catch(err => { base.fail(err); return this.loadCards() })
    })
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
