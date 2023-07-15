// pages/admin/utv/trip_info.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    activeTab: 0,
    sort:'reserve',
    tabs:[{title:'tab1🟢'}, {title:'tab2🔴'}]
  },

  depart(){
    var that = this
    var trip = that.data.trip
    trip.status = '已发车'
    var updateUrl = 'https://' + app.globalData.domainName + '/core/UTV/UpdateTrip?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: trip,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        that.getData(trip.id, '')
      }
    })
  }, 

  onChange(e){
    var that = this
    
    that.setData({activeTab: e.detail.index})
  },

  changeSort(e){
    var that = this
    var value = e.detail.value
    that.setData({sort: value})
    var trip = that.data.trip
    if (trip != null){
      that.getData(trip.id, that.data.sort)
    }
  },

  inputKm(e){
    var id = e.currentTarget.id.toString().split('_')[1]
    var type = e.currentTarget.id.toString().split('_')[0]
    var that = this
    var value = e.detail.value
    if (isNaN(value)) {
      wx.showToast({
        title: '请输入正确的公里数。',
        icon:'error'
      })
      return
    }
    var schedules = that.data.schedules
    for(var i = 0; i < schedules.length; i++){
      if (schedules[i].id == parseInt(id)){
        var s = schedules[i]
        if (type == 'departkm'){
          s.start_mile = value
        }
        if (type == 'arrivekm'){
          s.end_mile = value
        }
        var postUrl = 'https://' + app.globalData.domainName + '/core/UTV/UpdateSchedule/' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: postUrl,
          method: 'POST',
          data: s,
          success:(res)=>{
            console.log('schedule updated', res)
            var trip = that.data.trip
            that.getData(trip.id, that.data.sort)
          }
        })
      }
    }
    
  },

  gotoVehicleSchedule(id){
    var id = id.currentTarget.id
    wx.navigateTo({
      url: 'reserve_info_detail?id=' + id + '&tabIndex=3'
    })
  },

  gotoReserve(id){
    var id = id.currentTarget.id
    wx.navigateTo({
      url: 'reserve_info?id=' + id ,
    })
  },

  setCarNo(e){
    var that = this
    var id = e.currentTarget.id.toString()
    var value = that.data.carNoArr[e.detail.value]
    var schedules = that.data.schedules
    if (value == '未分配'){
      value = ''
    }
    var s = {}
    for(var i = 0; i < schedules.length; i++){
      if (schedules[i].id == parseInt(id)){
        schedules[i].car_no = value
        s = schedules[i]
        break
      }
    }
    that.setData({schedules: schedules})
    that.getAvaliableVehicles(schedules)
    var postUrl = 'https://' + app.globalData.domainName + '/core/UTV/UpdateSchedule/' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: postUrl,
      method: 'POST',
      data: s,
      success:(res)=>{
        console.log('schedule updated', res)
        var trip = that.data.trip
        that.getData(trip.id, that.data.sort)
      }
    })
  },

  getAvaliableVehicles(schedules){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetAvailableVehicles'
    wx.request({
      url: getUrl,
      success:(res)=>{
        console.log('get vehicles', res)
        if (res.statusCode != 200){
          return
        }
        var carNoArr = ['未分配']
        for(var i = 0; i < res.data.length; i++){
          var exists = false
          var carNo = res.data[i].name
          for(var j = 0; j < schedules.length; j++){
            if (schedules[j].car_no == carNo){
              exists = true
              break;
            }
          }
          if (!exists){
            carNoArr.push(res.data[i].name)
          }
        }
        that.setData({carNoArr: carNoArr})
      }
    })
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
          if (!s.canGo){
            canDepart = false
          }
          if (s.car_no == ''){
            s.car_no = '未分配'
          }

          var title = (s.canGo?'🟢':'🔴') + '车号:' + ((s.car_no == '') ? '未分配' : s.car_no).trim()
          tabs.push({title: title})

        }
        that.setData({schedules: schedules, canDepart: canDepart, tabs: tabs})
        that.getAvaliableVehicles(schedules)
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
          that.getData(trip.id, that.data.sort)
        }
      })
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {
    console.log('onReady')
  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {
    console.log('onShow')
    var that = this
    var trip = that.data.trip
    if (trip != null){
      that.getData(trip.id, that.data.sort)
    }
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