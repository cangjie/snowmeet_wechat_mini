// pages/mine/punchcard_usage.js
// 我的次卡·使用明细：从「我的次卡」点某张卡进来，列出这张卡被哪些订单核销过
// （订单号 / 订单业务日期时间 / 该订单核销的次数）。
// 数据全部来自 Rent/GetMyPunchCardUsages，服务端按 order_id 汇总 punch_card_used
// （该表是"每条 rental / 每件 care 一行"的粒度，同一订单可能有多行）并校验卡属于本人。
var app = getApp()
var data = require('../../utils/data.js')

Page({
  data: {
    cardId: 0,
    card: null,
    usages: [],
    usedTotal: 0,
    loading: true
  },

  onLoad(options) {
    var cardId = parseInt(options.cardId, 10) || 0
    this.setData({ cardId: cardId })
    var that = this
    app.loginPromiseNew.then(function () {
      that.getData()
    })
  },

  getData() {
    var that = this
    if (!that.data.cardId) {
      that.setData({ loading: false })
      return
    }
    that.setData({ loading: true })
    data.getMyPunchCardUsagesPromise(that.data.cardId, app.globalData.sessionKey).then(function (res) {
      res = res || {}
      var card = res.card || null
      if (card) {
        card.remainingStr = card.isSeason ? '不限次数' : ('剩余 ' + card.remaining + ' 次')
      }
      that.setData({
        card: card,
        usages: res.usages || [],
        usedTotal: res.usedTotal || 0,
        loading: false
      })
      if (card) {
        wx.setNavigationBarTitle({ title: card.card_name || '次卡使用明细' })
      }
    }).catch(function () {
      that.setData({ loading: false })
    })
  }
})
