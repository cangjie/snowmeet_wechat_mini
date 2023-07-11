// pages/UTV/my_reserve_info.js
const app = getApp()
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
   
  },

  getReserve(id){
    var that = this
    var getReserveUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetReserve/' 
      + id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getReserveUrl,
      method: 'GET',
      success:(res)=>{
        console.log('get reserve', res)
        if (res.statusCode != 200){
          return
        }
        var reserve = res.data
        reserve.trip_dateStr = util.formatDate(new Date(reserve.trip_date))
        that.setData({reserve: res.data})
        that.getAvailableNum(reserve.trip_id)
      }
    })
  },

  getAvailableNum(tripId){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetAvailableVehicleNum/' + tripId
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        console.log('get avail num', res)
        if (res.statusCode != 200){
          return
        }
        that.setData({totalNum: parseInt(res.data)})
        that.getLockedNum(tripId)
      }
    })
  },

  getLockedNum(tripId){
    var that = this
    var reserve = that.data.reserve
    var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetLockedNumForTrip/' + tripId + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      success:(res)=>{
        console.log('get locked num', res)
        if (res.statusCode != 200){
          return
        }
        that.setData({lockedNum: parseInt(res.data)})
        that.getSchedule(reserve.id)
      }
    })
  },

  getSchedule(id){
    var that = this
    var getScheduleUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetScheduleForReserve/' 
    + id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getScheduleUrl,
      success:(res)=>{
        console.log('get schedule', res)
        if (res.statusCode != 200){
          return
        }
        var schedule = res.data
        
        //that.setData({scheduleList: scheduleList})
        var depositTotal = 0
        var depositTotalDiscount = 0
        var depositTotalFinal = 0
        for(var i = 0; i < schedule.length; i++){
          that.computeSchedule(schedule[i])
          depositTotal += parseFloat(schedule[i].deposit)
          depositTotalDiscount += parseFloat(schedule[i].deposit_discount)
          depositTotalFinal += (parseFloat(schedule[i].deposit) - parseFloat(schedule[i].deposit_discount))
        }
        that.setData({depositTotal: depositTotal, depositTotalDiscount: depositTotalDiscount, depositTotalFinal,
          depositTotalStr: util.showAmount(depositTotal), depositTotalDiscountStr: util.showAmount(depositTotalDiscount),
          depositTotalFinalStr: util.showAmount(depositTotalFinal), schedule: schedule})
      }
    })
  },

  computeSchedule(schedule){
    //var that = this
    schedule.depositStr = util.showAmount(schedule.deposit)
    schedule.deposit_final = schedule.deposit - schedule.deposit_discount
    schedule.deposit_discountStr = util.showAmount(schedule.deposit_discount)
    schedule.deposit_finalStr = util.showAmount(schedule.deposit_final)
    schedule.charge_final = schedule.charge - schedule.charge_discount - schedule.ticket_discount
    schedule.charge_finalStr = util.showAmount(schedule.charge_final)
    
  },

  pay(){
    var that = this
    var reserve = that.data.reserve
    var payUrl = 'https://' + app.globalData.domainName + '/core/UTV/PayDepositByTencent/' + reserve.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: payUrl,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var nonce = res.data.nonce
        var prepay_id = res.data.prepay_id
        var sign = res.data.sign
        var timeStamp = res.data.timeStamp
        wx.requestPayment({
          nonceStr: nonce,
          package: 'prepay_id=' + prepay_id,
          paySign: sign,
          timeStamp: timeStamp,
          signType: 'MD5',
          success:(res)=>{
            console.log('pay', res)
            var reserve = that.data.reserve
            reserve.status = '已付押金'
            that.setData({reserve: reserve})
            that.getSchedule(reserve.id)
            wx.showToast({
              title: '支付成功，请填写乘客信息。',
              icon: 'success',
              
            })
          }
        })
      }
    })
    
  },

  fillInfo(e){
    
    var id = e.currentTarget.id
    wx.redirectTo({
      url: 'fill_vehicle_info?id=' + id,
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(reslve){
      that.getReserve(options.id)
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