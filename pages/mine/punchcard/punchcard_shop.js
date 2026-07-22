// pages/mine/punchcard/punchcard_shop.js
// 顾客自助购买次卡：选店铺 → 选商品 → 生成零售单（type=零售，retails 带 product_id）→
// 跳通用结算页付款。价格由服务端从 Product.sale_price 取，不信任本地展示的价格。
// 支付成功后的发卡逻辑在后端 OrderController.DealSuccessPaidOrder 的 "零售" 分支里自动完成，
// 本页不需要额外处理。
var app = getApp()
var util = require('../../../utils/util.js')
var data = require('../../../utils/data.js')

Page({
  data: {
    shop: null,
    products: [],
    ordering: false
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
    data.getPunchCardProductsPromise(that.data.shop, app.globalData.sessionKey).then(function (products) {
      that.setData({ products: products || [] })
    })
  },

  onBuyProduct(e) {
    var that = this
    var productId = parseInt(e.currentTarget.dataset.id, 10)
    var product = null
    for (var i = 0; i < that.data.products.length; i++) { if (that.data.products[i].id == productId) { product = that.data.products[i]; break } }
    if (!product) return
    if (!product.shop && !that.data.shop) {
      wx.showToast({ title: '请先选择门店', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认购买',
      content: '购买「' + product.name + '」（' + product.punch_total + ' 次），价格 ¥' + product.sale_price + '？',
      complete: function (res) {
        if (!res.confirm) return
        that._placeOrder(product)
      }
    })
  },

  _placeOrder(product) {
    var that = this
    that.setData({ ordering: true })
    var order = {
      type: '零售',
      shop: product.shop || that.data.shop,
      retails: [{ id: 0, order_id: 0, product_id: product.id, retail_type: '租赁卡类' }]
    }
    var postUrl = app.globalData.requestPrefix + 'Order/PlaceOrder?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(postUrl, order).then(function (placedOrder) {
      that.setData({ ordering: false })
      wx.navigateTo({ url: '/pages/payment/settle/index?orderId=' + placedOrder.id })
    }).catch(function () {
      that.setData({ ordering: false })
    })
  }
})
