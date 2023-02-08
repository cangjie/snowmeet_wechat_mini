// pages/admin/rent/rent_admit_new.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    scene: 0,
    classSelectIndex: 0
  },

  goBack(){
    wx.redirectTo({
      url: 'rent_admit',
    })
  },

  

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function (resolve){
      var getClassUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetRentClass'
      wx.request({
        url: getClassUrl,
        method: 'GET',
        success:(res)=>{
          if (res.statusCode != 200){
            return
          }
          var classList = ['请选择。。。']
          for(var i = 0; i < res.data.length; i++){
            classList.push(res.data[i])
          }
          that.setData({classList: classList})
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