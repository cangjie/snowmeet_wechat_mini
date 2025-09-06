// pages/register/reg.js
const app = getApp()
const util = require('../../utils/util.js')
const data = require('../../utils/data.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

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
    var that = this
    app.loginPromiseNew.then(function (resolve){
      console.log('get member info', app.globalData)
      that.setData({member: app.globalData.member})
    })
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

  },
  verified(e){
    var that = this
    console.log('veri', e)
    that.setData({verified: e.detail})
    if (e.detail){
      wx.showModal({
        title: '注册成功',
        content: '点击确定关闭窗口，等待店员开单。',
        complete: (res) => {
          if (res.cancel) {
            
          }
      
          if (res.confirm) {
            wx.exitMiniProgram()
          }
        }
      })
    }
  }
})