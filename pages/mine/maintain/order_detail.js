// pages/mine/maintain/order_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    needPay: false,
    paying: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var orderId = options.id
    var that = this
    app.loginPromiseNew.then(function (resolve){
      var getOrderUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetMaintainOrder/' + orderId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getOrderUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode == 200){
            console.log('get maintian order', res)
            var order = res.data
            order.dateStr = util.formatDate(new Date(order.orderDate))
            order.timeStr = util.formatTimeStr(new Date(order.orderDate))
            for(var i = 0; i < order.items.length; i++){
              var currentItem = order.items[i]
              var edgeStatus = '未开始'
              var waxStatus = '未开始'
              var unWaxStatus = '未开始'
              var moreStatus = '未开始'
              var finalStatus = ''
              for(var j = 0; j < currentItem.taskLog.length; j++){
                var log = currentItem.taskLog[j]
                switch(log.step_name){
                  case '修刃':
                    edgeStatus = log.status
                    break
                  case '打蜡':
                    waxStatus = log.status
                    break
                  case '刮蜡':
                    unWaxStatus = log.status
                    break
                  case '维修':
                    moreStatus = log.status
                    break
                  case '发板':
                    finalStatus = '已取回'
                    break
                  case '强行索回':
                    finalStatus = '强行索回'
                    break
                  default:
                    break
                }
              }
              currentItem.edgeStatus = edgeStatus
              currentItem.waxStatus = waxStatus
              currentItem.unWaxStatus = unWaxStatus
              currentItem.moreStatus = moreStatus
              currentItem.finalStatus = finalStatus
              
              currentItem.qrcodeUrl = 'https://' + app.globalData.domainName + '/core/MediaHelper/ShowImageFromOfficialAccount?img=' + encodeURIComponent('show_qrcode.aspx?qrcodetext=') + encodeURIComponent('https://mini.snowmeet.top/mapp/admin/maintain/task/' + currentItem.id)

            }
            var needPay = false
            /*
            if (options.paymentId!=undefined && order.order.pay_method == '微信支付' && order.order.payments != null && order.order.payments[0].status == '待支付'){
              needPay = true
            }
            */
            if (order.order != null && order.order.final_price * 100 > 0 && order.order.pay_state == 0){
              needPay = true
            }
            order.order.order_price_str = util.showAmount(order.order.order_price)
            order.order.ticket_amount_str = util.showAmount(order.order.ticket_amount)
            order.order.ticket_amount_str = util.showAmount(order.order.ticket_amount)
            order.order.final_price_str = util.showAmount(order.order.final_price)
            that.setData({order: order, needPay: needPay, paymentId: options.paymentId})
          }
        }
      })

    })
  },

  payOrder(){
    var that = this
    that.setData({paying: true})
    var paymentUrl = 'https://' + app.globalData.domainName + '/core/OrderPayment/CreatePayment/' + that.data.order.order.id + '?payMethod=' + encodeURIComponent('微信支付') + '&amount=0'
    wx.request({
      url: paymentUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          wx.showToast({
            title: '系统忙，请稍候。',
            icon: 'error'
          })
          return
        }
        that.setData({paymentId: res.data.id})
        that.pay()
      },
      fail:(res)=>{
        wx.showToast({
          title: '请关闭小程序重试',
          icon: 'error'
        })
      }
    })
  },

  pay(){
    var that = this
    that.setData({paying: true})
    var paymentUrl = 'https://' + app.globalData.domainName + '/core/OrderPayment/Pay/' + that.data.paymentId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: paymentUrl,
      method: 'GET',
      success:(res)=>{
        console.log(res)
        if (res.statusCode != 200){
          wx.showToast({
            title: '微信支付繁忙，请稍候。',
            icon:'error'
          })
          return
        }
        wx.requestPayment({
          nonceStr: res.data.nonce,
          package: 'prepay_id=' + res.data.prepay_id,
          paySign: res.data.sign,
          timeStamp: res.data.timestamp,
          signType: 'MD5',
          success:(res)=>{
            console.log(res)
            wx.showToast({
              title: '支付完成',
              icon: 'none',
              success:(res)=>{
                that.setData({needPay: false})
              }
            })
          },
          fail:(res)=>{
            console.log(res)
          }
        })
      },
      fail:(res)=>{
        wx.showToast({
          title: '请重启小程序重试',
          icon: 'error'
        })
      }
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