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

  // 商品图加载失败（URL 坏了/文件不在那台服务器上）时退回数字热区，
  // 否则只会显示一个有高度但空白的色块，看不出到底是"没配图"还是"图挂了"
  onHeroImageError(e) {
    console.error('次卡商品图加载失败', this.data.product && this.data.product.imageUrl, e && e.detail)
    this.setData({ 'product.imageUrl': '' })
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
    that.setData({ buying: true })
    // 走顾客自助专用下单接口：订单归属购买人本人、商品/价格服务端现算。
    // 不用 Order/PlaceOrder——那条路在下单人是店员时只写 staff_id、member_id 留空，
    // 订单没有归属会员，确认页会判成「订单不存在」。
    data.placeMyPunchCardOrderPromise(product.id, that.data.qty, app.globalData.sessionKey).then(function (res) {
      that.setData({ buying: false })
      if (!res || !res.orderId) { return }
      // 顾客自助不走 /pages/payment/settle（那是店员开单收银页：生成二维码给顾客扫、
      // 还带现金/挂账/支付宝等店员才用得到的方式）。这里跳顾客自己的确认页，
      // 核对数量/金额/使用规则后在页内直接调起微信支付。
      wx.navigateTo({ url: '/pages/punchcard/punchcard_confirm?orderId=' + res.orderId })
    }).catch(function () {
      that.setData({ buying: false })
    })
  }
})
