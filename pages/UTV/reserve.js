// pages/UTV/reserve.js
const app = getApp()
const util = require('../../utils/util')
Page({

  /**
   * Page initial data
   */
  data: {
    scene: 0,

  },

  prev(){
    var that = this
    var scene = that.data.scene
    scene--
    that.setData({scene: scene})
  },

  next(){
    var that = this
    var scene = that.data.scene
    scene++
    that.setData({scene: scene})
  },

  selectDate(e){
    console.log('date change', e)
    var that = this
    that.setData({reserveDate: e.detail.value})
    that.getTrips()
  },

  getTrips(){
    var that = this
    var getTripUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetTrips/1?date=' + that.data.reserveDate
    wx.request({
      url: getTripUrl,
      success:(res)=>{
        var tripList = res.data
        var tripListRange = []
        for(var i = 0; i < tripList.length; i++){
          tripListRange.push(tripList[i].trip_name)
        }
        that.setData({tripList: tripList, tripListRange: tripListRange, tripIndex: 0})
        that.getVechicleNum()
      }
    })
  },



  selectTrip(e){
    console.log('trip selected', e)
    var that = this
    that.setData({tripIndex: parseInt(e.detail.value)})
    that.getVechicleNum()
  },

  getVechicleNum(){
    var that = this
    var tripId = that.data.tripList[that.data.tripIndex].id
    var getNumUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetAvailableVehicleNum/' + tripId.toString()
    wx.request({
      url: getNumUrl,
      method: 'GET',
      success:(res)=>{
        console.log('get ava num', res)
        var availableNum = res.data
        var availableRange = []
        for(var i = 1; i <= availableNum; i++){
          availableRange.push(i)
        }
        that.setData({availableRange: availableRange, vehicleNum: 1})
      }
    })
  },

  selectNum(e){
    var that = this
    var vehicleNum = parseInt(e.detail.value)
    vehicleNum++
    that.setData({vehicleNum: vehicleNum})
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var reserveStartDate = new Date()
    var reserveEndDate = new Date()
    reserveEndDate.setDate(reserveEndDate.getDate()+30)
    that.setData({reserveStartDate: util.formatDate(reserveStartDate), 
      reserveEndDate: util.formatDate(reserveEndDate), reserveDate: util.formatDate(reserveStartDate)})
    that.getTrips()
    
    console.log('date', util.formatDate(reserveStartDate))
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