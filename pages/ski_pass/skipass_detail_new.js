// pages/ski_pass/skipass_detail_new.js
// 雪票详情页：首页选好「时长 + 场次」这一组，这里选装备和日期（带价格的月历，没价格的日期点不了）。
// 顾客只能看价格；游客信息和支付栏只给店员，后端 ReserveSkiPass 也只认店员。
const app = getApp()
const data = require('../../utils/data.js')
const util = require('../../utils/util.js')
const skipassGroup = require('../../utils/skipass_group.js')
const skipassCalendar = require('../../utils/skipass_calendar.js')
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
    // 当前商品所属自我游账号的预存款是否够这一单（两个账号各有各的预存款）
    source: '',
    balance: NaN,
    canPay: false,
    paying: false
  },

  _now() {
    return new Date()
  },

  onLoad(options) {
    var that = this
    options = options || {}
    that._options = options
    that._balances = {}
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
    this._refreshPay()
  },

  applyGroup(group, preferProductId) {
    var that = this
    that._group = group
    var product = group.products.find(function (p) { return String(p.id) === String(preferProductId) }) || group.products[0]
    that.setData({
      loading: false,
      hasPrice: true,
      groupTitle: group.title,
      gearOptions: group.products.map(function (p) { return { id: p.id, label: p.gearLabel, minPriceStr: p.minPriceStr } })
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
    var cached = that._balances[source]
    that.setData({
      productId: product.id, productName: product.name, productImage, source,
      balance: cached === undefined ? NaN : cached
    })
    that.setDate(date)
    if (that.data.isStaff && cached === undefined) {
      that.getBalance(source)
    }
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
    that._refreshPay()
  },

  onSelectGear(e) {
    var that = this
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

  // 能支付 = 店员 + 这一天有价格 + 自我游预存款够这一单（预存款不够，付了款也出不了票）
  _refreshPay() {
    var d = this.data
    var canPay = !!(d.isStaff && d.hasPrice && d.summary > 0 && isFinite(d.balance) && d.summary < d.balance)
    this.setData({ canPay })
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
  // 确认支付（仅店员）
  // ========================
  onPay() {
    var that = this
    if (!that.data.isStaff) {
      wx.showToast({ title: '仅限店员订票', icon: 'none' })
      return
    }
    if (that.data.paying) return
    if (!that.data.canPay) {
      wx.showToast({ title: that.data.hasPrice ? '暂时不能出票，请联系管理员' : '该日期暂无价格', icon: 'none' })
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
    wx.showModal({
      title: '确认订单',
      content: '日期：' + that.data.selectedDate + '\n数量：' + that.data.count + ' 张\n总价：' + that.data.summaryStr
        + '\n\n姓名：' + name + '\n取票手机号：' + cell,
      confirmText: '去支付',
      success: (res) => {
        if (res.confirm) {
          that._requestPayment(name, cell)
        }
      }
    })
  },

  // ========================
  // 下单并发起微信支付（对接实际后端）
  // ========================
  _requestPayment(name, cell) {
    var that = this
    var idNo = that.data.idNo ? that.data.idNo : ''
    wx.showLoading({ title: '正在下单...' })
    that.setData({ paying: true })
    var fail = function (msg) {
      wx.hideLoading()
      that.setData({ paying: false })
      wx.showToast({ title: msg || '下单失败，请稍后重试', icon: 'none' })
    }
    var submitUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/ReserveSkiPass/' + that.data.productId
      + '?date=' + that.data.selectedDate + '&count=' + that.data.count + '&cell=' + cell
      + '&name=' + encodeURIComponent(name) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      + '&sessionType=' + encodeURIComponent('wechat_mini_openid') + '&idNo=' + idNo
      + (that.data.memberId ? '&refereeMemberId=' + that.data.memberId : '')
      + (that.data.staffId ? '&staffId=' + that.data.staffId : '')
    wx.request({
      url: submitUrl,
      method: 'GET',
      success: (res) => {
        if (res.statusCode != 200) {
          fail(typeof res.data === 'string' ? res.data : '')
          return
        }
        var order = res.data
        var paymentId = order.payments[0].id
        var payUrl = app.globalData.requestPrefix + 'Order/WechatPayByOrderPayment/' + paymentId + '?sessionKey=' + app.globalData.sessionKey
        wx.request({
          url: payUrl,
          method: 'GET',
          success: (res) => {
            wx.hideLoading()
            wx.requestPayment({
              nonceStr: res.data.data.nonce,
              package: 'prepay_id=' + res.data.data.prepay_id,
              paySign: res.data.data.sign,
              timeStamp: res.data.data.timestamp,
              signType: 'MD5',
              success: () => {
                wx.showToast({
                  title: '支付成功。',
                  icon: 'success',
                  complete: () => {
                    wx.redirectTo({
                      url: '../mine/skipass/my_skipass',
                    })
                  }
                })
              },
              fail: () => {
                that.setData({ paying: false })
                wx.showToast({ title: '支付已取消', icon: 'none' })
              }
            })
          },
          fail: () => { fail('') }
        })
      },
      fail: () => { fail('') }
    })
  },

  // 自我游预存款余额（只给店员，接口也只认店员会话）。按商品所属账号查，查到的余额缓存起来，切换装备不重复查
  getBalance(source) {
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/WanlongZiwoyouHelper/GetBalance?sessionKey='
      + encodeURIComponent(app.globalData.sessionKey || '') + '&source=' + encodeURIComponent(source || '')
    var done = function (balance) {
      if (isFinite(balance)) {
        that._balances[source] = balance
      }
      // 用户这时可能已经切到别的账号的商品，只更新还停在这个账号上的页面
      if (that.data.source === source) {
        that.setData({ balance })
        that._refreshPay()
      }
    }
    wx.request({
      url: getUrl,
      method: 'GET',
      success: (res) => {
        done(res.statusCode == 200 ? parseFloat(res.data) : NaN)
      },
      fail: () => {
        done(NaN)
      }
    })
  }
})
