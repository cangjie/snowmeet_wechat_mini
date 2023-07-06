// pages/UTV/fill_vehicle_info.js
const app = getApp()
const util = require('../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    tabs:[{title: '联系方式'},{title: '上传驾照'},{title: '购买保险'},{title: '分享代填'}],
    tabIndex: 0
  },

  tabChange(e){
    var that = this
    
    that.setData({tabIndex: e.detail.index})
  },

  getVehicleSchedule(id){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetSchedule/' 
      + id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var vehicleSchedule = res.data
        vehicleSchedule.car_noStr = (vehicleSchedule.car_no == '') ? '未分配' : vehicleSchedule.car_no
        that.setData({vehicleSchedule: vehicleSchedule})
        that.getTrip(vehicleSchedule.trip_id)
      }
    })
  },

  getTrip(id){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetTrip/' + id.toString()
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var trip = res.data
        trip.trip_dateStr = util.formatDate(new Date(trip.trip_date))
        that.setData({trip: trip})
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.getVehicleSchedule(options.id)
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