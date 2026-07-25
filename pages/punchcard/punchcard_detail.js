// pages/punchcard/punchcard_detail.js
// 次卡/季卡详情页：按 id 调 Rent/GetPunchCardProduct 单条查询（后端自己反查这是租赁卡还是养护卡、
// 次卡还是季卡）；选份数 → 下单（product_id 相同的 N 条 retail 行）→ 跳通用结算页付款。
// 支付成功后每条 retail 行各建一张 PunchCard（见后端 DealSuccessPaidOrder 的"零售"分支），
// 本页不需要额外处理发卡逻辑。
//
// ⚠️ 名称/图片/简介/价格/次数全部来自数据库，本页不得自己拼商品文案。
// 原来这里是"在租赁次卡列表里按 id 找商品"，养护卡点进来必然报"商品不存在或已下架"。
var app = getApp()
var util = require('../../utils/util.js')
var data = require('../../utils/data.js')

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
    data.getPunchCardProductPromise(that.data.id, app.globalData.sessionKey).then(function (product) {
      if (!product) {
        wx.showToast({ title: '商品不存在或已下架', icon: 'none' })
        setTimeout(function () { wx.navigateBack() }, 1200)
        return
      }
      product.priceStr = util.showAmount(product.sale_price)
      product.unitPriceStr = (!product.isSeason && product.punch_total > 0)
        ? util.showAmount(product.sale_price / product.punch_total) : ''
      product.shopLabel = product.shop || '不限门店 · 全部门店通用'
      // 季卡不限次数，「N 次核销」这类文案对它不成立，统一在这里派生好给 wxml 用
      product.countLabel = product.isSeason ? '不限次数' : (product.punch_total + ' 次')
      product.usageMain = product.isSeason ? '不限次数核销' : (product.punch_total + ' 次核销')
      product.usageSub = product.isSeason ? '有效期内不限次数使用' : '每次租用消耗 1 次，用完即止'
      that.setData({ product: product, loading: false })
      that._updateTotal()
    }).catch(function () {
      wx.showToast({ title: '商品不存在或已下架', icon: 'none' })
      that.setData({ loading: false })
      setTimeout(function () { wx.navigateBack() }, 1200)
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
