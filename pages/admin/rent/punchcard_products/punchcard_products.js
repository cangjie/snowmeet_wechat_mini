// pages/admin/rent/punchcard_products/punchcard_products.js
// 次卡商品管理（店长/管理员 title_level≥200）：管理 Product.type=="租赁次卡" 的行——
// 名称/价格/次数/上下架/店铺。列表用专用只读接口 Rent/GetAllPunchCardProducts；
// 新增/编辑复用通用商品目录现成的 Category/AddProduct、Category/ModProduct（不新造后端）。
var app = getApp()
var util = require('../../../../utils/util.js')
var data = require('../../../../utils/data.js')

Page({
  data: {
    products: [],
    modal: { show: false, id: 0, name: '', sale_price: '', punch_total: '', shop: '', on_shelves: true }
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
    })
  },

  onAdd() {
    this.setData({ modal: { show: true, id: 0, name: '', sale_price: '', punch_total: '', shop: '', on_shelves: true } })
  },

  onEdit(e) {
    var id = parseInt(e.currentTarget.dataset.id, 10)
    var p = null
    for (var i = 0; i < this.data.products.length; i++) { if (this.data.products[i].id == id) { p = this.data.products[i]; break } }
    if (!p) return
    this.setData({
      modal: {
        show: true, id: p.id, name: p.name, sale_price: String(p.sale_price),
        punch_total: String(p.punch_total), shop: p.shop || '', on_shelves: !!p.on_shelves
      }
    })
  },

  onModalCancel() {
    this.setData({ 'modal.show': false })
  },

  onNameInput(e) { this.setData({ 'modal.name': e.detail.value }) },
  onPriceInput(e) { this.setData({ 'modal.sale_price': e.detail.value }) },
  onPunchTotalInput(e) { this.setData({ 'modal.punch_total': e.detail.value }) },
  onShopInput(e) { this.setData({ 'modal.shop': e.detail.value }) },
  onToggleOnShelves() { this.setData({ 'modal.on_shelves': !this.data.modal.on_shelves }) },

  onModalConfirm() {
    var that = this
    var m = that.data.modal
    var name = (m.name || '').trim()
    var price = parseFloat(m.sale_price)
    var punchTotal = parseInt(m.punch_total, 10)
    if (!name) { wx.showToast({ title: '请输入名称', icon: 'none' }); return }
    if (isNaN(price) || price <= 0) { wx.showToast({ title: '请输入有效价格', icon: 'none' }); return }
    if (isNaN(punchTotal) || punchTotal <= 0) { wx.showToast({ title: '请输入有效次数', icon: 'none' }); return }
    var product = {
      id: m.id || 0,
      category_id: null,
      shop_id: null,
      name: name,
      sale_price: price,
      type: '租赁次卡',
      shop: (m.shop || '').trim() || null,
      hidden: 0,
      valid: 1,
      on_shelves: m.on_shelves ? 1 : 0,
      punch_total: punchTotal
    }
    var promise = m.id ? data.modPunchCardProductPromise(product, app.globalData.sessionKey)
      : data.addPunchCardProductPromise(product, app.globalData.sessionKey)
    promise.then(function () {
      wx.showToast({ title: '保存成功', icon: 'success' })
      that.setData({ 'modal.show': false })
      that.getData()
    })
  }
})
