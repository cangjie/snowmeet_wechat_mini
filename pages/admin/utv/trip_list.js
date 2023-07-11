// pages/admin/utv/trip_list.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    currentDate: util.formatDate(new Date())
  },

  gotoDetail(e){
    //var that = this
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'trip_info?id=' + id,
    })
  },

  gotoAnyDay(e){
    var that = this
    var currentDate = new Date(e.detail.value)
    that.setData({currentDate: util.formatDate(currentDate)})
    that.getData()
  },

  gotoYesterday(){
    var that = this
    var currentDate = new Date(that.data.currentDate)
    currentDate.setDate(currentDate.getDate() - 1)
    that.setData({currentDate: util.formatDate(currentDate)})
    that.getData()
  },

  gotoTomorrow(){
    var that = this
    var currentDate = new Date(that.data.currentDate)
    currentDate.setDate(currentDate.getDate() + 1)
    that.setData({currentDate: util.formatDate(currentDate)})
    that.getData()
  },

  newTrip(){
    wx.navigateTo({
      url: 'trip_add',
    })
  },
  gotoArrive(){
    wx.navigateTo({
      url: 'trip_info',
    })
  },

  getData(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName 
      + '/core/UTV/GetTripsDetail/' + that.data.currentDate
      + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var trips = res.data
        for(var i = 0; i < trips.length; i++){
          var locked = 0
          var waiting = 0
          var trip = trips[i]
          trip.trip_date = util.formatDate(new Date(trip.trip_date))
          trip.total = trip.vehicleSchedule.length
          for(var j = 0; j < trip.vehicleSchedule.length; j++){
            var s = trip.vehicleSchedule[j]
            switch(s.status){
              case '锁定':
                locked++
                break
              case '候补':
                waiting++
                break
              default:
                break
            }
            
          }
          trip.locked = locked
          trip.waiting = waiting
        }
        that.setData({trips: trips})
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.getData()
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