// pages/admin/recept/customer_identity.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    scene: '租赁下单',
    openId: '',
    shop: ''
  },

  start(){
    var that = this
    var startUrl = 'https://' + app.globalData.domainName + '/core/Recept/NewRecept?openId=' + encodeURIComponent(that.data.openId) + '&scene=' + encodeURIComponent(that.data.scene) + '&shop=' + encodeURIComponent(that.data.shop) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)

    wx.request({
      url: startUrl,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var receptId = res.data.id
        var jumpUrl = 'recept_main?id=' + receptId
        wx.navigateTo({
          url: jumpUrl,
        })
      }
    })
  },

  onUserFound(e){
    //console.log('start', e)
    var that = this
    if (e.detail.user_found){
      that.setData({openId: e.detail.user_info.open_id})
      console.log('check global data', app.globalData)
    }
  },
  shopSelected(e){
    var that = this
    that.setData({shop: e.detail.shop})
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    if (options.sceneType != undefined){
      var scene = options.sceneType
      that.setData({scene: scene})
    }
    wx.setNavigationBarTitle({
      title: that.data.scene,
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