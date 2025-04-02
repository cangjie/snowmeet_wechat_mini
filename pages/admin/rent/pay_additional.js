// pages/admin/rent/pay_additional.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    payMethod: '',
    amount: '',
    reason: '',
    valid: false,
    paying: false
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
  
  setReason(e){
    var that = this
    that.setData({reason: e.detail.value})
    that.checkValid()
  },
  inputReason(e){
    var that = this
    that.setData({reason: e.detail.value})
    that.checkValid()
  },
  setAmount(e){
    var that = this
    var value = e.detail.value
    that.setData({amount: value})
    that.checkValid()
  },
  checkValid(){
    var that = this
    var amount = parseFloat(that.data.amount)
    if (!isNaN(amount) && amount > 0 && that.data.reason != '' && that.data.reason != '其他' ){
      that.setData({valid: true})
    }
    else {
      that.setData({valid: false})
    }
  },
  confirmPay(){
    var that = this
    wx.showModal({
      title: '确认追加收款',
      content: '金额：' + util.showAmount(that.data.amount) + ' 原因：' + that.data.reason,
      complete: (res) => {
        if (res.cancel) {
          
        }
        if (res.confirm) {
          var url = 'https://' + app.globalData.domainName + '/core/Rent/CreateAdditionalPayment/' + that.data.id + '?amount=' + that.data.amount + '&reason=' + encodeURIComponent(that.data.reason) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: url,
            method: 'GET',
            success:(res)=>{
              if (res.statusCode != 200){
                return
              }
              console.log('add pay', res.data)
              that.setData({paying: true})
              var addPay = res.data
              that.setData({addPay})
              that.getQrCode() 
            }
          })
        }
      }
    })
  },
  back(){
    var that = this
    that.setData({paying: false, amount: '', reason: ''})
    that.checkValid()
  },
  getQrCode(){
    var that = this
    var addPay = that.data.addPay
    var scene = 'pay_rent_add_' + addPay.id.toString()
    var getQRUrl = 'https://wxoa.snowmeet.top/api/OfficialAccountApi/GetOAQRCodeUrl?content=' + scene
    wx.request({
      url: getQRUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        that.setData({qrcodeUrl: res.data})
        var interval = setInterval(() => {
          that.checkPaid()
        }, 1000)
        that.setData({interval})
      }
    })
  },
  checkPaid(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/Rent/GetAdditionalPayment/' + that.data.addPay.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var payment = res.data
        if (payment.is_paid == 1){
          clearInterval(that.data.interval)
          wx.showToast({
            title: '支付成功',
            icon:'success',
            duration: 3000
          })
          wx.navigateTo({
            url: 'rent_detail?id=' + payment.rent_list_id,
          })
        }
      }
    })
  },
  setConfirmPay(e){
    var that = this
    var addPay = that.data.addPay
    var url = 'https://' + app.globalData.domainName + '/core/Rent/ConfirmAdditionPayment/' + addPay.id + '?payMethod=' + encodeURIComponent(that.data.payMethod) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET'
    })
  }
})