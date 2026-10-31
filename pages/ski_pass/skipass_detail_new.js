// pages/ski_pass/skipass_detail_new.js
// 雪票详情页：首页选好「时长 + 场次」这一组，这里选装备和日期（带价格的月历，没价格的日期点不了）。
// 顾客只能看价格；游客信息和「加入购物车」只给店员，结算在购物车页，后端也只认店员。
const app = getApp()
const data = require('../../utils/data.js')
const util = require('../../utils/util.js')
const skipassGroup = require('../../utils/skipass_group.js')
const skipassCalendar = require('../../utils/skipass_calendar.js')
const cartUtil = require('../../utils/skipass_cart.js')
const { getNavMetrics } = require('../../utils/navbar.js')

const WEEK_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch (e) {
    return value
  }
}

Page({

  data: {
    // 导航栏总高度（状态栏 + 导航栏），主内容区据此留出上边距；onLoad 里按机型取实际值
    navTotalHeight: 64,
    resort: '万龙',
    loading: true,
    isStaff: false,
    hasPrice: false,
    groupTitle: '',
    gearOptions: [],
    productId: 0,
    productName: '',
    productImage: '',
    weekLabels: skipassCalendar.WEEK_LABELS,
    months: [],
    selectedDate: '',
    selectedDateText: '',
    priceStr: '',
    // 购票数量固定 1 张
    count: 1,
    summary: 0,
    summaryStr: '',
    // 游客信息（店员填）
    name: '',
    cell: '',
    nameFocused: false,
    phoneFocused: false,
    // 当前商品所属自我游账号；预存款够不够由后端在购物车结算时核对
    source: '',
    // 能不能加入购物车 = 店员 + 这一天有价格 + 这个装备已上线
    canAdd: false,
    cartCount: 0
  },

  _now() {
    return new Date()
  },

  // 从购物车页回来时刷新右下角张数
  onShow() {
    this.setData({ cartCount: cartUtil.ticketCount(cartUtil.load()) })
  },

  onLoad(options) {
    var that = this
    options = options || {}
    that._options = options
    var resort = options.resort ? safeDecode(options.resort) : ''
    that.setData({
      navTotalHeight: getNavMetrics().totalHeight,
      resort: resort && resort != 'undefined' ? resort : '万龙',
      memberId: options.memberId,
      staffId: options.staffId
    })
    app.loginPromiseNew.then(function () {
      var isStaff = !!app.globalData.staff
      that.setData({ isStaff })
      if (isStaff) {
        that.GetRealName()
      }
      that.loadProducts()
    })
  },

  // ========================
  // 取这个雪场全部商品，按首页同一套规则分组，打开链接指定的那一组
  // ========================
  loadProducts() {
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetProductsByResort?showHidden=0&resort='
      + encodeURIComponent(that.data.resort) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey || '')
    wx.request({
      url: getUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200 || !Array.isArray(res.data)) {
          that.showNoPrice()
          return
        }
        var groups = skipassGroup.buildGroups(res.data, that._now())
        var group = null
        var options = that._options
        if (options.group) {
          group = skipassGroup.findGroup(groups, safeDecode(options.group))
        } else if (options.id) {
          // 旧链接只带商品 id：找它所在的分组，并选中它
          group = skipassGroup.findGroupByProductId(groups, options.id)
        }
        if (!group) {
          that.showNoPrice()
          return
        }
        that.applyGroup(group, options.id)
      },
      fail: () => {
        that.showNoPrice()
      }
    })
  },

  showNoPrice() {
    this._group = null
    this._product = null
    this.setData({ loading: false, hasPrice: false, months: [], gearOptions: [], priceStr: '', summary: 0, summaryStr: util.showAmount(0) })
    this._refreshAdd()
  },

  applyGroup(group, preferProductId) {
    var that = this
    that._group = group
    // 暂未上线的装备（含雪具）不作为默认选中；整组都没上线的才退回第一个，下单会被挡住
    var selectable = group.products.filter(function (p) { return !p.comingSoon })
    var candidates = selectable.length ? selectable : group.products
    var product = candidates.find(function (p) { return String(p.id) === String(preferProductId) }) || candidates[0]
    that.setData({
      loading: false,
      hasPrice: true,
      groupTitle: group.title,
      gearOptions: group.products.map(function (p) { return { id: p.id, label: p.gearLabel, minPriceStr: p.minPriceStr, disabled: !!p.comingSoon } })
    })
    wx.setNavigationBarTitle({ title: that.data.resort + ' ' + group.title })
    that.selectProduct(product.id, '')
  },

  // 选中某个装备（商品）：原来选的日期在新商品上还有价格就保留，否则落到它的第一个有价日期
  selectProduct(productId, keepDate) {
    var that = this
    var product = that._group.products.find(function (p) { return String(p.id) === String(productId) })
    if (!product) return
    that._product = product
    var dates = product.prices.map(function (p) { return p.date })
    var date = dates.indexOf(keepDate) >= 0 ? keepDate : dates[0]
    var productImage = 'https://mini.snowmeet.top/images/' + (product.session == '日场' ? 'skipass_day.png' : 'skipass_eve.png')
    var source = product.source || ''
    that.setData({ productId: product.id, productName: product.name, productImage, source })
    that.setDate(date)
  },

  setDate(date) {
    var that = this
    var product = that._product
    var hit = product.prices.find(function (p) { return p.date === date })
    if (!hit) return
    var d = new Date(parseInt(date.slice(0, 4), 10), parseInt(date.slice(5, 7), 10) - 1, parseInt(date.slice(8, 10), 10))
    var summary = hit.price * that.data.count
    that.setData({
      selectedDate: date,
      selectedDateText: (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK_DAYS[d.getDay()],
      priceStr: skipassGroup.fmtPrice(hit.price),
      summary,
      summaryStr: util.showAmount(summary),
      months: skipassCalendar.buildMonths(product.prices, date)
    })
    that._refreshAdd()
  },

  onSelectGear(e) {
    var that = this
    var target = that._group && that._group.products.find(function (p) { return String(p.id) === String(e.currentTarget.dataset.id) })
    if (target && target.comingSoon) {
      wx.showToast({ title: skipassGroup.COMING_SOON_TEXT, icon: 'none' })
      return
    }
    that.selectProduct(e.currentTarget.dataset.id, that.data.selectedDate)
  },

  onSelectDay(e) {
    var that = this
    var date = e.currentTarget.dataset.date
    if (!that._product || !that._product.prices.some(function (p) { return p.date === date })) {
      return
    }
    that.setDate(date)
  },

  _refreshAdd() {
    var d = this.data
    var comingSoon = !!(this._product && this._product.comingSoon)
    this.setData({ canAdd: !!(d.isStaff && d.hasPrice && !comingSoon && d.summary > 0) })
  },

  // ========================
  // 游客信息输入
  // ========================
  onNameInput(e) {
    this.data.name = e.detail.value
  },

  onPhoneInput(e) {
    this.data.cell = e.detail.value
  },

  GetRealName() {
    var that = this
    data.getMyInfo(app.globalData.sessionKey).then(function (info) {
      info = info || {}
      that.setData({ name: info.real_name || '', cell: info.cell || '' })
    })
  },

  getCell(e) {
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateWechatMemberCell?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&encData=' + encodeURIComponent(e.detail.encryptedData) + '&iv=' + encodeURIComponent(e.detail.iv)
    wx.request({
      url: url,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          return
        }
        var member = res.data
        that.setData({ cell: member.currentCell })
      }
    })
  },

  // ========================
  // 加入购物车（仅店员）：票种 + 游玩日期 + 接收短信的手机号；相同的合并成一条，结算在购物车页
  // ========================
  onAddToCart() {
    var that = this
    if (!that.data.isStaff) {
      wx.showToast({ title: '仅限店员订票', icon: 'none' })
      return
    }
    if (!that.data.canAdd) {
      wx.showToast({ title: that.data.hasPrice ? '该装备暂不能订票' : '该日期暂无价格', icon: 'none' })
      return
    }
    var name = (that.data.name || '').trim()
    var cell = (that.data.cell || '').trim()
    if (!name) {
      wx.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(cell)) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' })
      return
    }
    var hit = that._product.prices.find(function (p) { return p.date === that.data.selectedDate })
    if (!hit) {
      wx.showToast({ title: '该日期暂无价格', icon: 'none' })
      return
    }
    var result = cartUtil.addItem(cartUtil.load(), {
      productId: that.data.productId,
      title: that.data.productName,
      date: that.data.selectedDate,
      cell: cell,
      name: name,
      price: hit.price,
      source: that.data.source,
      resort: that.data.resort,
      staffId: that.data.staffId
    }, 1)
    if (result.error) {
      wx.showToast({ title: result.error, icon: 'none' })
      return
    }
    cartUtil.save(result.cart)
    that.setData({ cartCount: cartUtil.ticketCount(result.cart) })
    wx.showToast({ title: '已加入购物车', icon: 'success' })
  },

  onOpenCart() {
    wx.navigateTo({ url: '/pages/ski_pass/skipass_cart' })
  }
})
