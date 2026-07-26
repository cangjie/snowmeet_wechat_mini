// pages/mine/my_punchcards.js
// 我的次卡：顾客自助会话，member_id 由服务端从 sessionKey 解析，不需要传参。
var app = getApp()
var util = require('../../utils/util.js')
var data = require('../../utils/data.js')

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
        // 已退款的卡照样列出来（整行置灰 + 右侧标「已退款」），不能让它凭空消失，
        // 否则顾客会以为卡丢了；剩余次数对它已经没有意义，不再显示
        c.remainingStr = c.isRefund ? '' : (c.isSeason ? '不限次数' : ('剩余 ' + c.remaining + ' 次'))
      }
      that.setData({ cards: cards, loading: false })
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  // 点某张卡 → 看这张卡的核销记录（哪些订单用过、每单核销几次）
  onCardTap(e) {
    var cardId = e.currentTarget.dataset.id
    if (!cardId) { return }
    wx.navigateTo({ url: '/pages/mine/punchcard_usage?cardId=' + cardId })
  },

  onBuyCard() {
    wx.navigateTo({ url: '/pages/punchcard/punchcard_shop' })
  }
})
