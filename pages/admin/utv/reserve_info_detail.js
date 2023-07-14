// pages/admin/utv/reserve_info_detail.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    tabs: [{title: '押金收费'}, {title: '司乘信息'}, {title: '驾照'}, {title: '保险'}, {title: '租赁'},{title: '退费'}],
    activeTab: 0,
    driver:{
      id: 0,
      user_id: 0,
      wechat_open_id: '',
      tiktok_open_id: '',
      real_name:'',
      cell: '',
      is_adult: 1,
      gender: '',
      contact_name: '',
      contact_cell: ''
    },
    passenger:{
      id: 0,
      user_id: 0,
      wechat_open_id: '',
      tiktok_open_id: '',
      real_name:'',
      cell: '',
      is_adult: 1,
      gender: '',
      contact_name: '',
      contact_cell: ''
    }
  },

  setChargeDiscount(e){
    var value = 0
    try{
      value = parseFloat(e.detail.value)
    }
    catch{

    }
    var that = this
    var schedule = that.data.schedule
    schedule.charge_discount = value
    that.computeSchedule(schedule)
    that.setData({schedule: schedule})
  },

  setReturn(e){
    console.log('return', e)
    var id = e.currentTarget.id
    var that = this
    if (parseInt(id)==0){
      return
    }
    var value = e.detail.value
    var setUrl = 'https://' + app.globalData.domainName + '/core/UTV/ReturnItem/' + id.toString() + '?isReturn=' + (value? '1':'0')
      + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: setUrl,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        that.getRentItem()
      }
    })
  },

  rentItemDetail(e){
    console.log('rent item detail', e)
    var that = this
    var schedule = that.data.schedule
    var id = e.currentTarget.id.split('_')
    var name = id[0]
    var rented = parseInt(id[1])
    var modUrl = 'https://' + app.globalData.domainName + '/core/UTV/'
    if (rented == 0){
      modUrl += 'SetRent'
    }
    else{
      modUrl += 'ResetRentItem'
    }
    modUrl += '/' + schedule.id + '/?name=' + encodeURIComponent(name) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: modUrl,
      success:(res) => {
        if (res.statusCode != 200){
          return
        }
        that.getRentItem()
      }
    })
  },
  getRentItem(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetRentItem'
    wx.request({
      url: getUrl,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var rentItems = res.data
        getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetRentItems/' + that.data.schedule.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getUrl,
          success:(res)=>{
            if (res.statusCode != 200){
              return
            }
            var myRents = res.data
            for(var i = 0; i < rentItems.length; i++){
              var r = rentItems[i]
              for(var j = 0; j < myRents.length; j++){
                if (myRents[j].name == r.name){
                  r.id = myRents[j].id
                  r.confirm_rent = myRents[j].confirm_rent
                  r.returned = myRents[j].returned
                  break
                }
              }
            }
            that.setData({rentItems: rentItems})
          }
        })
      }
    })
  },

  uploadInsImages(e){
    console.log('upload insurance', e)
    var that = this
    var id = e.currentTarget.id
    var value = e.detail.files[0].url
    var schedule = that.data.schedule
    switch(id){
      case 'driver_ins':
        schedule.driver_insurance = value
        break
      case 'passenger_ins':
        schedule.passenger_insurance = value
        break
      default:
        break
    }
    that.setData({schedule: schedule})
    that.updateContactAndSchedule()
  },

  uploadLisenceImages(e){
    console.log('upload lisence', e)
    var that = this
    var driver = that.data.driver
    var passenger = that.data.passenger
    var id = e.currentTarget.id
    //var user = {}
    if (id=='driver'){
      driver.driver_license = e.detail.files[0].url
      //user = driver
      that.setData({driver: driver})
    }
    else{
      passenger.driver_license = e.detail.files[0].url
      that.setData({passenger: passenger})
      //user = passenger;
    }
    that.updateContactAndSchedule()

  },

  updateContactAndSchedule(){
    var that = this
    var driver = that.data.driver
    var passenger = that.data.passenger
    var schedule = that.data.schedule
    


    var postUrl = 'https://' + app.globalData.domainName + '/core/UTV/RefreshUTVUser/'
    + encodeURIComponent(app.globalData.sessionKey)

    if (driver.real_name != '' && driver.gender != '' && driver.cell != ''){
      wx.request({
        url: postUrl,
        method: 'POST',
        data: driver,
        success:(res)=>{
          if (res.statusCode == 200){
            schedule.driver_user_id = res.data.id
            that.setData({schedule: schedule})
          }
          
        }
      })
    }
    if (passenger.real_name != '' && passenger.gender != '' && passenger.cell != ''){
      wx.request({
        url: postUrl,
        method: 'POST',
        data: passenger,
        success:(res)=>{
          if (res.statusCode == 200){
            schedule.passenger_user_id = res.data.id
            that.setData({schedule: schedule})
          }
        }
      })
    }

    setTimeout(that.updateSchedule, 1000)
  },
  input(e){
    console.log('input ' + e.currentTarget.id, e.detail.value)
    var id = e.currentTarget.id
    var that = this
    var driver = that.data.driver
    var passenger = that.data.passenger
    var value = e.detail.value
    switch(id){
      case 'driver_name':
        driver.real_name = value.trim()
        break
      case 'driver_cell':
        driver.cell = value.trim()
        break
      case 'driver_gender':
        driver.gender = value.trim()
        break
      case 'driver_adult':
        driver.is_adult = value? 1:0
        break
      case 'passenger_name':
        passenger.real_name = value.trim()
        break
      case 'passenger_cell':
        passenger.cell = value.trim()
        break
      case 'passenger_gender':
        passenger.gender = value.trim()
        break
      case 'passenger_adult':
        passenger.is_adult = value? 1:0
        break
      case 'contact_name':
        driver.contact_name = value
        break
      case 'contact_cell':
        driver.contact_cell = value
        break
      case 'car_no':
        var schedule = that.data.schedule
        schedule.car_no = value
        that.setData({schedule: schedule})
        break
      default:
        break
    }
    that.setData({driver: driver, passenger: passenger})
  },

  getUser(id, role){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetUTVUserById/' 
      + id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    
    wx.request({
      url: getUrl,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var user = res.data
        if (role == 'driver'){
          that.setData({driver: user})
        }
        else {
          that.setData({passenger: user})
        }
      }
    })
  },

  changeLineType(e){
    var that = this
    var schedule = that.data.schedule
    var value = e.detail.value
    schedule.line_type = value
    switch(value){
      case '长线':
        schedule.charge = that.data.longPrice
        break
      case '短线':
        schedule.charge = that.data.shortPrice
        break
      default:
        break
    }
    that.setData({schedule: schedule})
  },

  getPrice(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetUnitLongCharge'
    wx.request({
      url: getUrl,
      success:(res)=>{
        that.setData({longPrice: parseFloat(res.data)})
        getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetUnitShortCharge'
        wx.request({
          url: getUrl,
          success:(res)=>{
            that.setData({shortPrice: parseFloat(res.data)})
            var schedule = that.data.schedule
            if (schedule.driver_user_id > 0){
              that.getUser(schedule.driver_user_id, 'driver')
            }
            if (schedule.passenger_user_id > 0){
              that.getUser(schedule.passenger_user_id, 'passenger')
            }
          }
        })
      }
    })
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
      case 'charge_discount':
        schedule.charge_discount = value
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
    schedule.deposit_discountStr = util.showAmount(schedule.deposit_discount)
    schedule.deposit_final = schedule.deposit - schedule.deposit_discount
    schedule.deposit_finalStr = util.showAmount(schedule.deposit_final)
    schedule.chargeStr = util.showAmount(schedule.charge)
    schedule.charge_final = schedule.charge - schedule.charge_discount - schedule.ticket_discount
    schedule.charge_discountStr = util.showAmount(schedule.charge_discount)
    schedule.charge_finalStr = util.showAmount(schedule.charge_final)
    schedule.refund = schedule.deposit_final - schedule.charge_final
    schedule.refundStr = util.showAmount(schedule.refund)
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
        that.getPrice()
      }
    })
  },


  onChange(e){
    console.log('tab change', e)
    var that = this
    that.setData({activeTab: e.detail.index})
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    console.log('id', options.id)
    app.loginPromiseNew.then(function(resolve){
      that.getSchedule(options.id)
      var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetRentItem'
      wx.request({
        url: getUrl,
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var tabIndex = 0
          if (options.tabIndex != undefined && options.tabIndex != null){
            tabIndex = parseInt(options.tabIndex)
          }
          that.setData({rentItems: res.data, activeTab: tabIndex})
          that.getRentItem()
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