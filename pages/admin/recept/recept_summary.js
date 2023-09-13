// pages/admin/recept/recept_summary.js
const app = getApp()
Page({

  data: {

  },
  setPaid(){
    var that = this
    var recept = that.data.recept

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

  /*
  setRentPaid(rentOrderId){
    var that = this
    var setUrl = 'https://' + app.globalData.domainName + '/core/Rent/SetPaidManual/' + rentOrderId + '?payMethod=' + encodeURIComponent(that.data.payMethod) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      method: 'GET',
      success:(res)=>{
          if (res.statusCode != 200){
              return
          }
          wx.showToast({
            title: '支付成功',
            icon: 'success'
          })
      }
    })
  },
*/

  setPayMethod(e){
    console.log('pay method selected', e)
    var that = this
    var payMethod = e.detail.payMethod
    var payQrCode = ''
    var recept = that.data.recept
    if (recept == undefined){
        return null
    }
    switch(payMethod){
        case '微信支付':
            payQrCode = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=pay_recept_id_' + recept.id
            break
        case '支付宝支付':
            payQrCode = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=pay_recept_id_' + recept.id
            break
        default:
            break
    }
    that.setData({payQrCode: payQrCode, payMethod: payMethod})
  },

  checkScan(){
    var that = this
    var checkScanUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetScanInfo/' + that.data.actId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: checkScanUrl,
      success:(res)=>{
        console.log('check scan', res)
        if (res.statusCode != 200 && res.statusCode != 404){
          clearInterval(that.data.interVal)
        }
        else if (res.statusCode == 200){
          clearInterval(that.data.interVal)
          var scan = res.data
          var needJump = false
          if (scan.scan ==1){

            var openId = res.data.miniAppUser.open_id
            var recept = that.data.recept
            var setUrl = 'https://' + app.globalData.domainName + '/core/Recept/UpdateReceptOpenId/' + recept.id + '?openId=' + encodeURIComponent(openId) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)

            wx.request({
              url: setUrl,
              method: 'GET',
              success:(res)=>{
                  console.log('recept open id update', res)
                  if (res.statusCode != 200){
                      return
                  }
                  var recept = res.data
                  that.setData({recept: recept})
              }
            })

          }
        }
      },
      fail:(res)=>{
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
              default:
                break
            }
            
            if (recept.open_id == ''){
            
                var getScanIdUrl = 'https://' + app.globalData.domainName + '/core/ShopSaleInteract/GetInterviewId?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
                wx.request({
                  url: getScanIdUrl,
                  method: 'GET',
                  success:(res)=>{
                    if (res.statusCode != 200){
                        return
                      }
                      var id = res.data
                      if (id <= 0){
                        return
                      }
                      var interVal = setInterval(that.checkScan, 1000)
                      var qrcodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_wechat_temp_qrcode.aspx?scene=recept_interact_id_' + id)
                      that.setData({qrcodeUrl: qrcodeUrl, interVal: interVal, actId: id})
                  }
                })
                
            }
            that.setData({recept: recept, needPay: needPay, zeroPay: zeroPay})
            
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