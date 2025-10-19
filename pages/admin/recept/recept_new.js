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
    rentals: null,
    showOrderInfo: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({fire: options.fire? 1 : null})
    var id = options.id
    if (!id) {
      that.setData({
        bizType: options.bizType,
        shop: options.shop,
        memberId: options.memberId ? options.memberId : null,
        realName: options.realName ? options.realName : null,
        gender: options.gender ? options.gender : null,
        cell: options.cell ? options.cell : null
      })
      var title = ''
      switch (that.data.bizType) {
        case 'rent':
          title = '租赁开单'
          break
        case 'care':
          title = '养护开单'
          break
        case 'retail':
          title = '零售开单'
          break
        defaut:
          break
      }
      wx.setNavigationBarTitle({
        title: title,
      })
    }
    else {
      that.setData({ orderId: id })
    }
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
          that.setData({ showFooter: false })
          that.setData({ member, degree, realName, cell, gender, showFooter: true })
        }).catch(function (reject) {

        })

      }
      else {
        if (that.data.orderId) {
          data.getRentReceptingOrderPromise(that.data.orderId, app.globalData.sessionKey).then(function (order) {
            var bizType = null
            var memberId = order.member_id
            if (!memberId) {
              that.setData({ degree: '散客', memberId: null })
            }
            else {
              that.setData({ member: order.member, degree: '会员' })
            }
            var shop = order.shop
            var realName = order.contact_name ? order.contact_name : order.member.real_name
            var gender = order.contact_gender ? order.contact_gender : order.member.gender
            var cell = order.contact_num ? order.contact_num : order.member.cell

            switch (order.type) {
              case '租赁':
                bizType = 'rent'
                wx.setNavigationBarTitle({
                  title: '租赁开单',
                })
                break
              default:
                break
            }
            that.setData({ order, rentals: order.rentals, bizType, memberId, realName, cell, gender, shop })

          }).catch(function (exp) { })
        }
        else {
          that.setData({ degree: '散客', memberId: null })
        }

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
    that.setData({ rentals })
    that.setData({ showFooter: true })
    if (e.detail.needUpdate) {
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
    var memberId = that.data.memberId ? that.data.memberId : null
    if (!order) {
      order = {
        id: 0,
        code: null,
        shop: shop,
        type: '租赁',
        valid: 0,
        rentals: that.data.rentals,
        recepting: 1,
        member_id: memberId
      }
    }
    else {
      order = that.data.order
      order.rentals = that.data.rentals
    }
    for (var i = 0; i < order.rentals.length; i++) {
      var rental = order.rentals[i]
      rental.guaranty = rental.deposit
      var startDate = rental.startDate
      if (startDate) {
        startDate = util.formatDate(new Date(startDate))
      }
      else {
        startDate = util.formatDate(new Date())
      }

      for (var j = 0; rental.pricePresets && j < rental.pricePresets.length; j++) {
        rental.pricePresets[j].id = 0
      }
      rental.start_date = startDate
      rental.details = null
      rental.category = null
    }
    var submitUrl = app.globalData.requestPrefix + 'Rent/SaveRentRecept?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(submitUrl, order).then(function (submitedOrder) {
      console.log('save order', submitedOrder)
      that.setData({ order: submitedOrder, bizType: null })
      var rentals = submitedOrder.rentals
      for (var i = 0; i < rentals.length; i++) {
        rentals[i].timeStamp = (new Date(rentals[i].create_date)).getTime()
      }
      that.setData({ rentals })
      that.setData({ bizType: 'rent' })
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
  },
  retailOrderUpdate(e) {
    console.log('retail order update', e)
    var that = this
    var order = e.detail
    order.contact_name = that.data.realName
    order.contact_gender = that.data.gender
    order.contact_num = that.data.cell
    order.member_id = that.data.memberId
    order.shop = that.data.shop
    var retails = order.retails
    for (var i = 0; i < retails.length; i++) {
      var retail = retails[i]
      if (retail.entertain == 1) {
        retail.order_type = '招待'
      }
      else {
        retail.order_type = '普通'
      }
    }
    that.setData({ order, showFooter: false })
    that.setData({ showFooter: true })
  },
  showRetailOrder(e) {
    var that = this
    that.setData({ bizType: null, order: e.detail })
    that.setData({ bizType: 'retail', showOrderInfo: true })
  },
  jump(e) {
    var url = e.detail.url
    wx.navigateTo({
      url: url,
    })
  },
  careOrderUpdate(e) {
    console.log('care order update', e)
    var that = this
    var order = e.detail.order
    order.type = '养护'
    order.contact_name = that.data.realName
    order.contact_gender = that.data.gender
    order.contact_num = that.data.cell
    order.member_id = that.data.memberId
    if (e.detail.refreshSelf) {
      that.setData({ bizType: null, order })
      that.setData({ bizType: 'care' })
    }
    else if (e.detail.refreshFooter){
      that.setData({ order, showFooter: false })
      that.setData({showFooter: true})
    }


  },
  showCareBackDrop(e){
    var that = this
    var order = e.detail.order
    that.setData({order, showOrderInfo: true})

  },
  onPopOrderInfoClose(e){
    var that = this
    console.log('close back drop', e)
    //that.setData({showOrderInfo: false})
  },
  updateCareCurrent(e){
    var that = this
    var order = e.detail.order
    that.setData({order, bizType: null})
    that.setData({bizType: 'care', showOrderInfo: false})
  }
})