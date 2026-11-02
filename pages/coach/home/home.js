// 教练中心（教练自己）：发学员卡并分享、看领取情况、看学员消费、看自己的优惠券
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
    cards: [], pending: [], statusRows: [],
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
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  boot() {
    return base.boot(this, 'coach').then(() => this.load()).catch(() => {})
  },

  load() {
    return api.getMyCoach().then(d => {
      if (!d.isCoach) {
        this.setData({ loading: false, blocked: '你还不是教练，请联系管理员添加' })
        return
      }
      this.loadedOnce = true
      this.setData({
        loading: false, blocked: '', coach: d.coach, counts: d.cards,
        benefit: view.benefitLines(d.coach.carePrices, d.coach.rentalRate), validUntil: view.dayText(d.coach.validUntil)
      })
      return this.loadTab()
    }).catch(err => { this.setData({ loading: false }); if (err && err.code === 3) this.setData({ blocked: '你还不是教练，请联系管理员添加' }); else base.fail(err) })
  },

  loadTab() {
    const tab = this.data.tab
    if (tab === 'students') return this.loadStudents()
    if (tab === 'coupons') return this.loadCoupons()
    return this.loadCards()
  },

  onTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); this.loadTab() },

  // ---- 发卡 / 领取情况 ----
  loadCards() {
    return api.listMyCards().then(d => {
      const rows = d.cards.map(x => Object.assign({}, x.card, {
        sharePath: x.sharePath, tag: view.statusTag(x.card.status),
        created: view.dateText(x.card.createDate), claimed: view.dateText(x.card.claimedAt)
      }))
      this.setData({
        counts: d.counts, cards: rows,
        pending: rows.filter(r => r.status === 'issued'),
        statusRows: rows
      })
    }).catch(base.fail)
  },

  onCreate() {
    if (this.data.creating) return
    this.setData({ creating: true })
    api.createCard().then(() => {
      this.setData({ creating: false })
      base.done('已生成，点「分享给学员」发出去')
      return this.loadCards()
    }).catch(err => { this.setData({ creating: false }); base.fail(err) })
  },

  onRevoke(e) {
    const id = e.currentTarget.dataset.id
    base.confirm('撤销学员卡', '撤销后这张卡不能再被领取。', '撤销').then(ok => {
      if (ok) api.revokeMyCard(id).then(() => { base.done('已撤销'); this.loadCards() }).catch(base.fail)
    })
  },

  // 分享按钮（open-type="share"）：路径由服务端给，指向学员领取页
  onShareAppMessage(e) {
    const d = this.data
    const target = e && e.target && e.target.dataset
    const name = d.coach ? d.coach.name : '教练'
    const path = (target && target.path) || (d.pending[0] && d.pending[0].sharePath) || '/pages/mine/mine'
    return { title: name + '送你一张学员卡', path }
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
