const util = require("../../../utils/util")

// pages/admin/expierence/ expierence_refund.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    id: '0',
    role: '',
    refund: false,
    memo: '',
    refundAmount: 0,
    message: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    this.data.id = options.id
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getInfoUrl = 'https://' + app.globalData.domainName + '/core/Experience/GetExperienceTemp/' + that.data.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) //+ '&id=' + that.data.id
      wx.request({
        url: getInfoUrl,
        success: (res) => {
          if (res.statusCode == 200) {
            var expierenceInfo = res.data
            var endTime = new Date(expierenceInfo.end_time)
            expierenceInfo.endTimeStr = endTime.getFullYear().toString() + '-' + (endTime.getMonth() + 1).toString() + '-' + endTime.getDay().toString() + ' ' + endTime.getHours().toString() + ':' + endTime.getMinutes().toString()
            var assetPhotosArr = []
            if (expierenceInfo.asset_photos != '') {
              assetPhotosArr = expierenceInfo.asset_photos.split(',')
            }
            var credentialPhotosArr = []
            if (expierenceInfo.guarantee_credential_photos != '') {
              credentialPhotosArr = expierenceInfo.guarantee_credential_photos.split(',')
            }
            that.setData({expierence_info: expierenceInfo, role: app.globalData.role, assetPhotosArr: assetPhotosArr, credentialPhotosArr: credentialPhotosArr, refundAmount: expierenceInfo.order_real_pay_price})
          }
        }
      })
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
  changeInput: function(e) {
    var id = e.currentTarget.id
    switch(id) {
      case 'memo':
        this.data.memo = e.detail.value
        break
      case 'refund_amount':
        var amount = e.detail.value
        if (parseFloat(amount) > parseFloat(this.data.expierence_info.order_real_pay_price)) {
          this.setData({refundAmount: this.data.expierence_info.order_real_pay_price})
        }
        else {
          this.data.refundAmount = e.detail.value
        }
        break
      default:
        break
    }
  },
  submit: function(e) {
    var that = this
    var refundPromise = new Promise(function(resolve) {
      var refundUrl = 'https://' + app.globalData.domainName + '/core/experience/refund/' + that.data.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&amount=' + that.data.refundAmount.toString() + '&memo=' + encodeURIComponent(that.data.memo)
      wx.request({
        url: refundUrl,
        success: (res) => {
          resolve(res.data)
        }
      })
    })
    refundPromise.then(function(resolve){
      if (util.exists(resolve.order) && util.exists(resolve.order.refunds)) {
        var refund = false
        for(var i = 0; i < resolve.order.refunds.length; i++){
          if (util.exists(resolve.order.refunds[i].refund_id) && resolve.order.refunds[i].refund_id != ''){
            refund = true
            break
          }
        }
        if (refund){
          that.setData({refund: true, message: '退款成功'})

        }
        else {
          that.setData({refund: true, message: '退款失败'})
        }
      }
      /*
      else {
        //that.setData({refund: true, message: resolve.error_message})
        var getNewUrl = 'https://' + app.globalData.domainName + '/core/Experience/GetExperience/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getNewUrl,
          method: 'GET',
          success: (res)=>{
            var outTradeNo = res.data.order.out_trade_no
            var exp = res.data
            var refundUrl = 'https://' + app.globalData.domainName + '/core/WepayOrder/Refund/' + outTradeNo + '?amount=' + (100 * parseInt(that.data.refundAmount.toString())).toString() + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
            wx.request({
              url: refundUrl,
              method: 'GET',
              success:(res)=>{
                that.setData({refund: true, message: '退款成功'})
                var updateUrl = 'https://' + app.globalData.domainName + '/core/Experience/PutExperience/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
                exp.return_memo = that.data.memo
                exp.refund_amount = that.data.refundAmount
                wx.request({
                  url: updateUrl,
                  method: 'PUT',
                  data: exp,
                  success:(res)=>{

                  }
                })
              }
            })
          }
        })
      }
      */
    })
  }
})