// pages/admin/recept/recept_new.js
const util = require("../../../utils/util")
const data = require('../../../utils/data.js')
const app = getApp()

Page({

  /**
   * Page initial data
   */
  data: {
    showUserInfo: false,
    bizType: 'sale',
    receptId: null,
    showSummary: false,
    showMainComponent: true,
    showFooter: true,
    rentals: null
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({
      bizType: options.bizType,
      shop: options.shop,
      memberId: options.memberId ? options.memberId : null,
      realName: options.realName ? options.realName : null,
      gender: options.gender ? options.gender : null,
      cell: options.cell ? options.cell : null,
    })
    var title = ''
    switch (that.data.bizType) {
      case 'rent':
        title = '租赁开单'
        break
      case 'care':
        title = '养护开单'
        break
      case 'sale':
        title = '零售开单'
        break
        defaut:
        break
    }
    wx.setNavigationBarTitle({
      title: title,
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      if (that.data.memberId) {
        data.getMemberPromise(that.data.memberId, app.globalData.sessionKey).then(function (member) {
          var degree = '会员'
          if (member.following_wechat != 1) {
            degree += ' 取关'
          }
          var realName = that.data.realName ? that.data.realName : member.real_name
          var cell = that.data.cell ? that.data.cell : member.cell
          var gender = that.data.gender ? that.data.gender : member.gender


          that.setData({ member, degree, realName, cell, gender })
        }).catch(function (reject) {

        })
      }
      else {
        that.setData({ degree: '散客', memberId: null })
      }
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
  showUserInfo() {

    var that = this
    if (that.data.degree != '散客') {
      that.setData({ showUserInfo: true })
    }
  },
  closeUserInfo(e) {
    var that = this
    that.setData({ showUserInfo: false })
  },
  
  onPopClose() {
    var that = this
    that.setData({ showUserInfo: false })
  },
  rentDataUpdated(e) {
    var that = this
    console.log('rent data updated', e)
    var rentals = e.detail.rentals
    that.setData({ showFooter: false })
    that.setData({ rentals, showFooter: true })
    if (e.detail.needUpdate){
      that.saveReceptOrder()
    }
  },
  saveReceptOrder() {
    var that = this
    var order = that.data.order
    var shop = that.data.shop
    if (!shop) {
      wx.showToast({
        title: '店铺不能为空',
        icon: 'error'
      })
      return
    }
    if (!order) {
      order = {
        id: 0,
        code: null,
        shop: shop,
        type: '租赁',
        valid: 0,
        rentals: that.data.rentals,
        recepting: 1
      }
    }
    else {
      order = that.data.order
      order.rentals = that.data.rentals
    }
    for(var i = 0; i < order.rentals.length; i++){
      var rental = order.rentals[i]
      rental.guaranty = rental.deposit
      var startDate = rental.startDate
      if (startDate){
        startDate = util.formatDate(new Date(startDate))
      }
      else{
        startDate = util.formatDate(new Date())
      }
     
      for(var i = 0; rental.pricePresets && i < rental.pricePresets.length; i++){
        rental.pricePresets[i].id = 0
      }
      rental.start_date = startDate
      rental.details = null
      //rental.noGuaranty = rental.
    }
    var submitUrl = app.globalData.requestPrefix + 'Rent/SaveRentRecept?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(submitUrl, order).then(function (submitedOrder) {
      console.log('save order', submitedOrder)
      that.setData({ order: submitedOrder, bizType: null })
      var rentals = submitedOrder.rentals
      /*
      for(var i = 0; i < rentals.length; i++){
        var rental = rentals[i]
        if (rental.start_date){
          rental.startDate = util.formatDate(new Date(rental.start_date))
        }
        else{
          rental.startDate = util.formatDate(new Date())
        }
        rental.deposit = rentail.guaranty
        rental.depositStr = util.showAmount(rental.deposit)
      }
      */
      that.setData({ rentals, bizType: 'rent' })
    })
  },
  rentalWellFormed(e) {
    var that = this
    console.log('well formed', e)
    that.setData({ rentalWellFormed: e.detail })
  },
  onClickIcon(e) {
    var that = this
    if (that.data.rentalWellFormed) {

    }
    else {
      var title = ''
      switch (that.data.bizType) {
        case 'rent':
          title = '租赁信息填写不完整'
          break
        default:
          break
      }
      wx.showToast({
        title: title,
        icon: 'error'
      })
    }
  }
})