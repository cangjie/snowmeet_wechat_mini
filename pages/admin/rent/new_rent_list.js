// pages/admin/rent/new_rent_list.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
Page({

  data: {
    queryOptions: [
      { key: 'isTest', value: false },
      { key: 'isEntertain', value: false },
      { key: 'haveDiscount', value: null },
      { key: 'rentCategory', value: null },
      { key: 'rentItemName', value: null },
      { key: 'useCard', value: null },
      { key: 'status', value: null }
    ],
    cell: null,
    keyword: null,
    orders: [],       // 当前页数据
    total: 0,         // 服务器返回的总条数
    page: 1,
    pageSize: 50,
    totalPages: 0,
    totalRentalAmountStr: '',
    querying: false
  },

  onLoad(options) {
    var nowDate = new Date()
    this.setData({ startDate: util.formatDate(nowDate), endDate: util.formatDate(nowDate) })
  },

  // 返回列表时（从订单明细等页面返回触发 onShow）：保留当前页码/每页条数/筛选 tag，
  // 用这些参数重新查询并按当前状态显示——不重置回第 1 页。
  // 页面实例 navigateTo 期间不销毁，page/pageSize/queryOptions 等都还在 this.data 里，
  // 直接读取即为「记录下的各个参数」。首次进入时 page=1/pageSize=50 自然等同初始查询。
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
    var isTest = null, isEntertain = null, haveDiscount = null
    var rentCategoryId = null, rentItemName = null, useCard = null, rentStatus = null
    var queryOptions = this.data.queryOptions
    for (var i = 0; i < queryOptions.length; i++) {
      switch (queryOptions[i].key) {
        case 'isTest':        isTest        = queryOptions[i].value; break
        case 'isEntertain':   isEntertain   = queryOptions[i].value; break
        case 'haveDiscount':  haveDiscount  = queryOptions[i].value; break
        case 'rentCategory':  rentCategoryId = queryOptions[i].value == null ? null : queryOptions[i].value.id; break
        case 'rentItemName':  rentItemName  = queryOptions[i].value; break
        case 'useCard':       useCard       = queryOptions[i].value; break
        case 'status':        rentStatus    = queryOptions[i].value; break
      }
    }
    if (rentItemName == null || rentCategoryId == null) {
      rentItemName = null
      rentCategoryId = null
    }
    var shop = this.data.shop
    var startDate = this.data.startDate
    var endDate = this.data.endDate
    var cell = this.data.cell
    var keyword = this.data.keyword
    if ((cell != null && cell != '') || (keyword != null && keyword != '')) {
      startDate = new Date('2025-10-15')
      endDate = new Date()
      shop = null
      isTest = null
      isEntertain = null
      haveDiscount = null
    }
    return { shop, startDate, endDate, cell, keyword, isTest, isEntertain, haveDiscount, rentCategoryId, rentItemName, useCard, rentStatus }
  },

  getData(page, pageSize) {
    var that = this
    page = page || that.data.page
    var p = that._buildQueryParams()
    pageSize = pageSize || that.data.pageSize
    data.getRentOrdersByStaffPagedPromise(
      null, p.shop, null, null, '租赁', p.startDate, p.endDate,
      null, p.isTest, p.isEntertain, null, null, p.haveDiscount, null,
      app.globalData.sessionKey, p.cell, null, null, p.keyword, null,
      p.rentCategoryId, p.rentItemName, p.useCard, p.rentStatus,
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

  _statusClass(rentStatus) {
    var map = {
      '租赁中':   'renting',
      '全部归还': 'returned',
      '了结关闭': 'closed',
      '全额退押金': 'full-refund',
      '部分退押金': 'part-refund',
      '部分归还': 'part-return',
      '未开始':   'not-started',
      '未支付':   'unpaid'
    }
    return map[rentStatus] || 'unknown'
  },

  renderOrders(orders, total, page, pageSize) {
    var totalRentalAmount = 0
    for (var i = 0; orders && i < orders.length; i++) {
      var order = orders[i]
      var bizDate = new Date(order.biz_date)
      order.dateStr = util.formatDate(bizDate)
      order.timeStr = util.formatTimeStr(bizDate)
      order.totalChargeStr = util.showAmount(order.totalCharge)
      var rs = order.rentProperties ? order.rentProperties.rentStatus : null
      if (order.rentProperties == null) {
        order.statusLabel = '临时订单'
        order.statusClass = 'temp'
      } else {
        order.statusLabel = rs || '未知状态'
        order.statusClass = this._statusClass(rs)
      }

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
      var paidAmountExcludeDeposit = 0
      for (var j = 0; order.availablePayments && j < order.availablePayments.length; j++) {
        var p = order.availablePayments[j]
        if (p.status === '支付成功' && p.pay_method !== '储值支付') {
          paidAmountExcludeDeposit += parseFloat(p.amount) || 0
        }
      }
      order.paidAmountStr = util.showAmount(paidAmountExcludeDeposit)
      var methodSet = {}
      order.haveDeposit = false
      for (var j = 0; order.availablePayments && j < order.availablePayments.length; j++) {
        var pm = order.availablePayments[j].pay_method
        if (pm === '储值支付') { order.haveDeposit = true; continue }
        if (pm === '次卡支付') continue
        if (pm) methodSet[pm] = true
      }
      var methods = Object.keys(methodSet)
      order.payMethod = methods.length > 0 ? methods.join('/') : null
      order.displayedRental = 0
      for (var j = 0; order.rentals && order.rentProperties
        && order.rentProperties.rentStatus === '了结关闭' && j < order.rentals.length; j++) {
        var rental = order.rentals[j]
        order.displayedRental += (rental.totalRentalAmount - rental.totalDiscountAmount)
        totalRentalAmount += (rental.totalRentalAmount - rental.totalDiscountAmount)
      }
      if (order.displayedRental > 0) {
        order.displayedRentalStr = util.showAmount(order.displayedRental)
      } else if (order.rentals == null || order.rentals.length <= 0) {
        if (order.refundAmount > 0) {
          order.displayedRental = order.paidAmount - order.refundAmount
          order.displayedRentalStr = util.showAmount(order.displayedRental)
          totalRentalAmount += order.displayedRental
        }
      }
    }
    var totalPages = Math.max(1, Math.ceil(total / pageSize))
    this.setData({
      orders,
      total,
      page,
      pageSize,
      totalPages,
      totalRentalAmountStr: util.showAmount(totalRentalAmount)
    })
  },

  // list-pager 组件统一回调：翻页 / 跳转 / 改每页条数
  onPagerChange(e) {
    if (this.data.querying) return
    var d = e.detail   // { page, pageSize }
    this.setData({ querying: true })
    this.getData(d.page, d.pageSize)
  },

  gotoDetail(e) {
    var index = parseInt(e.currentTarget.id)
    var order = this.data.orders[index]
    if (!order.rentals || order.rentals.length <= 0) {
      wx.navigateTo({ url: '/pages/admin/fire/fire_order_detail?id=' + order.id })
    } else {
      wx.navigateTo({ url: '/pages/admin/rent/rent_order_detail/rent_order_detail?id=' + order.id })
    }
  },

  setCell(e) {
    this.setData({ cell: e.detail.value })
  },

  setMemo(e) {
    this.setData({ keyword: e.detail.value })
  },

  showBackdrop() {
    this.setData({ showRentCategorySelector: true })
  },

  selectCategory(e) {
    if (e.detail.action === 'confirm') {
      var queryOptions = this.data.queryOptions
      queryOptions[3].value = e.detail.category
      this.setData({ queryOptions, showRentCategorySelector: false })
    } else {
      this.setData({ showRentCategorySelector: false })
    }
  },

  setRentItemName(e) {
    var value = e.detail.value
    var queryOptions = this.data.queryOptions
    if (value === '') {
      queryOptions[3].value = null
      queryOptions[4].value = null
    } else {
      queryOptions[4].value = value
    }
    this.setData({ queryOptions })
  }
})
