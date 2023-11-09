// pages/register/register.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

  },

  getCell(e){
    console.log('get cell', e)
    var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateUserInfo?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)+'&encData='+encodeURIComponent(e.detail.encryptedData)+'&iv='+encodeURIComponent(e.detail.iv)
    wx.request({
      url: url,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        wx.showToast({
          title: '注册成功',
          icon: 'success',
          success: (res) => {},
          fail: (res) => {},
          complete: (res) => {},
        })
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    app.loginPromiseNew.then(function(resolve){

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