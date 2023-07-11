// pages/admin/sale/mod_mi7_order_no.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    newOrderNum: ''
  },

  input(e){
    var that = this
    that.setData({newOrderNum: e.detail.value})
  },

  submit(){
    var that = this
    var value = that.data.newOrderNum
    var order = that.data.order
    if (value!=''){
      var updateUrl = 'https://' + app.globalData.domainName + '/core/Mi7Order/ModMi7Order/' + order.id + '?orderNum=' + encodeURIComponent(value) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: updateUrl,
        method: 'GET',
        success:(res)=>{
          wx.showToast({
            title: '七色米订单号已经修改',
            success:(res)=>{
              wx.navigateTo({
                url: 'order_detail?id=' + order.order_id,
              })
            }
          })
        }
      })
    }
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function (resolve){
      
      var getMi7OrderUrl = 'https://' + app.globalData.domainName + '/core/Mi7Order/GetMi7Order/' + options.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getMi7OrderUrl,
        method: 'GET',
        success:(res)=>{
          var order = res.data
          order.sale_price_str = util.showAmount(order.sale_price)
          order.real_charge_str = util.showAmount(order.real_charge)
          that.setData({order: res.data})

        }
      })
    })
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

  }
})