// pages/admin/ski_pass/nanshan_refund_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var productId = options.productId
    var date = options.date
    var that = this
    that.setData({productId, date})
    app.loginPromiseNew.then(function(resovle){
      that.getData()
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

  },
  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/GetReserveProductDetail/' + that.data.productId + '?reserveDate=' + that.data.date + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method:'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var list = res.data
        var title = that.data.date.substr(5, 5)
        if (list){
          title += ' ' + list.product_name
        }
        wx.setNavigationBarTitle({
          title: title,
        })
        that.setData({list})
        for(var i = 0; i < list.memberList.length; i++){
          for(var j = 0; j < list.memberList[i].skiPasses.length; j++){
            var skipass = list.memberList[i].skiPasses[j]
            skipass.depositStr = util.showAmount(skipass.deposit)
            skipass.ticket_priceStr = util.showAmount(skipass.ticket_price)
            skipass.feeStr = util.showAmount(skipass.fee?skipass.fee:0)
            skipass.cardFeeStr = util.showAmount(skipass.cardFee)
            skipass.needRefundStr = util.showAmount(skipass.needRefund) 
            skipass.refund_amountStr = util.showAmount(skipass.refund_amount)         
          }
        }
        that.setData({list})
        console.log('get list', list)
      }
    })
  }
})