// pages/UTV/reserve.js
const app = getApp()
const util = require('../../utils/util')
Page({

  /**
   * Page initial data
   */
  data: {
    scene: 0,
    lineType: '',
    cell: '',
    name: '',
    valid: false,
    tripId: 0,
    vehicleNum: 0
  },

  checkValid(){
    var that = this
    if (that.data.tripId == 0 || that.data.vehicleNum == 0 || that.data.lineType == '' || that.data.cell == '' || that.data.name == ''){
      that.setData({valid: false})
    }
    else{
      that.setData({valid: true})
    }
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
        that.setData({tripList: tripList, tripListRange: tripListRange, tripIndex: 0, tripId: tripList[0].id})
        that.getVechicleNum()
      }
    })
  },



  selectTrip(e){
    console.log('trip selected', e)
    var that = this
    var tripList = that.data.tripList
    that.setData({tripIndex: parseInt(e.detail.value), tripId: tripList[e.detail.value]})
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
  selectLine(e){
    console.log('select line', e.detail.value)
    var that = this
    that.setData({lineType: e.detail.value})
    that.checkValid()
  },

  getCell(e){
    console.log('get cell', e)
    var that = this
    if(e.detail.errMsg=='getPhoneNumber:ok')
    {
      var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateUserInfo?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)+'&encData='+encodeURIComponent(e.detail.encryptedData)+'&iv='+encodeURIComponent(e.detail.iv)
      wx.request({
        url: url,
        method: 'GET',
        success: (res) => {
          console.log('get phone number', res)
          that.setData({cell: res.data.cell_number})
          that.checkValid()
          
        }
      })
    }
  },

  inputName(e){
    var that = this
    that.setData({name: e.detail.value})
    that.checkValid()
  },

  submit(){
    var that = this
    var submitUrl = 'https://' + app.globalData.domainName + '/core/UTV/Reserve/' + that.data.tripId 
      + '?lineType=' + encodeURIComponent(that.data.lineType) + '&vehicleNum=' + that.data.vehicleNum
      + '&cell=' + that.data.cell + '&name=' + encodeURIComponent(that.data.name) + '&source=wechat'
      + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: submitUrl,
      success:(res)=>{
        if (res.statusCode == 200 && parseInt(res.data)){
          console.log('reserve success', res)
          that.setData({scene: 1})
        }
      }
    })
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
    app.loginPromiseNew.then(function(resolve){
      that.setData({cell: app.globalData.userInfo.cell_number, name: app.globalData.userInfo.real_name})
      
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