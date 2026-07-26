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
    pageTitle: '',
    bizType: '',
    cardType: '',
    categoryCode: null,
    name: '',
    sale_price: '',
    punch_total: '',
    shop: '',
    on_shelves: true,
    careProjectCount: 0,   // 养护次卡专用：1=单项（修刃 或 热蜡）/ 2=双项（修刃 + 热打蜡）；0=未选
    imageId: 0,
    imageUrl: '',
    html: '',            // 简介（富文本）：顾客端首页取它的纯文本摘要、详情页整段渲染
    formats: {},
    rulesHtml: '',       // 使用规则（富文本）：顾客端详情页「使用规则」卡片；留空则显示默认规则
    rulesFormats: {},
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
        // wx.navigateTo 不会自动解码 query，新增入口拼 URL 时手动 encodeURIComponent 过，这里对应解码
        var bizType = options.bizType ? decodeURIComponent(options.bizType) : ''
        var cardType = options.cardType ? decodeURIComponent(options.cardType) : ''
        if (!bizType || !cardType) {
          wx.showToast({ title: '缺少业务类型/卡类型参数', icon: 'none' })
          wx.navigateBack()
          return
        }
        var title = '新增' + bizType + cardType
        that.setData({ bizType: bizType, cardType: cardType, dataLoaded: true, pageTitle: title })
        wx.setNavigationBarTitle({ title: title })
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
      // 用 availableImages（后端 [NotMapped] getter，只含 valid=1）；product.images 是全量，
      // 换过图的商品里躺着 valid=0 的旧行，取 [0] 会回填到已删除的那张
      var imgList = product.availableImages || product.images || []
      var img = imgList.length > 0 ? imgList[0] : null
      var html = product.content || ''
      var rulesHtml = product.usage_rules || ''
      that.setData({
        name: product.name || '',
        sale_price: product.sale_price != null ? String(product.sale_price) : '',
        punch_total: product.punch_total != null ? String(product.punch_total) : '',
        careProjectCount: product.care_project_count || 0,
        shop: product.shop || '',
        on_shelves: !!product.on_shelves,
        categoryCode: product.category_code,
        bizType: bizType,
        cardType: cardType,
        html: html,
        rulesHtml: rulesHtml,
        imageId: img ? img.id : 0,
        imageUrl: img ? img.imageUrl || img.image_url : '',
        dataLoaded: true,
        pageTitle: '编辑' + bizType + cardType
      })
      wx.setNavigationBarTitle({ title: '编辑' + bizType + cardType })
      // 两个 editor 的 ready 与拉数据是并发的：谁先到都得能把内容填进去，
      // 所以这里拿到数据补一次、ready 回调里再按 data 补一次
      if (that.editorCtx) {
        that.editorCtx.setContents({ html: html })
      }
      if (that.rulesEditorCtx) {
        that.rulesEditorCtx.setContents({ html: rulesHtml })
      }
    }).catch(function () {
      // 不 catch 的话 dataLoaded 永远是 false，页面就是一片空白、没有任何提示
      wx.showToast({ title: '商品加载失败', icon: 'none' })
      setTimeout(function () { wx.navigateBack() }, 800)
    })
  },

  onCancel() { wx.navigateBack() },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onPriceInput(e) { this.setData({ sale_price: e.detail.value }) },
  onPunchTotalInput(e) { this.setData({ punch_total: e.detail.value }) },
  onShopInput(e) { this.setData({ shop: e.detail.value }) },
  onToggleOnShelves() { this.setData({ on_shelves: !this.data.on_shelves }) },
  onProjectCountTap(e) { this.setData({ careProjectCount: parseInt(e.currentTarget.dataset.v, 10) }) },

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

  onRulesReady() {
    var that = this
    wx.createSelectorQuery().select('#editorRules').context(function (res) {
      that.rulesEditorCtx = res.context
      if (that.data.rulesHtml) {
        that.rulesEditorCtx.setContents({ html: that.data.rulesHtml })
      }
    }).exec()
  },
  onRulesInput(e) {
    this.setData({ rulesHtml: e.detail.html })
  },
  onRulesStatusChange(e) {
    this.setData({ rulesFormats: e.detail })
  },

  // 两个编辑器共用这一个工具条 handler：目标由工具条容器上的 data-target 决定
  // （data-name/data-value 在被点的按钮上 → e.target；data-target 在绑定事件的容器上 → e.currentTarget）
  format(e) {
    var name = e.target.dataset.name
    var value = e.target.dataset.value
    if (!name) { return }
    var ctx = e.currentTarget.dataset.target == 'rules' ? this.rulesEditorCtx : this.editorCtx
    if (!ctx) { return }
    ctx.format(name, value)
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
    // 养护次卡必须指明单项/双项：它决定开单选中这张卡时自动带出哪些养护服务项，缺了核销就推不出默认项
    var careProjectCount = null
    if (that.data.bizType == '养护' && that.data.cardType == '次卡') {
      careProjectCount = that.data.careProjectCount
      if (careProjectCount != 1 && careProjectCount != 2) {
        wx.showToast({ title: '请选择养护项目（单项/双项）', icon: 'none' })
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
      care_project_count: careProjectCount,
      content: that.data.html || '',
      usage_rules: that.data.rulesHtml || '',
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
