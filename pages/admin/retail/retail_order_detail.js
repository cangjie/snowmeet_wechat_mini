const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
Page({

  /**
   * Page initial data
   */
  data: {
    moddingContactInfo: false,
    moddingOrderInfo: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({ id: options.id })

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
  getData() {
    var that = this
    var orderId = that.data.id
    data.getOrderByStaffPromise(orderId, app.globalData.sessionKey).then(function (order) {
      console.log('get order', order)
      var memberShip = '散客'
      if (order.member && order.member.following_wechat == 1) {
        memberShip = '会员'
      }
      else if (order.member) {
        memberShip = '散客(取关)'
      }
      order.memberShip = memberShip
      order.totalAmountStr = util.showAmount(order.total_amount)
      that.setData({ order })
    })
  },
  orderStatusChanged() {
    var that = this
    that.getData()
  },
  dealPaidResult(e) {
    var that = this
    var orderId = e.detail.id
    data.getOrderByStaffPromise(orderId, app.globalData.sessionKey).then(function (order) {
      var paid = util.orderPaid(order)
      if (paid) {
        wx.showToast({
          title: '支付成功',
          icon: 'success'
        })
        that.getData()
      }
    })
  }
})