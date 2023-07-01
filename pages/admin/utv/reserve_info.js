// pages/admin/utv/reserve_info.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    isEditing: 0,
    reserve: {},
    totalNum: 10,
    lockedNum: 0,
    unPaidNum: 0,
    availNum: 10,
    tripVehicleList: [],
    reserveVehicleList: [],
    unitDeposit: 3000
  },

  setVehicleNum(e){
    var that = this
    var num = parseInt(e.detail.value) + 1
    var reserve = that.data.reserve
    var deposit = that.data.unitDeposit
    reserve.vehicle_num = num
    var totalDeposit = deposit * num
    that.setData({reserve: reserve, totalDeposit: totalDeposit, totalDepositStr: util.showAmount(totalDeposit)})
  },

  fillNumPicker(){
    var that = this
    var availNum = parseInt(that.data.availNum)
    var reserve = that.data.reserve
    var numPickerList = []
    for(var i = 1; i <= availNum; i++){
      numPickerList.push(i.toString())
    }
    that.setData({numPickerList: numPickerList})
  },

  setInput(e){
    var v = e.detail.value
    var id = e.currentTarget.id
    var that = this
    var reserve = that.data.reserve
    switch(id){
      case 'name':
        reserve.real_name = v
        break
      case 'cell':
        reserve.cell = v
        break
      case 'memo':
        reserve.memo = v
        break
      case 'lineType':
        reserve.line_type = v
        break
      default:
        break
    }
    that.setData({reserve: reserve})
  },

  changeTrip(e){
    console.log('change trip', e)
    var that = this
    var reserve = that.data.reserve
    var tripList = that.data.tripList
    var idx = parseInt(e.detail.value)
    reserve.trip_id = tripList[idx].id
    reserve.trip_name = tripList[idx].trip_name
    that.setData({reserve: reserve, tripIndex: idx})
    that.getTripVehicle()
    that.fillNumPicker()
  },

  changeDate(e){
    console.log('change date', e)
    var that = this
    that.getTrips(e.detail.value)
    var reserve = that.data.reserve
    reserve.trip_date_str = e.detail.value
    that.setData({reserve: reserve})
    that.getTrips(reserve.trip_date_str)
  },


  getTrips(date){
    var that = this
    var getTripUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetTrips/1?date=' + date
    wx.request({
      url: getTripUrl,
      success:(res)=>{
        var tripList = res.data
        var tripListRange = []
        for(var i = 0; i < tripList.length; i++){
          tripListRange.push(tripList[i].trip_name)
        }
        var tripIndex = 0
        var reserve = that.data.reserve
        for(var i = 0; i < tripList.length; i++){
          if (tripList[i].id == reserve.trip_id){
            tripIndex = i
            break
          }
        }
        that.setData({tripList: tripList, tripListRange: tripListRange, tripIndex: tripIndex, tripId: tripList[0].id})
        that.fillNumPicker()
        //that.getVechicleNum()
      }
    })
  },

  getTripVehicle(){
    var that = this
    var tripId = parseInt(that.data.reserve.trip_id)
    var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetSchedulesForTrip/' 
    + tripId.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        console.log('get trip vehicle', res)
        if (res.statusCode != 200){
          return
        }
        var vList = res.data
        var unPaidNum = 0
        var lockedNum = 0
        for(var i = 0; i < vList.length; i++){
          var v = vList[i]
          switch(v.status.trim()){
            case '待支付':
              unPaidNum++
              break
            case '锁定':
            case '候补':
              lockedNum++
              break
            default:
              break
          }
        }
        that.setData({tripVehicleList: vList, unPaidNum: unPaidNum, lockedNum: lockedNum})
        var getTripNumUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetAvailableVehicleNum/' + tripId.toString()
        wx.request({
          url: getTripNumUrl,
          method: 'GET',
          success: (res)=>{
            console.log('get trip ava num', res)
            if (res.statusCode != 200){
              return
            }
            var totalNum = parseInt(res.data)
            var availNum = totalNum - lockedNum
            that.setData({totalNum: totalNum, availNum: availNum})
            var getDepositUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetUnitDeposit'
            wx.request({
              url: getDepositUrl,
              success: (res)=>{
                var unitDeposit = parseFloat(res.data)
                var totalDeposit = unitDeposit * parseInt(that.data.reserve.vehicle_num)
                var totalDepositStr = util.showAmount(totalDeposit)
                that.setData({unitDeposit: unitDeposit, totalDeposit: totalDeposit, totalDepositStr: totalDepositStr})
              }
            })
          }
        })
      }
    })
  },


  gotoEdit(){
    var that = this
    var isEditing = that.data.isEditing
    if (isEditing == 0){
      isEditing = 1
    }
    else{
      isEditing = 0
    }
    that.setData({isEditing: isEditing})
    that.getTrips(that.data.reserve.trip_date)
  },

  gotoDetail(){
    wx.navigateTo({
      url: 'reserve_info_detail',
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var id = parseInt(options.id)
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getReserveUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetReserve/' + id.toString() 
        + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getReserveUrl,
        method: 'GET',
        success:(res)=>{
          console.log('get reserve', res)
          if (res.statusCode != 200){
            return
          }
          var reserve = res.data
          reserve.trip_date_str = util.formatDate(new Date(reserve.trip_date))
          that.setData({reserve: reserve})
          that.getTripVehicle()
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