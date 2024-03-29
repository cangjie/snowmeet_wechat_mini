// pages/payment/pay_temp_order.js
const app = getApp()
Page({

    /**
     * 页面的初始数据
     */
    data: {
        tempOrderId: 0,
        validCellNumber: false,
        errorMessage: ''
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) {
        this.data.tempOrderId = options.id
        var that = this
        app.loginPromiseNew.then(function(resolve){
            console.log('get profile:', resolve)
            if (resolve == null || resolve.cellNumber == null || resolve.cellNumber.trim() == ''){
                that.setData({validCellNumber: true})
            }
            else {
                that.placeOrder()
            }
        })


    },

    placePayOrder: function(orderId){
      var that = this
      var getOrderUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/GetOrderOnline/' + orderId + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getOrderUrl,
        method: 'GET',
        success:(res)=>{
          console.log('Get Order:', res)
          if (res.data.pay_state == 0){
            var wepayUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/Pay/' + orderId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
            wx.request({
              url: wepayUrl,
              method: 'GET',
              success:(res)=>{
                console.log('prepay', res)
                var wepay = res.data
                wx.requestPayment({
                  nonceStr: wepay.nonce,
                  package: 'prepay_id=' + wepay.prepay_id,
                  paySign: wepay.sign,
                  timeStamp: wepay.timestamp,
                  signType: 'RSA',
                  success: (res) => {
                    console.log('pay success', res)  
                  }
                })
              }
            })
          }
          else{
            if (res.data.pay_state == 1){
              that.setData({errorMessage: '此订单已经支付。'})
            }
            else{
              that.setData({errorMessage: '订单状态异常。'})
            }
          }
        }
      })
    },

    placeOrder: function() {
        var that = this
        var getOrderTempUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlineTemp/GetOrderOnlineTemp/' + this.data.tempOrderId + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getOrderTempUrl,
          method: 'GET',
          success:(res) =>{
              var orderId = 0
              try{
                
                orderId = parseInt(res.data.online_order_id)
                if (isNaN(orderId))
                {
                    orderId = 0

                }
              }
              catch{

              }
              if (orderId == 0){
                var placeOrderUrl = 'https://' + app.globalData.domainName.trim() 
                + '/api/place_online_order_temp.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
                + '&id=' + this.data.tempOrderId
                wx.request({
                  url: placeOrderUrl,
                  method: 'GET',
                  success:(res)=>{
                    orderId = res.data.order_id
                    that.placePayOrder(orderId)
                  }
                })
              }
              else{
                that.placePayOrder(orderId)

              }
          }
        })



    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function () {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function () {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function () {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom: function () {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function () {

    },
    cellUpdate: function(){
        console.log('cell number updated.')
        this.placeOrder()
    }
})