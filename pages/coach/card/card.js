// 我的学员卡（学员）：已领取的学员卡、各店价格和有效期。到店开单时由店员在「优惠券/卡」里选用
const api = require('../common/api.js')
const base = require('../common/page-base.js')
const view = require('../common/coach-view.js')

Page({
  data: { loading: true, cards: [] },

  onLoad() { Promise.resolve(getApp().loginPromiseNew).then(() => this.load()).catch(() => {}) },
  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()) },

  load() {
    return api.getMyCards().then(d => {
      const cards = d.cards.map(c => Object.assign({}, c, {
        benefit: view.benefitLines(c.carePrices, c.rentalRate), until: view.dayText(c.validUntil)
      }))
      this.setData({ loading: false, cards })
    }).catch(err => { this.setData({ loading: false }); base.fail(err) })
  }
})
