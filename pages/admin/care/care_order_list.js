// pages/admin/care/care_order_list.js
// 养护订单列表（Alpine 风格，仿租赁订单列表 new_rent_list）
// 查询条件与旧版保持一致：店铺 / 日期 / 测试 / 招待 / 减免 / 非雪季 / 次卡 / 手机 / 备注
// 分页复用通用后端接口 Order/GetOrdersByStaffPaged（getRentOrdersByStaffPagedPromise，type='养护'）+ list-pager 组件
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')

const IMG_HOST = 'https://snowmeet.wanlonghuaxue.com'

Page({

  data: {
    queryOptions: [
      { key: 'isTest', value: false },
      { key: 'isEntertain', value: false },
      { key: 'haveDiscount', value: null },
      { key: 'summer', value: null },
      { key: 'useCard', value: null }
    ],
    cell: null,
    keyword: null,
    orders: [],       // 当前页数据
    total: 0,         // 服务器返回的总条数
    page: 1,
    pageSize: 50,
    totalPages: 0,
    totalEarnStr: '',
    querying: false
  },

  onLoad(options) {
    var nowDate = new Date()
    this.setData({ startDate: util.formatDate(nowDate), endDate: util.formatDate(nowDate) })
  },

  // 返回列表时（从订单详情返回触发 onShow）：保留当前页码/每页条数/筛选，用这些参数重查，不重置回第 1 页。
  // 页面实例 navigateTo 期间不销毁，page/pageSize/queryOptions 都还在 this.data 里。首次进入 page=1/pageSize=50 自然等同初始查询。
  onShow() {
    var that = this
    app.loginPromiseNew.then(function () {
      that.setData({ staff: app.globalData.staff, querying: true })
      that.getData(that.data.page, that.data.pageSize)
    })
  },

  shopSelected(e) {
    this.setData({ shop: e.detail.shop })
  },

  onDateRangeChange(e) {
    this.setData({ startDate: e.detail.startDate, endDate: e.detail.endDate })
  },

  setQueryOptions(e) {
    this.setQueryOptionValue(e.currentTarget.id, e.detail.value)
  },

  setQueryOptionValue(key, value) {
    var queryOptions = this.data.queryOptions
    for (var i = 0; i < queryOptions.length; i++) {
      if (queryOptions[i].key === key) {
        switch (value) {
          case 'null':  queryOptions[i].value = null;  break
          case 'true':  queryOptions[i].value = true;  break
          case 'false': queryOptions[i].value = false; break
          default:      queryOptions[i].value = value; break
        }
      }
    }
    this.setData({ queryOptions })
  },

  _buildQueryParams() {
    var isTest = null, isEntertain = null, haveDiscount = null, isSummerCare = null, useCard = null
    var queryOptions = this.data.queryOptions
    for (var i = 0; i < queryOptions.length; i++) {
      switch (queryOptions[i].key) {
        case 'isTest':       isTest       = queryOptions[i].value; break
        case 'isEntertain':  isEntertain  = queryOptions[i].value; break
        case 'haveDiscount': haveDiscount = queryOptions[i].value; break
        case 'summer':       isSummerCare = queryOptions[i].value; break
        case 'useCard':      useCard      = queryOptions[i].value; break
      }
    }
    var shop = this.data.shop
    var startDate = this.data.startDate
    var endDate = this.data.endDate
    var cell = this.data.cell
    var keyword = this.data.keyword
    // 手机 / 备注搜索时放宽到全时段、全店铺、忽略其它筛选（与旧版一致）
    if ((cell != null && cell != '') || (keyword != null && keyword != '')) {
      startDate = new Date('2025-10-15')
      endDate = new Date()
      shop = null
      isTest = null
      isEntertain = null
      haveDiscount = null
      isSummerCare = null
      useCard = null
    }
    return { shop, startDate, endDate, cell, keyword, isTest, isEntertain, haveDiscount, isSummerCare, useCard }
  },

  getData(page, pageSize) {
    var that = this
    page = page || that.data.page
    pageSize = pageSize || that.data.pageSize
    var p = that._buildQueryParams()
    data.getRentOrdersByStaffPagedPromise(
      null, p.shop, null, null, '养护', p.startDate, p.endDate,
      null, p.isTest, p.isEntertain, null, null, p.haveDiscount, null,
      app.globalData.sessionKey, p.cell, null, null, p.keyword, p.isSummerCare,
      null, null, p.useCard, null,
      page, pageSize
    ).then(function (result) {
      that.renderOrders(result.items || [], result.total || 0, page, pageSize)
      that.setData({ querying: false })
    }).catch(function (exp) {
      console.log('error', exp)
      that.setData({ querying: false })
    })
  },

  query() {
    this.setData({ querying: true })
    this.getData(1)
  },

  _statusClass(s) {
    var map = { '正常订单': 'normal', '临时订单': 'temp' }
    return map[s] || 'unknown'
  },

  renderOrders(orders, total, page, pageSize) {
    var totalEarn = 0
    for (var i = 0; orders && i < orders.length; i++) {
      var order = orders[i]
      var bizDate = new Date(order.biz_date)
      order.dateStr = util.formatDate(bizDate)
      order.timeStr = util.formatTimeStr(bizDate)
      // 状态（养护订单只有 临时订单 / 正常订单 两态）
      var cp = order.careProperties
      order.statusLabel = cp ? cp.orderStatus : '临时订单'
      order.statusClass = this._statusClass(order.statusLabel)
      order.services = cp ? cp.services : ''
      order.isSummerTask = !!(cp && cp.isSummerTask)
      // 顾客称呼 + 会员标识
      var calledName = ''
      var member = order.member
      var memberShip = '【散】'
      if (order.contact_name) {
        calledName = order.contact_name + (order.contact_gender === '男' ? '(先生)' : (order.contact_gender === '女' ? '(女士)' : ''))
      } else if (member) {
        calledName = member.real_name + (member.gender === '男' ? ' 先生' : (member.gender === '女' ? ' 女士' : ''))
      }
      if (member && member.following_wechat === 1) {
        memberShip = '【会】'
      }
      order.calledName = calledName
      order.memberShip = memberShip
      // 支付方式拼接（排除储值/次卡，单列标签）
      var methodSet = {}
      order.haveDeposit = false
      order.useCard = order.useCard === true || order.usePunchCard === true
      for (var j = 0; order.availablePayments && j < order.availablePayments.length; j++) {
        var pm = order.availablePayments[j].pay_method
        if (pm === '储值支付') { order.haveDeposit = true; continue }
        if (pm === '次卡支付') { order.useCard = true; continue }
        if (pm) methodSet[pm] = true
      }
      var methods = Object.keys(methodSet)
      order.payMethod = methods.length > 0 ? methods.join('/') : null
      order.paidAmountStr = util.showAmount(order.paidAmount)
      order.refundAmountStr = util.showAmount(order.refundAmount)
      order.totalEarnAmountStr = util.showAmount(order.totalEarnAmount)
      order.careCount = order.cares ? order.cares.length : 0
      // 装备照片缩略图 + 卡券使用派生（任一 care 选了券 →「券」标签；选了卡 → 并入「卡」标签，
      // 从 care.ticket_code/use_card 直接看，不依赖 punch_card_used——未生效/历史漏记也能亮）
      var thumbs = []
      var haveTicket = false
      for (var k = 0; order.cares && k < order.cares.length; k++) {
        var care = order.cares[k]
        if (care.careImages && care.careImages.length > 0 && care.careImages[0].image) {
          thumbs.push(IMG_HOST + care.careImages[0].image.thumbUrl)
        }
        if (care.ticket_code && String(care.ticket_code).trim() !== '') haveTicket = true
        if (care.use_card) order.useCard = true
      }
      order.thumbs = thumbs
      order.haveTicket = haveTicket
      totalEarn += order.totalEarnAmount || 0
    }
    var totalPages = Math.max(1, Math.ceil(total / pageSize))
    this.setData({
      orders,
      total,
      page,
      pageSize,
      totalPages,
      totalEarnStr: util.showAmount(totalEarn)
    })
  },

  // list-pager 组件统一回调：翻页 / 跳转 / 改每页条数 → { page, pageSize }
  onPagerChange(e) {
    if (this.data.querying) return
    var d = e.detail
    this.setData({ querying: true })
    this.getData(d.page, d.pageSize)
  },

  gotoDetail(e) {
    var index = parseInt(e.currentTarget.id)
    var order = this.data.orders[index]
    if (order && order.careProperties && order.careProperties.orderStatus !== '临时订单') {
      wx.navigateTo({ url: 'care_order_detail/care_order_detail?orderId=' + order.id })
    }
  },

  setCell(e) {
    this.setData({ cell: e.detail.value })
  },

  setMemo(e) {
    this.setData({ keyword: e.detail.value })
  }
})
