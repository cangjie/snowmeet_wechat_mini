// pages/punchcard/punchcard_shop.js
// 购买次卡·首页：以"公众号群发"风格的信息流展示可购买的次卡商品，每条一张横幅卡片 + 购买按钮。
// 已按要求去掉门店选择（纯线上自助购买，不需要先选店；商品本身的门店范围仍随条目展示）。
// 真实数据目前只有"租赁10次卡"这一款（来自 Rent/GetPunchCardProducts）；其余三款
// （租赁20次卡/养护10次卡/养护打蜡季卡）数据库里还没有对应商品，先用本地 mock 数据把视觉
// 效果跑出来——点这三款的"购买"会提示"即将上线"，不会真的下单（没有真实 product_id 可下单）。
var app = getApp()
var util = require('../../utils/util.js')
var data = require('../../utils/data.js')

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
    data.getPunchCardProductsPromise(null, app.globalData.sessionKey).then(function (products) {
      products = products || []
      var realItems = []
      for (var i = 0; i < products.length; i++) {
        var p = products[i]
        realItems.push({
          _key: 'real-' + p.id,
          mock: false,
          id: p.id,
          bizType: '租赁',
          theme: 'rent',
          name: p.name,
          punch_total: p.punch_total,
          sale_price: p.sale_price,
          shop: p.shop,
          desc: '双板/单板 + 雪鞋租赁次卡，' + p.punch_total + ' 次任选门店核销'
        })
      }
      that.setData({ items: that._formatItems(realItems.concat(MOCK_ITEMS)), loading: false })
    }).catch(function () {
      that.setData({ items: that._formatItems(MOCK_ITEMS.slice()), loading: false })
    })
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
