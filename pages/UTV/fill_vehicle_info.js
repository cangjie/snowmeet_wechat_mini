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

  getUser(id){
    //var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/UTV/GetUTVUserById/' 
      + id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    var getUserPromise = new Promise(function(resolve){
      wx.request({
        url: getUrl,
        success:(res)=>{
          if (res.statusCode != 200){
            resolve({id: 0})
          }
          else{
            resolve(res.data)
          }
        }
      })
    })
    getUserPromise.then(function(resolve){
      if (resolve.id == 0){
        return null
      }
      else{
        return resolve
      }
    })

  },

  saveTextInfo(){
    var that = this
    var driver = that.data.driver
    var passenger = that.data.passenger
    var msg = ''
    if (driver.real_name == ''){
      msg = '请填写司机姓名。'
    }
    else if (driver.cell == ''){
      msg = '请填写司机电话。'
    }
    else if (driver.gender == ''){
      msg = '请选择司机性别。'
    }
    else if (passenger.real_name == ''){
      msg = '请填写乘客姓名。'
    }
    else if (passenger.cell == ''){
      msg = '请填写乘客电话。'
    }
    else if (passenger.gender == ''){
      msg = '请选择乘客性别。'
    }
    else if (driver.contact_name == ''){
      msg = '请填写紧急联系人姓名。'
    }
    else if (driver.contact_cell == ''){
      msg = '请填写紧急联系人电话。'
    }
    if (msg != ''){
      wx.showToast({
        title: msg,
       
        icon: 'error',
        
        mask: true
      })
      return
    }
    var postUrl = 'https://' + app.globalData.domainName +'/core/UTV/RefreshUTVUser/' 
      + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: postUrl,
      method: 'POST',
      data: driver,
      success:(res)=>{
        console.log('post driver', res)
        if (res.statusCode != 200){
          return
        }
        var driver = res.data
        that.setData({driver: driver})
        wx.request({
          url: postUrl,
          method: 'POST',
          data: passenger,
          success:(res)=>{
            console.log('post passenger', res)
            if (res.statusCode != 200){
              return
            }
            var passenger = res.data
            that.setData({passenger: passenger})
            var vehicleSchedule = that.data.vehicleSchedule
            vehicleSchedule.driver_user_id = that.data.driver.id
            vehicleSchedule.passenger_user_id = that.data.passenger.id
            var updateUrl = 'https://' + app.globalData.domainName + '/core/UTV/UpdateSchedule/' 
              + encodeURIComponent(app.globalData.sessionKey) 
            wx.request({
              url: updateUrl,
              method: 'POST',
              data: vehicleSchedule,
              success:(res)=>{
                if (res.statusCode != 200){
                  return
                }
                var vehicleSchedule = res.data
                that.setData({vehicleSchedule: vehicleSchedule})
                wx.showToast({
                  title: '保存成功，请继续上传驾照。',
                  icon: 'success',
                  success:()=>{
                    that.setData({tabIndex: 1})
                  }
                })
              }
            })
            
          }
        })
      }
    })
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
      default:
        break
    }
    that.setData({driver: driver, passenger: passenger})
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
        if (vehicleSchedule.driver_user_id == 0){
          var driver = {
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
          that.setData({driver: driver})
        }
        else{
          var driver = that.getUser(vehicleSchedule.driver_user_id)
          console.log('get user driver', driver)
        }
        if (vehicleSchedule.passenger_user_id == 0){
          var passenger = {
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
          that.setData({passenger: passenger})
        }
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