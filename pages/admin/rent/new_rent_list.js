// pages/admin/rent/new_rent_list.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
Page({

  /**
   * Page initial data
   */
  data: {
    queryOptions: [
      { key: 'isTest', value: false },
      { key: 'isEntertain', value: false },
      { key: 'haveDiscount', value: null }
    ],
    cell: null,
    keyword: null
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var nowDate = new Date()
    that.setData({ startDate: util.formatDate(nowDate), endDate: util.formatDate(nowDate) })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      that.setData({ staff: app.globalData.staff, querying: true })
      that.getData()
    })
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  },
  shopSelected(e) {
    var that = this
    console.log('shop selected', e)
    that.setData({ shop: e.detail.shop })
  },
  setDate(e) {
    var id = e.currentTarget.id
    var that = this
    console.log('select date', e)
    switch (id) {
      case 'start':
        that.setData({ startDate: e.detail.value })
        break
      case 'end':
        that.setData({ endDate: e.detail.value })
        break
      default:
        break
    }
  },
  setQueryOptions(e) {
    var that = this
    var id = e.currentTarget.id
    that.setQueryOptionValue(id, e.detail.value)
  },
  setQueryOptionValue(key, value) {
    var that = this
    var queryOptions = that.data.queryOptions
    for (var i = 0; i < queryOptions.length; i++) {
      if (queryOptions[i].key == key) {
        switch (value) {
          case 'null':
            queryOptions[i].value = null
            break
          case 'true':
            queryOptions[i].value = true
            break
          case 'false':
            queryOptions[i].value = false
            break
          default:
            queryOptions[i].value = value
            break
        }
      }
    }
    console.log('set query options', queryOptions)
  },
  getData() {
    var that = this
    var isTest = null
    var isEntertain = null
    var haveDiscount = null
    var queryOptions = that.data.queryOptions
    for (var i = 0; i < queryOptions.length; i++) {
      switch (queryOptions[i].key) {
        case 'isTest':
          isTest = queryOptions[i].value
          break
        case 'isEntertain':
          isEntertain = queryOptions[i].value
          break
        case 'haveDiscount':
          haveDiscount = queryOptions[i].value
          break
        default:
          break
      }
    }
    var shop = that.data.shop
    var startDate = that.data.startDate
    var endDate = that.data.endDate
    var cell = that.data.cell
    var keyword = that.data.keyword
    if ((cell != null && cell != '') || (keyword != null && keyword != '')) {
      startDate = new Date('2025-10-15')
      endDate = null
      shop = null
      isTest = null
      isEntertain = null
      haveDiscount = null
    }
    data.getOrdersByStaffPromise(null, shop, null, null, '租赁', startDate, endDate,
      null, isTest, isEntertain, null, null, haveDiscount, null, app.globalData.sessionKey, that.data.cell, null, null, that.data.keyword).then(function (orders) {
        console.log('get orders', orders)
        that.renderOrders(orders)
        that.setData({ querying: false })
      }).catch(function (exp){
        console.log('error', exp)
      })
  },
  query() {
    var that = this
    that.setData({ querying: true })
    that.getData()
  },
  renderOrders(orders) {
    var that = this
    var totalAmount = 0
    var totalRentalAmount = 0
    for (var i = 0; orders && i < orders.length; i++) {
      var order = orders[i]
      var bizDate = new Date(order.biz_date)
      order.dateStr = util.formatDate(bizDate)
      order.timeStr = util.formatTimeStr(bizDate)
      totalAmount += order.totalCharge
      order.totalChargeStr = util.showAmount(order.totalCharge)

      var calledName = ''
      var member = order.member
      var cell = ''
      var memberShip = '【散】'
      if (order.contact_name) {
        calledName = order.contact_name + (order.contact_gender == '男' ? '(先生)' : (order.contact_gender == '女' ? '(女士)' : ''))
        cell = order.contact_num
      }
      else if (member) {
        calledName = member.real_name + (member.gender == '男' ? ' 先生' : (member.gender == '女' ? ' 女士' : ''))
        cell = member.cell
      }
      if (member && member.following_wechat == 1) {
        memberShip = '【会】'
      }
      order.calledName = calledName
      order.cell = cell
      order.memberShip = memberShip
      order.paidAmountStr = util.showAmount(order.paidAmount)
      for (var j = 0; order.availablePayments && j < order.availablePayments.length; j++) {
        order.payMethod = order.availablePayments[j].pay_method
      }
      order.displayedRental = 0
      for (var j = 0; order.rentals && order.rentProperties 
        && order.rentProperties.rentStatus == '了结关闭'  && j < order.rentals.length; j++) {
        var rental = order.rentals[j]
        order.displayedRental += (rental.totalRentalAmount - rental.totalDiscountAmount)
        totalRentalAmount += order.displayedRental
        order.displayedRentalStr = util.showAmount(order.displayedRental)

      }
      if (order.rentals == null || order.rentals.length <= 0) {
        if (order.refundAmount > 0) {
          order.displayedRental = order.paidAmount - order.refundAmount
          order.displayedRentalStr = util.showAmount(order.displayedRental)
          totalRentalAmount += (order.paidAmount - order.refundAmount)
        }
      }
    }
    that.setData({ orders, totalAmount, totalRentalAmount, totalRentalAmountStr: util.showAmount(totalRentalAmount) })
  },
  gotoDetail(e) {
    var that = this
    var index = parseInt(e.currentTarget.id)
    var order = that.data.orders[index]
    if (!order.rentals || order.rentals.length <= 0) {
      wx.navigateTo({
        url: '/pages/admin/fire/fire_order_detail?id=' + order.id,
      })
    }
    else {
      wx.navigateTo({
        url: '/pages/admin/rent/rent_details?id=' + order.id,
      })
    }
  },
  setCell(e) {
    var that = this
    //that.data.cell = e.detail.value
    var cell = e.detail.value
    that.setData({ cell })
  },
  setMemo(e){
    var that = this
    var keyword = e.detail.value
    that.setData({keyword})
  }
})