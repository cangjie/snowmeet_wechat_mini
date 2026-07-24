// pages/mine/punchcard/punchcard_shop.js
// 购买次卡·首页：选店铺 → 浏览可购买的次卡商品 → 点卡片进详情页选份数、确认购买。
// 本页只做展示，不做任何下单动作——下单逻辑收在 punchcard_detail；价格/门店范围均来自
// 服务端 Rent/GetPunchCardProducts，服务端 Order/PlaceOrder 独立定价，不信任客户端展示的价格。
var app = getApp()
var util = require('../../../utils/util.js')
var data = require('../../../utils/data.js')

Page({
  data: {
    shop: null,
    products: [],
    loading: true
  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      that.getData()
    })
  },

  shopSelected(e) {
    this.setData({ shop: e.detail.shop })
    this.getData()
  },

  getData() {
    var that = this
    that.setData({ loading: true })
    data.getPunchCardProductsPromise(that.data.shop, app.globalData.sessionKey).then(function (products) {
      products = products || []
      for (var i = 0; i < products.length; i++) {
        var p = products[i]
        p.priceStr = util.showAmount(p.sale_price)
        p.shopLabel = p.shop || '不限门店'
        p.unitPriceStr = p.punch_total > 0 ? util.showAmount(p.sale_price / p.punch_total) : ''
      }
      that.setData({ products: products, loading: false })
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  onCardTap(e) {
    var id = parseInt(e.currentTarget.dataset.id, 10)
    var url = '/pages/mine/punchcard/punchcard_detail?id=' + id
    if (this.data.shop) { url += '&shop=' + encodeURIComponent(this.data.shop) }
    wx.navigateTo({ url: url })
  }
})
