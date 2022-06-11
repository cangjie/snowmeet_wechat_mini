// pages/payment/view_payment.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    id: 0,
    state: 0,
    item:'',
    payMethod: '微信'
  },

  submitPay: function(){
    var that = this
    var payUrl = 'https://' + app.globalData.domainName + '/core/' + that.data.item + '/Pay/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: payUrl,
      method: 'GET',
      success:(res)=>{
        wx.requestPayment({
          nonceStr: res.data.nonce,
          package: 'prepay_id=' + res.data.prepay_id,
          paySign: res.data.sign,
          timeStamp: res.data.timestamp,
          signType: 'RSA',
          success: (res) => {
            console.log('pay success', res)  
            that.setData({state: 1})

          }
        })
      }
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    that.setData({id: options.id, item: options.item})
    app.loginPromiseNew.then(function(resolve){
      
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  },
  getInvoiceInfo: function(e){
    var that = this
    console.log(e)
    console.log(app.globalData.sessionKey)
    that.setData({payMethod: e.detail.item.pay_method})
    switch(that.data.item){
      case 'summermaintain':
        if (e.detail.item.pay_method!='微信' && e.detail.item.open_id==''){
          var setOpenIdUrl = 'https://' + app.globalData.domainName + '/core/SummerMaintain/SetOpenId/' + e.detail.item.id + '?sessionKey=' + app.globalData.sessionKey
          wx.request({
            url: setOpenIdUrl,
            method:'GET',
            success:(res)=>{

            }
          })
        }
        break
      default:
        break
    }
  }
})