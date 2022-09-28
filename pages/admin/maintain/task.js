// pages/admin/maintain/task.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    yearList: ['未知', '2012','2013','2014','2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023'],
    yearListSelectedIndex: 0,
    idDiff: false,
    showGallery: false,
    galleryIndex: -1
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      var getInfoUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetTask/' + options.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getInfoUrl,
        method: 'GET',
        success:(res)=>{
          console.log('task info', res)
          var task = res.data
          task.images = []
          var idDiff = that.data.idDiff
          if (task.confirmed_images != ''){
            task.images = task.confirmed_images.split(',')
          }
          if (task.confirmed_id != ''){
            if (task.confirmed_id.indexOf('~')>=0){
              idDiff = true
              var id = task.confirmed_id
              var idLeft = id.split('~')[0]
              var idRight = id.split('~')[1]
              task.id_left = idLeft
              task.id_right = idRight
              
            }
            else{

            }
          }
          var yearIndex = 0
          for(var i = 0; i < that.data.yearList.length; i++){
            if (that.data.yearList[i].trim() == task.confirmed_year){
              yearIndex = i
              break
            }
          }
          var getSerialUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetSerials?brand=' + encodeURIComponent(task.confirmed_brand)
          wx.request({
            url: getSerialUrl,
            method: 'GET',
            success:(res)=>{
              var serialList = res.data
              serialList.push('未知')
              var serialSelectedIndex = serialList.length - 1
              for(var i = 0; i < serialList.length; i++){
                if (task.confirmed_serial == serialList[i]){
                  serialSelectedIndex = i
                }
              }
              that.setData({task: task, serialList: serialList, serialSelectedIndex: serialSelectedIndex, yearListSelectedIndex: yearIndex, idDiff: idDiff})
            }
          })
          
        }
      })
    })
  },
  showGallery(e){
    var id = e.currentTarget.id
    var that = this
    that.setData({showGallery: true, galleryIndex: parseInt(id)})
  },
  setIdDiff(e){
    var that = this
    if (e.detail.value == 'id_diff'){
      that.setData({idDiff: true})
    }
    else{
      that.setData({idDiff: false})
    }
  },

  mod(e){
    console.log('mod', e)
    var that = this
    var value = e.detail.value
    var task = that.data.task
    switch(e.currentTarget.id){
      case 'serial_picker':
        var serial = that.data.serialList[value]
        task.confirmed_serial = serial
        that.setData({serialSelectedIndex: value})
        break
      case 'serial_input':
        task.confirmed_serial = value
        that.setData({serialSelectedIndex: 0})
        break
      case 'year_picker':
        task.confirmed_year = that.data.yearList[value]
        that.setData({yearListSelectedIndex: value})
        break
      default:
        break
    }
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