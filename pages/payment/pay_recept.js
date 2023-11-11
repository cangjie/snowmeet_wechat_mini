// pages/payment/pay_recept.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    netWorkError: false
  },

  retry(){
    var that = this
    wx.reLaunch({
      url: '/pages/payment/pay_recept?id=' + that.data.id,
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var id = options.id
    var that = this
    that.setData({id: id})
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
            wx.navigateTo({
              url: jumpUrl
            })
          }
        },
        faile:(res)=>{
          wx.showToast({
            title: '网络有点慢，请稍候。',
            icon: 'loading'
          })
          that.setData({netWorkError: true})
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