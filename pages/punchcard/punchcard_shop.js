// pages/punchcard/punchcard_shop.js
// 购买次卡·首页：以"公众号群发"风格的信息流展示可购买的次卡商品，每条一张横幅卡片 + 购买按钮。
// 已按要求去掉门店选择（纯线上自助购买，不需要先选店；商品本身的门店范围仍随条目展示）。
// 真实商品的权威识别方式是 category_code 命中 category 表 biz_type/name=="次卡" 那一行（详见
// RentController.ResolveNextCardCategoryCode）——本页按"租赁"/"养护"两个 biz_type 分别调用
// Rent/GetPunchCardProducts 取真实商品。MOCK_ITEMS 里的每一条都按同一条规则标了 bizType +
// 次数/isSeason，代表"这个 biz_type + 次数规格的卡将来上架后长这样"；哪个规格已经有真实商品了，
// 对应的 mock 条目就自动让位不再显示（见 _mocksWithoutRealSlot），不会和真实商品重复展示。
// 目前数据库里只有"租赁10次卡"，其余规格（租赁20次卡/养护10次卡/养护打蜡季卡）还没建对应商品，
// 继续用 mock 顶位——点这几款的"购买"会提示"即将上线"，不会真的下单（没有真实 product_id 可下单）。
var app = getApp()
var util = require('../../utils/util.js')
var data = require('../../utils/data.js')

var BIZ_TYPES = ['租赁', '养护']

var MOCK_ITEMS = [
  {
    _key: 'mock-rent20', mock: true, bizType: '租赁', theme: 'rent-deep',
    name: '租赁20次卡', punch_total: 20, sale_price: 580,
    desc: '双板/单板 + 雪鞋租赁次卡，20 次任选门店核销，更划算'
  },
  {
    _key: 'mock-care10', mock: true, bizType: '养护', theme: 'care',
    name: '养护10次卡', punch_total: 10, sale_price: 299,
    desc: '装备打蜡/护理次卡，10 次任选门店核销'
  },
  {
    _key: 'mock-care-season', mock: true, bizType: '养护', theme: 'care-season',
    name: '打蜡季卡', isSeason: true, sale_price: 999,
    desc: '整个雪季不限次数打蜡服务，装备常打常新'
  }
]

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
    // 按 biz_type 分别取（租赁/养护是两条独立的 category 规则，互不影响），再按规则合并展示
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
      var mocks = that._mocksWithoutRealSlot(realItems)
      that.setData({ items: that._formatItems(realItems.concat(mocks)), loading: false })
    }).catch(function () {
      that.setData({ items: that._formatItems(MOCK_ITEMS.slice()), loading: false })
    })
  },

  _buildRealItem(p, bizType) {
    return {
      _key: 'real-' + p.id,
      mock: false,
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

  // mock 条目代表的是"biz_type + 次数（或季卡）"这个规格位——一旦真实商品按 category_code 规则
  // 建好并命中同一个规格位，就该让真实数据顶替，不再重复展示 mock
  _mocksWithoutRealSlot(realItems) {
    var realSlots = {}
    for (var i = 0; i < realItems.length; i++) {
      realSlots[this._slotKey(realItems[i])] = true
    }
    var out = []
    for (var j = 0; j < MOCK_ITEMS.length; j++) {
      if (!realSlots[this._slotKey(MOCK_ITEMS[j])]) out.push(MOCK_ITEMS[j])
    }
    return out
  },

  _slotKey(item) {
    return item.bizType + '|' + (item.isSeason ? 'season' : item.punch_total)
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
    if (item.mock) {
      wx.showToast({ title: '即将上线，敬请期待', icon: 'none' })
      return
    }
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
