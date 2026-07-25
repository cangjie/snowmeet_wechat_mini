// pages/punchcard/punchcard_shop.js
// 购买次卡·首页：以"公众号群发"风格的信息流展示可购买的次卡商品，每条一张横幅卡片 + 购买按钮。
// 已按要求去掉门店选择（纯线上自助购买，不需要先选店；商品本身的门店范围仍随条目展示）。
// 真实商品的权威识别方式是 category_code 命中 category 表 biz_type/name=="次卡" 那一行（详见
// RentController.ResolveNextCardCategoryCode）——本页按"租赁"/"养护"两个 biz_type 分别调用
// Rent/GetPunchCardProducts，只展示真实命中的商品；不再用本地 mock 数据顶位，哪个规格没有真实
// 商品就不显示，等对应 category_code 商品在后台建好、上架后自然出现。
var app = getApp()
var util = require('../../utils/util.js')
var data = require('../../utils/data.js')

var BIZ_TYPES = ['租赁', '养护']

Page({
  data: {
    items: [],
    loading: true
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
    // 不传店铺——纯线上自助购买不需要先选店；product.shop 仍随条目展示（不限门店的商品显示"不限门店"）
    // 按 biz_type 分别取（租赁/养护是两条独立的 category 规则，互不影响），再合并展示
    var sessionKey = app.globalData.sessionKey
    Promise.all(BIZ_TYPES.map(function (bizType) {
      return data.getPunchCardProductsPromise(null, sessionKey, bizType).catch(function () { return [] })
    })).then(function (resultsByBizType) {
      var realItems = []
      for (var b = 0; b < resultsByBizType.length; b++) {
        var bizType = BIZ_TYPES[b]
        var products = resultsByBizType[b] || []
        for (var i = 0; i < products.length; i++) {
          realItems.push(that._buildRealItem(products[i], bizType))
        }
      }
      that.setData({ items: that._formatItems(realItems), loading: false })
    }).catch(function () {
      that.setData({ items: [], loading: false })
    })
  },

  _buildRealItem(p, bizType) {
    return {
      _key: 'real-' + p.id,
      id: p.id,
      bizType: bizType,
      theme: bizType === '养护' ? 'care' : 'rent',
      name: p.name,
      punch_total: p.punch_total,
      sale_price: p.sale_price,
      shop: p.shop,
      desc: bizType === '养护'
        ? ('装备打蜡/护理次卡，' + p.punch_total + ' 次任选门店核销')
        : ('双板/单板 + 雪鞋租赁次卡，' + p.punch_total + ' 次任选门店核销')
    }
  },

  _formatItems(items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i]
      it.priceStr = util.showAmount(it.sale_price)
      it.unitPriceStr = (!it.isSeason && it.punch_total > 0) ? util.showAmount(it.sale_price / it.punch_total) : ''
    }
    return items
  },

  _goDetail(item) {
    if (!item) return
    wx.navigateTo({ url: '/pages/punchcard/punchcard_detail?id=' + item.id })
  },

  onCardTap(e) {
    var index = parseInt(e.currentTarget.dataset.index, 10)
    this._goDetail(this.data.items[index])
  },

  onBuyTap(e) {
    var index = parseInt(e.currentTarget.dataset.index, 10)
    this._goDetail(this.data.items[index])
  }
})
