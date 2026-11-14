// pages/admin/care/care_order_list.js
// 养护订单列表（Alpine 风格，仿租赁订单列表 new_rent_list）
// 查询条件与旧版保持一致：店铺 / 日期 / 测试 / 招待 / 减免 / 非雪季 / 次卡 / 手机 / 备注
// 分页复用通用后端接口 Order/GetOrdersByStaffPaged（getRentOrdersByStaffPagedPromise，type='养护'）+ list-pager 组件
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
const adminAssistant = require('../../../utils/adminAssistant.js')
const careOrderRows = require('../../../utils/care_order_rows.js')

const IMG_HOST = data.IMAGE_HOST
// 订单状态 chip 的配色（状态文字是后端 Order.orderStatus，与旧系统其它订单列表、新版零售订单列表同口径）
const STATUS_CLASS = {
  '临时订单': 'temp',
  '支付成功': 'paid', '已下单': 'paid', '已完成': 'paid',
  '部分支付': 'partial',
  '待生成': 'unpaid', '待支付': 'unpaid', '订单关闭': 'unpaid',
  '全额退款': 'refund', '部分退款': 'refund', '退款失败': 'refund',
  '挂账': 'credit'
}
// 没付成功的订单：整张卡片文字置灰
const UNPAID_STATUSES = ['待生成', '待支付', '订单关闭']

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
    allEarnStr: '暂不可用',
    querying: false,
    aiQueryConditions: ''
  },

  onLoad(options) {
    var aiState = adminAssistant.applyPageIntent('care_order.show_results', options)
    if (aiState) {
      this._ignoreInitialShopSelection = true
      this.setData(aiState)
      return
    }
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
    // AI 指定了门店时，吃掉 shop_selector 首次的自动选店事件，否则会被就近扫描覆盖掉。
    if (this._ignoreInitialShopSelection) {
      this._ignoreInitialShopSelection = false
      return
    }
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
    // 手机 / 备注搜索时放宽到全时段、全店铺、忽略其它筛选（与旧版一致）。
    // AI 下发的是一组完整条件，手机号只是其中一项，不能触发放宽——否则日期门店会被冲掉。
    if (!this.data.aiQueryApplied && ((cell != null && cell != '') || (keyword != null && keyword != ''))) {
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
      null,
      page, pageSize
    ).then(function (result) {
      that.renderOrders(result.items || [], result.total || 0, page, pageSize, result.totalEarnAmount)
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
    return STATUS_CLASS[s] || 'unknown'
  },

  renderOrders(orders, total, page, pageSize, allEarn) {
    var totalEarn = 0
    for (var i = 0; orders && i < orders.length; i++) {
      var order = orders[i]
      var bizDate = new Date(order.biz_date)
      order.dateStr = util.formatDate(bizDate)
      order.timeStr = util.formatTimeStr(bizDate)
      // 状态：没有装备的仍是「临时订单」（同旧版养护列表，不能进详情）；其余显示后端统一的订单状态
      // （待生成 / 待支付 / 部分支付 / 支付成功 / 已下单 / 订单关闭 / 退款 / 挂账），不再笼统写「正常订单」
      var cp = order.careProperties
      var isTemp = !cp || cp.orderStatus === '临时订单'
      order.statusLabel = isTemp ? '临时订单' : (order.orderStatus || '未定义')
      order.statusClass = this._statusClass(order.statusLabel)
      order.unpaid = !isTemp && UNPAID_STATUSES.indexOf(order.statusLabel) >= 0
      order.isSummerTask = !!(cp && cp.isSummerTask)
      // 顾客称呼（原来的「会 / 散」标识已取消，改由后端判定「新」：isNewCareCustomer，该顾客第一次下有效养护订单）
      var calledName = ''
      var member = order.member
      if (order.contact_name) {
        calledName = order.contact_name + (order.contact_gender === '男' ? '(先生)' : (order.contact_gender === '女' ? '(女士)' : ''))
      } else if (member) {
        calledName = member.real_name + (member.gender === '男' ? ' 先生' : (member.gender === '女' ? ' 女士' : ''))
      }
      order.calledName = calledName
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
      // 每件装备一块：品牌 / 长度 / 项目 / 照片 / 养护进度（utils/care_order_rows.js）；
      // 装备明细整体可折叠，默认收起（点「装备 N 件」标题展开）。从详情返回会重新加载列表，
      // 所以展开过的订单按订单 id 记在页面上，重新加载后保持展开，免得每次返回都要重新点开
      order.careRows = careOrderRows.buildCareRows(order.cares, IMG_HOST)
      order.careExpanded = !!(this.expandedCareOrderIds && this.expandedCareOrderIds[order.id])
      // 所有装备（不含已取消的）都发板了：整张订单卡片换底色
      order.allCaresDone = careOrderRows.allCaresDone(order.careRows)
      // 卡券使用派生（任一 care 选了券 →「券」标签；选了卡 → 并入「卡」标签，
      // 从 care.ticket_code/use_card 直接看，不依赖 punch_card_used——未生效/历史漏记也能亮）
      var haveTicket = false
      for (var k = 0; order.cares && k < order.cares.length; k++) {
        var care = order.cares[k]
        if (care.ticket_code && String(care.ticket_code).trim() !== '') haveTicket = true
        if (care.use_card) order.useCard = true
      }
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
      totalEarnStr: util.showAmount(totalEarn),
      allEarnStr: allEarn == null ? '暂不可用' : util.showAmount(allEarn)
    })
  },

  // list-pager 组件统一回调：翻页 / 跳转 / 改每页条数 → { page, pageSize }
  onPagerChange(e) {
    if (this.data.querying) return
    var d = e.detail
    this.setData({ querying: true })
    this.getData(d.page, d.pageSize)
  },

  // 点「装备 N 件」标题：展开 / 收起本单的装备明细，只切这一单，不进详情（wxml 用 catchtap）
  onToggleCares(e) {
    var index = parseInt(e.currentTarget.dataset.idx)
    var order = this.data.orders[index]
    if (!order) return
    var expanded = !order.careExpanded
    this.expandedCareOrderIds = this.expandedCareOrderIds || {}
    if (expanded) this.expandedCareOrderIds[order.id] = true
    else delete this.expandedCareOrderIds[order.id]
    this.setData({ ['orders[' + index + '].careExpanded']: expanded })
  },

  // 点装备缩略图：用原图预览这件装备的全部照片（wxml 用 catchtap，不进详情）
  onCarePhotoTap(e) {
    var order = this.data.orders[parseInt(e.currentTarget.dataset.idx)]
    if (!order) return
    var cid = parseInt(e.currentTarget.dataset.cid)
    var row = (order.careRows || []).filter(function (r) { return r.id === cid })[0]
    if (!row || !row.photos || row.photos.length === 0) return
    wx.previewImage({ current: row.photos[0], urls: row.photos })
  },

  gotoDetail(e) {
    var index = parseInt(e.currentTarget.id)
    var order = this.data.orders[index]
    if (order && order.careProperties && order.careProperties.orderStatus !== '临时订单') {
      wx.navigateTo({ url: 'care_order_detail/care_order_detail?orderId=' + order.id })
    }
  },

  // 点某一件装备（整块，照片除外）：进订单详情并定位到这件——详情页收到 careId 后只展开这一件、收起其它、滚动到这一件。
  // 点订单公共部分仍走 gotoDetail（不带 careId）。wxml 用 catchtap，不会再冒泡成整单的点击
  onCareTap(e) {
    var order = this.data.orders[parseInt(e.currentTarget.dataset.idx)]
    var cid = parseInt(e.currentTarget.dataset.cid)
    if (!order || !cid || !order.careProperties || order.careProperties.orderStatus === '临时订单') return
    wx.navigateTo({ url: 'care_order_detail/care_order_detail?orderId=' + order.id + '&careId=' + cid })
  },

  setCell(e) {
    this.setData({ cell: e.detail.value })
  },

  setMemo(e) {
    this.setData({ keyword: e.detail.value })
  }
})
