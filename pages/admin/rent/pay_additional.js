// pages/admin/rent/pay_additional.js
Page({

  /**
   * Page initial data
   */
  data: {
    payMethod: '',
    amount: 0,
    reason: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({id: options.id})
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
  setPayMethod(e){
    console.log('pay method selected', e)
    var that = this
    var payMethod = e.detail.payMethod
    that.setData({payMethod})
  },
  checkValid(){
    var that = this
    var amount = that.data.amount
    var reason = that.data.reason
    
  },
  setReason(e){
    var that = this
    that.setData({reason: e.detail.value})
  },
  inputReason(e){
    var that = this
    that.setData({reason: e.detail.value})
  }
})