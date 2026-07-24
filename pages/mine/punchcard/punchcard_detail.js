// pages/mine/punchcard/punchcard_detail.js
// 次卡详情页：从首页传来 id/shop，在 Rent/GetPunchCardProducts 结果里按 id 找到对应商品
// （列表本来就短，不新建单条查询接口）；选份数 → 下单（product_id 相同的 N 条 retail 行）→
// 跳通用结算页付款。支付成功后每条 retail 行各建一张 PunchCard（见后端 DealSuccessPaidOrder
// 的"零售"分支），本页不需要额外处理发卡逻辑。
var app = getApp()
var util = require('../../../utils/util.js')
var data = require('../../../utils/data.js')

Page({
  data: {
    id: 0,
    shop: null,
    product: null,
    qty: 1,
    totalStr: '',
    loading: true,
    buying: false
  },

  onLoad(options) {
    var id = parseInt(options.id, 10) || 0
    var shop = options.shop ? decodeURIComponent(options.shop) : null
    this.setData({ id: id, shop: shop })
    var that = this
    app.loginPromiseNew.then(function () {
      that._loadProduct()
    })
  },

  _loadProduct() {
    var that = this
    data.getPunchCardProductsPromise(that.data.shop, app.globalData.sessionKey).then(function (products) {
      products = products || []
      var product = null
      for (var i = 0; i < products.length; i++) {
        if (products[i].id == that.data.id) { product = products[i]; break }
      }
      if (!product) {
        wx.showToast({ title: '商品不存在或已下架', icon: 'none' })
        setTimeout(function () { wx.navigateBack() }, 1200)
        return
      }
      product.priceStr = util.showAmount(product.sale_price)
      product.unitPriceStr = product.punch_total > 0 ? util.showAmount(product.sale_price / product.punch_total) : ''
      product.shopLabel = product.shop || '不限门店 · 全部门店通用'
      that.setData({ product: product, loading: false })
      that._updateTotal()
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  onQtyMinus() {
    if (this.data.qty <= 1) return
    this.setData({ qty: this.data.qty - 1 })
    this._updateTotal()
  },

  onQtyPlus() {
    if (this.data.qty >= 9) return
    this.setData({ qty: this.data.qty + 1 })
    this._updateTotal()
  },

  _updateTotal() {
    var product = this.data.product
    if (!product) return
    this.setData({ totalStr: util.showAmount(product.sale_price * this.data.qty) })
  },

  onBuyNow() {
    var that = this
    var product = that.data.product
    if (!product || that.data.buying) return
    if (!product.shop && !that.data.shop) {
      wx.showToast({ title: '请先选择门店', icon: 'none' })
      return
    }
    that.setData({ buying: true })
    var retails = []
    for (var i = 0; i < that.data.qty; i++) {
      retails.push({ id: 0, order_id: 0, product_id: product.id, retail_type: '租赁卡类' })
    }
    var order = {
      type: '零售',
      shop: product.shop || that.data.shop,
      retails: retails
    }
    var postUrl = app.globalData.requestPrefix + 'Order/PlaceOrder?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(postUrl, order).then(function (placedOrder) {
      that.setData({ buying: false })
      wx.navigateTo({ url: '/pages/payment/settle/index?orderId=' + placedOrder.id })
    }).catch(function () {
      that.setData({ buying: false })
    })
  }
})
