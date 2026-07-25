// pages/admin/rent/punchcard_products/punchcard_product_detail/punchcard_product_detail.js
// 次卡/季卡商品维护·详情页（店长/管理员 title_level≥200）：id=0 新建、id>0 编辑。
// 业务类型/卡类型在新建时由列表页通过 query 传入，创建后不可改（category_code 与该组合绑定，
// 改组合等于换分类，容易造成商品脱离原分类，本页不支持）。
// 图片：单图，复用 components/uploader/multi-uploader（image_count=1）。
// 简介：复用原生 <editor> 富文本组件（用法照抄 pages/admin/rent/settings/rent_product.js）。
var app = getApp()
var data = require('../../../../../utils/data.js')

Page({
  data: {
    id: 0,
    isNew: true,
    dataLoaded: false,
    bizType: '',
    cardType: '',
    categoryCode: null,
    name: '',
    sale_price: '',
    punch_total: '',
    shop: '',
    on_shelves: true,
    imageId: 0,
    imageUrl: '',
    html: '',
    formats: {},
    saving: false
  },

  onLoad(options) {
    var that = this
    var id = parseInt(options.id, 10) || 0
    that.setData({ id: id, isNew: id == 0 })
    app.loginPromiseNew.then(function () {
      var staff = app.globalData.staff
      if (!staff || staff.title_level < 200) {
        wx.showToast({ title: '没有权限', icon: 'none' })
        wx.navigateBack()
        return
      }
      if (id > 0) {
        that.loadForEdit(id)
      } else {
        var bizType = options.bizType
        var cardType = options.cardType
        if (!bizType || !cardType) {
          wx.showToast({ title: '缺少业务类型/卡类型参数', icon: 'none' })
          wx.navigateBack()
          return
        }
        that.setData({ bizType: bizType, cardType: cardType, dataLoaded: true })
        wx.setNavigationBarTitle({ title: '新增' + bizType + cardType })
        that.loadCategoryCode(bizType, cardType)
      }
    })
  },

  loadCategoryCode(bizType, cardType) {
    var that = this
    data.getPunchCardCategoryCodePromise(app.globalData.sessionKey, bizType, cardType).then(function (res) {
      that.setData({ categoryCode: (res && res.categoryCode) || null })
    })
  },

  loadForEdit(id) {
    var that = this
    data.getProductPromise(id, app.globalData.sessionKey).then(function (product) {
      var bizType = product.type && product.type.indexOf('养护') == 0 ? '养护' : '租赁'
      var cardType = product.type && product.type.indexOf('季卡') >= 0 ? '季卡' : '次卡'
      var img = (product.images && product.images.length > 0) ? product.images[0] : null
      var html = product.content || ''
      that.setData({
        name: product.name || '',
        sale_price: product.sale_price != null ? String(product.sale_price) : '',
        punch_total: product.punch_total != null ? String(product.punch_total) : '',
        shop: product.shop || '',
        on_shelves: !!product.on_shelves,
        categoryCode: product.category_code,
        bizType: bizType,
        cardType: cardType,
        html: html,
        imageId: img ? img.id : 0,
        imageUrl: img ? img.imageUrl || img.image_url : '',
        dataLoaded: true
      })
      wx.setNavigationBarTitle({ title: '编辑' + bizType + cardType })
      if (that.editorCtx) {
        that.editorCtx.setContents({ html: html })
      }
    })
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onPriceInput(e) { this.setData({ sale_price: e.detail.value }) },
  onPunchTotalInput(e) { this.setData({ punch_total: e.detail.value }) },
  onShopInput(e) { this.setData({ shop: e.detail.value }) },
  onToggleOnShelves() { this.setData({ on_shelves: !this.data.on_shelves }) },

  onImageUploaded(e) {
    var files = (e.detail && e.detail.files) || []
    this.setData({ imageUrl: files.length > 0 ? files[files.length - 1].url : '' })
  },

  onEditorReady() {
    var that = this
    wx.createSelectorQuery().select('#editor').context(function (res) {
      that.editorCtx = res.context
      if (that.data.html) {
        that.editorCtx.setContents({ html: that.data.html })
      }
    }).exec()
  },
  onEditorInput(e) {
    this.setData({ html: e.detail.html })
  },
  onEditorStatusChange(e) {
    this.setData({ formats: e.detail })
  },
  format(e) {
    var name = e.target.dataset.name
    var value = e.target.dataset.value
    if (!name || !this.editorCtx) { return }
    this.editorCtx.format(name, value)
  },

  onSave() {
    var that = this
    var name = (that.data.name || '').trim()
    var price = parseFloat(that.data.sale_price)
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    if (isNaN(price) || price <= 0) {
      wx.showToast({ title: '请输入有效价格', icon: 'none' })
      return
    }
    var punchTotal = null
    if (that.data.cardType == '次卡') {
      punchTotal = parseInt(that.data.punch_total, 10)
      if (isNaN(punchTotal) || punchTotal <= 0) {
        wx.showToast({ title: '请输入有效次数', icon: 'none' })
        return
      }
    }
    if (!that.data.categoryCode) {
      wx.showToast({ title: '分类未就绪，请稍后重试', icon: 'none' })
      return
    }
    var images = []
    if (that.data.imageUrl) {
      images.push({
        id: that.data.imageId || 0,
        product_id: that.data.id || 0,
        image_url: that.data.imageUrl,
        is_head: 1,
        sort: 0,
        valid: 1,
        title: '',
        content: ''
      })
    }
    var product = {
      id: that.data.id || 0,
      category_id: null,
      category_code: that.data.categoryCode,
      shop_id: null,
      name: name,
      sale_price: price,
      type: that.data.bizType + that.data.cardType,
      shop: (that.data.shop || '').trim() || null,
      hidden: 0,
      valid: 1,
      on_shelves: that.data.on_shelves ? 1 : 0,
      punch_total: punchTotal,
      content: that.data.html || '',
      images: images,
      properties: []
    }
    that.setData({ saving: true })
    var promise = that.data.id ? data.modPunchCardProductPromise(product, app.globalData.sessionKey)
      : data.addPunchCardProductPromise(product, app.globalData.sessionKey)
    promise.then(function () {
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(function () { wx.navigateBack() }, 400)
    }).catch(function () {
      that.setData({ saving: false })
    })
  }
})
