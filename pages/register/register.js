// pages/register/register.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    isLogin: false
  },

  getCell(e){
    console.log('get cell', e)
    var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateUserInfo?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)+'&encData='+encodeURIComponent(e.detail.encryptedData)+'&iv='+encodeURIComponent(e.detail.iv)
    wx.request({
      url: url,
      success:(res)=>{
        if (res.statusCode != 200){
          wx.showToast({
            title: '网络繁忙，请稍候再试。',
            icon: 'error',
            success: (res) => {},
            fail: (res) => {},
            complete: (res) => {},
          })
          return
        }
        wx.showToast({
          title: '注册成功',
          icon: 'success',
          success: (res) => {},
          fail: (res) => {},
          complete: (res) => {},
        })
        setTimeout(()=>{
          wx.exitMiniProgram(
          {
            success:(res)=>{
              console.log('exit', res)
            }
          }

        )}, 2000)
        
        
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({isLogin: true})
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