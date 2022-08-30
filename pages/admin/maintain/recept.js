// pages/admin/maintain/recept.js
Page({

  /**
   * Page initial data
   */
  data: {
    scene: '查看用户基本信息'
  },

  

  userInfoUpdate(e){
    console.log('user info update', e)
    var that = this
    var userInfo = e.detail.user_info
    that.setData({userInfo: userInfo})
    if (userInfo.user_found){
      
    }
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
  gotoPlaceOrder(){
    var that = this
    that.setData({scene: '确定养护项目'})
  },
  gotoConfirm(){
    var that = this
    that.setData({scene: '确认订单'})
  },
  gotoRecept(){
    var that = this
    that.setData({scene: '查看用户基本信息'})
  }
})