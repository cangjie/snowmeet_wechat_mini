// pages/admin/rent/punchcard_products/punchcard_products.js
// 次卡/季卡商品管理（店长/管理员 title_level≥200）：管理 养护/租赁 × 次卡/季卡 4 种组合下的商品行——
// 名称/价格/图片/简介/次数（季卡不需要次数）/上下架/店铺。列表用 Rent/GetAllPunchCardProducts（不传
// bizType/cardType 时一次拿全部 4 组合）；新增/编辑跳转到详情维护页 punchcard_product_detail，
// 那边负责图片上传 + 富文本简介编辑，弹窗表单装不下这些，本页只保留列表 + 筛选 + 跳转入口。
var app = getApp()
var data = require('../../../../utils/data.js')

var BIZ_TYPES = ['养护', '租赁']
var CARD_TYPES = ['次卡', '季卡']
var ADD_COMBOS = []
BIZ_TYPES.forEach(function (bizType) {
  CARD_TYPES.forEach(function (cardType) {
    ADD_COMBOS.push({ bizType: bizType, cardType: cardType, label: '+ ' + bizType + cardType })
  })
})

Page({
  data: {
    products: [],
    filteredProducts: [],
    filterBizType: '',
    filterCardType: '',
    bizTypes: BIZ_TYPES,
    cardTypes: CARD_TYPES,
    addCombos: ADD_COMBOS
  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      var staff = app.globalData.staff
      if (!staff || staff.title_level < 200) {
        wx.showToast({ title: '没有权限', icon: 'none' })
        wx.navigateBack()
        return
      }
      that.getData()
    })
  },

  getData() {
    var that = this
    data.getAllPunchCardProductsPromise(app.globalData.sessionKey).then(function (products) {
      that.setData({ products: products || [] })
      that.applyFilter()
    })
  },

  applyFilter() {
    var that = this
    var bizType = that.data.filterBizType
    var cardType = that.data.filterCardType
    var filtered = that.data.products.filter(function (p) {
      if (bizType && p.bizType != bizType) { return false }
      if (cardType && p.cardType != cardType) { return false }
      return true
    }).map(function (p) {
      var countText = p.cardType == '次卡' ? ((p.punch_total || 0) + ' 次') : '不限次数'
      // 养护次卡的单项/双项直接列在副行，不用点进详情才看得到
      var projectText = ''
      if (p.bizType == '养护' && p.cardType == '次卡') {
        projectText = p.care_project_count == 2 ? '双项' : (p.care_project_count == 1 ? '单项' : '项目未设')
      }
      return Object.assign({}, p, { countText: countText, projectText: projectText })
    })
    that.setData({ filteredProducts: filtered })
  },

  onFilterBizType(e) {
    var value = e.currentTarget.dataset.value
    var that = this
    that.setData({ filterBizType: that.data.filterBizType == value ? '' : value })
    that.applyFilter()
  },

  onFilterCardType(e) {
    var value = e.currentTarget.dataset.value
    var that = this
    that.setData({ filterCardType: that.data.filterCardType == value ? '' : value })
    that.applyFilter()
  },

  onAdd(e) {
    var bizType = e.currentTarget.dataset.biztype
    var cardType = e.currentTarget.dataset.cardtype
    var that = this
    // 把筛选切到正在新增的这个组合：否则筛选停在别的组合时（比如停在「租赁+季卡」却去加养护次卡），
    // 加完返回列表会被筛选挡住显示「暂无商品」，看起来就像根本没添加成功
    that.setData({ filterBizType: bizType, filterCardType: cardType })
    that.applyFilter()
    wx.navigateTo({
      url: 'punchcard_product_detail/punchcard_product_detail?id=0&bizType=' + encodeURIComponent(bizType)
        + '&cardType=' + encodeURIComponent(cardType)
    })
  },

  onEdit(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: 'punchcard_product_detail/punchcard_product_detail?id=' + id
    })
  }
})
