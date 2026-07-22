// pages/mine/punchcard/my_punchcards.js
// 我的次卡：顾客自助会话，member_id 由服务端从 sessionKey 解析，不需要传参。
var app = getApp()
var util = require('../../../utils/util.js')
var data = require('../../../utils/data.js')

Page({
  data: {
    cards: [],
    loading: false
  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      that.getData()
    })
  },

  getData() {
    var that = this
    that.setData({ loading: true })
    data.getMyPunchCardsPromise(app.globalData.sessionKey).then(function (cards) {
      cards = cards || []
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i]
        c.remainingStr = c.isSeason ? '不限次数' : ('剩余 ' + c.remaining + ' 次')
      }
      that.setData({ cards: cards, loading: false })
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  onBuyCard() {
    wx.navigateTo({ url: '/pages/mine/punchcard/punchcard_shop' })
  }
})
