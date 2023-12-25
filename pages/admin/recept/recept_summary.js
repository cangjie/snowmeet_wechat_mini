// pages/admin/recept/recept_summary.js
const app = getApp()
Page({

  data: {
    haveSentMsg: false
  },
  setPaid(){
    var that = this
    var recept = that.data.recept

    if (that.data.payMethod == '微信支付' || that.data.payMethod == undefined || that.data.payMethod == null){
      return
    }

    var setUrl = 'https://' + app.globalData.domainName + '/core/Recept/SetPaidManual/' + recept.id.toString() + '?payMethod=' + encodeURIComponent(that.data.payMethod) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)

    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        wx.showToast({
          title: '支付成功',
          icon: 'success',
          success:(res)=>{
            switch(recept.recept_type){
              case '租赁下单':
                  //this.setRentPaid(recept.submit_return_id)
                  wx.redirectTo({
                    url: '../rent/rent_list',
                  })
                  break
              case '养护下单':
                wx.redirectTo({
                  url: '../maintain/task_list',
                })
                break
              default:
                  break
            }
          }
        })

      }
    })


    
  },


  setPayMethod(e){
    console.log('pay method selected', e)
    var that = this
    var payMethod = e.detail.payMethod
    var payQrCode = ''
    var recept = that.data.recept
    if (recept == undefined || recept == null){
        return null
    }
    switch(payMethod){
        case '微信支付':
            var scene = 'pay_recept_id_' + recept.id
            //payQrCode = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=pay_recept_id_' + recept.id
            var getQRUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + scene
            wx.request({
              url: getQRUrl,
              method: 'GET',
              success:(res)=>{
                
                var sentUrl = 'https://' + app.globalData.domainName + '/core/Recept/SendPaymentOAMessage/' 
                + recept.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
                if (!that.data.haveSentMsg){
                  wx.request({
                    url: sentUrl,
                    method: 'GET'
                  })
                }
                that.setData({payQrCode: res.data, haveSentMsg: true})
              }
            })
            var interVal = setInterval(that.checkPaid, 1000)
            that.setData({interVal: interVal})
            break
        case '支付宝支付':
            payQrCode = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=pay_recept_id_' + recept.id
            break
        default:
            //clearInterval(that.data.interVal)
            break
    }
    that.setData({payQrCode: payQrCode, payMethod: payMethod})
  },

  checkPaid(){
    var that = this
    var recept = that.data.recept
    if (recept == undefined || recept == null){
      return
    }
    var orderId = 0
    var jumpUrl = ''
    switch(recept.recept_type){
      case '租赁下单':
        orderId = recept.rentOrder.order_id
        jumpUrl = '../rent/rent_list'
        break
      case '养护下单':
        orderId = recept.maintainOrder.order.id
        jumpUrl = '/pages/admin/maintain/task_list'
        break
      default:
        break
    }
    if (orderId == 0){
      clearInterval(that.data.interVal)
      return
    }
    var getUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/GetOrderOnline/' 
      + orderId.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        console.log('get order', res.data)
        if (res.statusCode != 200){
          return
        }
        var order = res.data
        var paySuc = false
        if (order.pay_state == 1 && order.payments != undefined
          && order.payments != null && order.payments.length > 0){
            for(var j = 0; j < order.payments.length; j++){
              var payment = order.payments[j]
              if (payment.status == '支付成功' && payment.out_trade_no != undefined
              && payment.out_trade_no != null){
                paySuc = true
              }
            }
        }
        
      
        if (paySuc){
          wx.showToast({
            title: '支付成功',
            icon: 'success',
            duration: 2000
          })
          clearInterval(that.data.interVal)
          setTimeout(
            wx.redirectTo({
              url: jumpUrl
            })
          , 2000)

        }
      },
      fail:(res)=>{
        wx.showToast({
          title: '网络错误',
          icon:'error'
        })
        clearInterval(that.data.interVal)
      }
    })
  },



  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var id = options.id
    var that = this
    that.setData({id: id})
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
    app.loginPromiseNew.then(function (resolve){
        var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetRecept/' + that.data.id 
            + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getUrl,
          method: 'GET',
          success:(res)=>{
            if (res.statusCode != 200){
                return
            }
            var recept = res.data
            console.log('recept', recept)
            var needPay = true
            var zeroPay = false
            switch(recept.recept_type){
              case '租赁下单':
                if (recept.rentOrder.pay_option == '招待'){
                  needPay = false
                }
                else if (recept.rentOrder.order_id == 0){
                  zeroPay = true 
                }
                break
              case '养护下单':
                if (recept.maintainOrder.payOption == '招待'){
                  needPay = false
                }
                else if (recept.maintainOrder.orderId == 0){
                  zeroPay = true 
                }
                break
              default:
                break
            }
            that.setData({recept: recept, needPay: needPay, zeroPay: zeroPay})
            if (!needPay || zeroPay){
              that.setPaid()
            }
            
          }
        })
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

  }
})