// pages/admin/utv/trip_info.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },

  gotoDetail(e){
    wx.navigateTo({
      url: 'reserve_info_detail?id=' + e.currentTarget.id,
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetTrip/' + options.id.toString()
      wx.request({
        url: getUrl,
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var trip = res.data
          trip.trip_dateStr = util.formatDate(new Date(trip.trip_date))
          that.setData({trip: trip})
          getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetSchedulesForTrip/' 
            + options.id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: getUrl,
            success:(res)=>{
              if (res.statusCode != 200){
                return
              }
              var canDepart = true
              var schedules = res.data
              for(var i = 0; i < schedules.length; i++){
                var s = schedules[i]
                var driver = schedules[i].driver
                var passenger = schedules[i].passenger
                var driverInfoStatus = '不全'
                var passengerInfoStatus = '不全'
                var licenseStatus = '不全'
                var insuranceStatus = '不全'
                var canGo = true
                if (driver != null 
                  && driver.real_name != ''
                  && driver.cell != ''
                  && driver.gender != ''){
                  driverInfoStatus = '完整'
                }
                else{
                  canGo = false
                }
                if (passenger == null){
                  passengerInfoStatus = '--'
                }
                else if (passenger.real_name != ''
                && passenger.cell != ''
                && passenger.gender != ''  ){
                  passengerInfoStatus = '完整'
                }
                else{
                  canGo = false
                }
                if (driver.driver_license != ''){
                  licenseStatus = '完整'
                }
                else{
                  canGo = false
                }
                if (s.driver_insurance != '' 
                && (passenger == null || (passenger != null && s.passenger_insurance != '') )){
                  insuranceStatus = '完整'
                }
                else{
                  canGo = false
                }
                s.driverInfoStatus = driverInfoStatus
                s.passengerInfoStatus = passengerInfoStatus
                s.licenseStatus = licenseStatus
                s.insuranceStatus = insuranceStatus
                s.canGo = canGo
                if (!canGo){
                  canDepart = false
                }
                if (s.car_no == ''){
                  s.car_no = '未分配'
                }
              }
              that.setData({schedules: schedules, canDepart: canDepart})
            }
          })
        }
      })
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