// pages/admin/sale/mod_mi7_order_no.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    newOrderNum: '',
    newType: ''
  },

  input(e){
    var that = this
    var order = that.data.order
    order.mi7_code = e.detail.value
    that.setData({order})
  },
  submit(){
    var that = this
    var order = that.data.order
    var url = app.globalData.requestPrefix + 'order/UpdateRetail?sessionKey=' + app.globalData.sessionKey + '&scene=' + encodeURIComponent('修改七色米订单信息')
    util.performWebRequest(url, order).then((resolve)=>{
      var order = resolve
      //that.setData({order})
      that.getData()
    })
  },

  submit1(){
    var that = this
    var value = that.data.newOrderNum
    var order = that.data.order
    if (value!='' || that.data.newType != ''){
      var updateUrl = 'https://' + app.globalData.domainName + '/core/Mi7Order/ModMi7Order/' + order.id + '?orderNum=' + encodeURIComponent(value) + '&orderType=' + encodeURIComponent(that.data.newType) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)

      wx.request({
        url: updateUrl,
        method: 'GET',
        success:(res)=>{
          wx.showToast({
            title: '修改成功',
            success:(res)=>{
              wx.navigateTo({
                url: 'order_detail?id=' + order.order_id,
              })
            }
          })
        }
      })
    }
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
    var that = this
    app.loginPromiseNew.then(function (resolve){
      that.getData()
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

  },
  getData(){
    var that = this
    //var getMi7OrderUrl = 'https://' + app.globalData.domainName + '/core/Mi7Order/GetMi7OrderById/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    var getUrl = app.globalData.requestPrefix + 'Order/GetRetailDetail/' + that.data.id + '?sessionKey=' + app.globalData.sessionKey
    util.performWebRequest(getUrl, undefined).then((resolve)=>{
      var order = resolve
      order.sale_priceStr = util.showAmount(order.sale_price)
      order.deal_priceStr = util.showAmount(order.deal_price)
      for(var i = 0; order.logs && i < order.logs.length; i++){
        var log = order.logs[i]
        var logDate = new Date(log.create_date)
        log.date = util.formatDate(logDate)
        log.time = util.formatTimeStr(logDate)
        
      }
      that.setData({order})
    })
    /*
    wx.request({
      url: getMi7OrderUrl,
      method: 'GET',
      success:(res)=>{
        var order = res.data
        order.sale_price_str = util.showAmount(order.sale_price)
        order.real_charge_str = util.showAmount(order.real_charge)
        that.setData({order: res.data})
      }
    })
    that.getLogs()
    */
  },
  getLogs(){
    var that = this
    var getLogUrl = 'https://' + app.globalData.domainName + '/core/Mi7Order/GetLogs/' + that.data.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getLogUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var logs = res.data
        for(var i = 0; i < logs.length; i++){
          var log = logs[i]
          var createDate = new Date(log.create_date)
          log.dateStr = util.formatDate(createDate)
          log.timeStr = util.formatTimeStr(createDate)

        }
        that.setData({logs})
      }
    })
  },
  setType(e){
    var that = this
    var value = e.detail.value
    var order = that.data.order
    order.order_type = value
    that.setData({order})
  }
})