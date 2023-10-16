// pages/payment/pay_recept.js
const app = getApp()
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
    var id = options.id
    app.loginPromiseNew.then(function (resolve){
      var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + id.toString() 
      + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getUrl,
        method: 'GET',
        success:(res)=>{
          console.log('get recept', res)
          if (res.statusCode != 200){
            return
          }
          var recept = res.data
          var jumpUrl = ''
          if (recept.maintainOrder != null){
            jumpUrl = '../mine/maintain/order_detail?id=' + recept.maintainOrder.order.id 
          }
          if (recept.rentOrder != null){
            jumpUrl = '../experience/pay_temp?id=' + recept.rentOrder.order_id 
          }

          if (jumpUrl!=''){
            wx.redirectTo({
              url: jumpUrl
            })
          }
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