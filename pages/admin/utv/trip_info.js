// pages/admin/utv/trip_info.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    sort:'reserve',
    tabs:[{title:'tab1🟢'}, {title:'tab2🔴'}]
  },

  gotoDetail(e){
    wx.navigateTo({
      url: 'reserve_info_detail?id=' + e.currentTarget.id,
    })
  },

  getData(id, sort){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetSchedulesForTrip/' + id.toString() 
      + '?sort=' + sort + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var canDepart = true
        var schedules = res.data
        var tabs = []
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
          if (driver != null && driver.driver_license != null && driver.driver_license != ''){
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
          s.canGo = canGo
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

          var title = '车号:' + ((s.car_no == '') ? '未分配' : s.car_no).trim()
            + (canGo?'🟢':'🔴')
          tabs.push({title: title})

        }
        that.setData({schedules: schedules, canDepart: canDepart, tabs: tabs, activeTab: 0})
      }
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
          that.getData(options.id, that.data.sort)
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