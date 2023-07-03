// pages/admin/utv/reserve_info_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    tabs: [{title: '押金收费'}, {title: '司乘信息'}, {title: '驾照保险'}, {title: '安全检查'},{title: '归还退费'}],
    tabIndex: 0
  },

  updateSchedule(){
    var that = this
    var schedule = that.data.schedule
    var updateUrl = 'https://' + app.globalData.domainName + '/core/UTV/UpdateSchedule/' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'POST',
      data: schedule,
      success:(res)=>{
        console.log('schedule update', res)
        if (res.statusCode != 200){
          return
        }
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })
      }
    })
  },


  modFloatValue(e){
    var that = this
    var schedule = that.data.schedule
    var id = e.currentTarget.id
    var value = parseFloat(e.detail.value)
    switch(id){
      case 'deposit_discount':
        schedule.deposit_discount = value
        break
      default:
        break
    }
    that.computeSchedule(schedule)
    that.setData({schedule: schedule})
  },

  getSchedule(id){
    var that = this
    var getScheduleUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetSchedule/' 
    + id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getScheduleUrl,
      success:(res)=>{
        console.log('get schedule', res)
        if (res.statusCode != 200){
          return
        }
        var schedule = res.data
        that.computeSchedule(schedule)
        that.setData({schedule: schedule})
        that.getReserve(schedule.reserve_id)
      }
    })
  },

  computeSchedule(schedule){
    schedule.depositStr = util.showAmount(schedule.deposit)
    schedule.deposit_final = schedule.deposit - schedule.deposit_discount
    schedule.deposit_finalStr = util.showAmount(schedule.deposit_final)
    schedule.charge_final = schedule.charge - schedule.charge_discount - schedule.ticket_discount
    schedule.charge_finalStr = util.showAmount(schedule.charge_final)
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
      }
    })
  },


  onChange(e){
    console.log('tab change', e)
    var that = this
    that.setData({tabIndex: e.detail.index})
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    console.log('id', options.id)
    app.loginPromiseNew.then(function(resolve){
      that.getSchedule(options.id)
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