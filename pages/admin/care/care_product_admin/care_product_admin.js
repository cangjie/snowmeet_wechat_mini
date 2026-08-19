// pages/admin/care/care_product_admin/care_product_admin.js
// 养护价格维护（管理后台 staff≥300，系统管理员）
//
// 维护 product.category_id = 14 这批商品——它们就是养护定价的价目表：
// 开单时按「门店 + 服务组合」从里面取 sale_price（后端 CarePricingRules）。
// 改这里的价 = 改线上收费，门槛比优惠券模板设置（200）还高一档。
//
// 商品总共十几个，不分页；门店用 chip 单选，已停用的后端不下发。
var app = getApp()
var data = require('../../../../utils/data.js')

// 与后端 CarePricingRules 同一套：名字对不上这四个，开单时取不到价、服务费会静默变 0
var PRICING_NAMES = ['双项', '单项', '双项加急', '单项加急']

Page({
  data: {
    shops: [],                 // [{id,name}]，第 0 项是「全部」，id 为 null
    shopId: null,              // null = 全部门店

    items: [],
    unrecognizedCount: 0,
    loading: false,

    // 编辑弹层
    editShow: false,
    editId: 0,
    editName: '',
    editShopIndex: 0,          // 指向 editShops
    editShops: [],             // 不含「全部门店」
    editShopNames: [],
    editPrice: '',
    editHidden: 0,
    editSort: 100,
    nameTips: PRICING_NAMES,
    saving: false
  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      var staff = app.globalData.staff
      if (!staff || staff.title_level < 300) {
        wx.showToast({ title: '没有权限', icon: 'none' })
        wx.navigateBack()
        return
      }
      if (!that.data.shops.length) {
        that.loadShops(function () { that.getData() })
      } else {
        that.getData()
      }
    })
  },

  loadShops(done) {
    var that = this
    data.getShopListPromise().then(function (list) {
      list = list || []
      that.setData({
        shops: [{ id: null, name: '全部' }].concat(list),
        editShops: list,
        editShopNames: list.map(function (s) { return s.name })
      })
      if (done) { done() }
    }).catch(function () { if (done) { done() } })
  },

  getData() {
    var that = this
    that.setData({ loading: true })
    data.getCareProductsPromise(that.data.shopId, app.globalData.sessionKey)
      .then(function (res) {
        var items = (res && res.items) || []
        // WXML 不支持方法调用，展示文案一律在这里派生
        items = items.map(function (it) {
          return Object.assign({}, it, {
            priceText: '¥' + it.salePrice,
            ruleText: it.ruleCount > 0 ? ('被 ' + it.ruleCount + ' 条券规则引用') : ''
          })
        })
        that.setData({
          items: items,
          unrecognizedCount: items.filter(function (x) {
            return x.valid === 1 && x.hidden === 0 && !x.pricingRecognized
          }).length,
          loading: false
        })
      }).catch(function () { that.setData({ loading: false }) })
  },

  // 门店 chip 单选。dataset 取不到 null，用空串代表「全部」
  onShopTap(e) {
    var id = e.currentTarget.dataset.id
    id = (id === '' || id === undefined) ? null : Number(id)
    if (id === this.data.shopId) { return }
    this.setData({ shopId: id })
    this.getData()
  },

  // ── 编辑 ──────────────────────────────────────────────────────

  onAddTap() {
    if (!this.data.editShops.length) { return }
    // 列表正筛着某个店时，新建默认就是那个店，省一次选择
    var idx = 0
    if (this.data.shopId) {
      for (var i = 0; i < this.data.editShops.length; i++) {
        if (this.data.editShops[i].id === this.data.shopId) { idx = i; break }
      }
    }
    this.setData({
      editShow: true, editId: 0, editName: '', editShopIndex: idx,
      editPrice: '', editHidden: 0, editSort: 100
    })
  },

  onItemTap(e) {
    var it = this.data.items[Number(e.currentTarget.dataset.idx)]
    if (!it) { return }
    var idx = 0
    for (var i = 0; i < this.data.editShops.length; i++) {
      if (this.data.editShops[i].id === it.shopId) { idx = i; break }
    }
    this.setData({
      editShow: true, editId: it.id, editName: it.name, editShopIndex: idx,
      editPrice: String(it.salePrice), editHidden: it.hidden, editSort: it.sort
    })
  },

  onEditInput(e) {
    var patch = {}
    patch[e.currentTarget.dataset.field] = e.detail.value
    this.setData(patch)
  },

  onEditShopChange(e) {
    this.setData({ editShopIndex: parseInt(e.detail.value, 10) || 0 })
  },

  onEditHiddenChange(e) {
    this.setData({ editHidden: e.detail.value ? 1 : 0 })
  },

  onNameTipTap(e) {
    this.setData({ editName: e.currentTarget.dataset.name })
  },

  onEditClose() {
    this.setData({ editShow: false })
  },

  onNoop() {},

  onSave() {
    var that = this
    if (that.data.saving) { return }
    var price = parseFloat(that.data.editPrice)
    if (!that.data.editName.trim()) {
      wx.showToast({ title: '请填写商品名称', icon: 'none' })
      return
    }
    if (isNaN(price) || price < 0) {
      wx.showToast({ title: '请填写正确的价格', icon: 'none' })
      return
    }
    var shop = that.data.editShops[that.data.editShopIndex]
    if (!shop) {
      wx.showToast({ title: '请选择门店', icon: 'none' })
      return
    }
    that.setData({ saving: true })
    data.saveCareProductPromise({
      id: that.data.editId,
      name: that.data.editName.trim(),
      shopId: shop.id,
      salePrice: price,
      hidden: that.data.editHidden,
      sort: parseInt(that.data.editSort, 10) || 100
    }, app.globalData.sessionKey).then(function () {
      wx.showToast({ title: '已保存', icon: 'success' })
      that.setData({ editShow: false, saving: false })
      that.getData()
    }).catch(function () { that.setData({ saving: false }) })
  },

  onDelete() {
    var that = this
    if (that.data.editId <= 0) { return }
    wx.showModal({
      title: '停用这个商品',
      content: '停用后开单时不再用它计价。历史订单不受影响。',
      success: function (res) {
        if (!res.confirm) { return }
        data.deleteCareProductPromise(that.data.editId, app.globalData.sessionKey)
          .then(function () {
            that.setData({ editShow: false })
            that.getData()
          }).catch(function () {})
      }
    })
  }
})
