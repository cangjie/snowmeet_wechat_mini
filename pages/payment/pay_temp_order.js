// pages/payment/pay_temp_order.js
const app = getApp()
Page({

    /**
     * 页面的初始数据
     */
    data: {
        tempOrderId: 0,
        validCellNumber: false
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

    placeOrder: function() {
        var placeOrderUrl = 'https://' + app.globalData.domainName.trim() 
        + '/api/place_online_order_temp.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
        + '&id=' + this.data.tempOrderId
        wx.request({
          url: placeOrderUrl,
          method: 'GET',
          success: (res) => {
              if (res.data!=null && res.data.order_id != null 
                && res.data.order_id.toString() != '' && res.data.order_id > 0) {
                  var orderId = res.data.order_id
                  var notify = res.data.notify
                  console.log('new order id: ' + orderId.toString())
                  var wepayUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/Pay/' + app.globalData.sessionKey
                  + '?id=' + orderId + '&mchid=1&notify=' + encodeURIComponent(notify)
                  wx.request({
                    url: wepayUrl,
                    method: 'GET',
                    success: (res) => {
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