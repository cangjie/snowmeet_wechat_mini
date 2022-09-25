// pages/admin/maintain/task.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    yearList: ['未知', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023'],
    yearListSelectedIndex: 0,
    serialDiff: false,
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
          if (task.confirmed_images != ''){
            task.images = task.confirmed_images.split(',')
          }
          var getSerialUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetSerials?brand=' + encodeURIComponent(task.confirmed_brand)
          wx.request({
            url: getSerialUrl,
            method: 'GET',
            success:(res)=>{
              var serialList = res.data
              serialList.push('未知')
              var serialSelectedIndex = serialList.length - 1
              that.setData({task: task, serialList: serialList, serialSelectedIndex: serialSelectedIndex})
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
  setSerialDiff(e){
    var that = this
    if (e.detail.value == 'serial_diff'){
      that.setData({serialDiff: true})
    }
    else{
      that.setData({serialDiff: false})
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