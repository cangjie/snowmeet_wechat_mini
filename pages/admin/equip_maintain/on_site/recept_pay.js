// pages/admin/equip_maintain/on_site/recept_pay.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    id: 0,
    paid: false,
    qrCodeUrl: '',
    orderId: 0,
    paymentTimeOut: false
  },

  getOrderId: function(){
    var getOrderIdUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get.aspx?id=' + this.data.id + '&sessionkey=' + encodeURIComponent(this.data.sessionKey)
    wx.request({
      url: getOrderIdUrl,
      success: (res) => {
        if (res.data.status == 0){
          console.log(res.data)
          this.setData({orderId: res.data.maintain_in_shop_request.order_id})
          if (this.data.orderId > 0){
            this.getOrderInfo()
          }
        }
      },
      fail:(res)=>{
        this.setData({orderId: -1})
      }
    })
    if (this.data.orderId == 0) {
      setTimeout(() => {
        this.getOrderId()
      }, 1000);
    }
  },
  getOrderInfo: function() {
    var orderInfoUrl = 'https://' + app.globalData.domainName + '/api/order_info_get.aspx?orderid=' + this.data.orderId + '&sessionkey=' + encodeURIComponent(this.data.sessionKey)
    wx.request({
      url: orderInfoUrl,
      success: (res) => {
        if (res.data.status == 0) {
          if (res.data.order_online.pay_state == '1') {
            this.setData({paid: true})
          }
          else {
            var orderTime = new Date(res.data.order_online.create_date.toString())
            var nowTime = new Date()
            console.log(nowTime - orderTime)
            if (nowTime - orderTime > 600000){
              this.setData({paymentTimeOut: true})
            }
          }
        }
        else{
          this.data.paymentTimeOut = true
        }
      },
      fail:(res) =>{
        this.data.paymentTimeOut = true
      }
    })
    if (!this.data.paymentTimeOut && !this.data.paid) {
      setTimeout(() => {
        this.getOrderInfo()
      }, 1000);
      
    }
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.data.id = options.id
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      that.data.sessionKey = resolve.sessionKey
      var qrCodeUrl = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=pay_in_shop_maintain_id_' + that.data.id
      that.setData({qrCodeUrl: qrCodeUrl})
      that.getOrderId()
    })
    
  },
  gotoPrint: function() {
    wx.navigateTo({
      url: 'print_label?id=' + this.data.id
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

  }
})