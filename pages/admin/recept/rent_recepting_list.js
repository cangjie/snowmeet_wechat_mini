// pages/admin/recept/rent_recepting_list.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
Page({

  /**
   * Page initial data
   */
  data: {
    querying: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

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
    console.log('shop selected', e)
    var that = this
    that.setData({ shopName: e.detail.shop })
  },
  getData() {
    var that = this
    that.setData({ querying: true })
    data.getRentReceptingOrderPromise(that.data.shopName, app.globalData.sessionKey).then(function (orders) {
      for (var i = 0; orders && i < orders.length; i++) {
        var order = orders[i]
        order.timeStr = util.formatTimeStr(new Date(order.biz_date))
        if (order.member) {
          if (!order.contact_gender) {
            order.contact_gender = order.member.gender
          }
          if (!order.contact_num) {
            order.contact_num = order.member.cell
          }
          if (!order.contact_name) {
            order.contact_name = order.member.real_name
          }
        }
        order.called_name = order.contact_name + ' ' 
          + ((order.contact_gender == '男')?'先生':(order.contact_gender == '女'? '女士':''))
        if (!order.contact_num){
          order.contact_num = ''
        }
        if (!order.called_name || order.called_name == null || order.called_name.trim() == 'null') {
          order.called_name = ''
        }
      }
      that.setData({ querying: false, orders })
    }).catch(function (exp) {
      that.setData({ querying: false })
    })
  }
})