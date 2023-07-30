// pages/admin/recept/float.js
const app = getApp()
const topFrameHeightMax = 360
const topFrameHeightMin = 60
const bottomFrameHeightMax = 360
const bottomFrameHeightMin = 60
Page({

  /**
   * Page initial data
   */
  data: {
    topFrameHeight: topFrameHeightMin,
    bottomFrameHeight: bottomFrameHeightMin,
    scene: 1
  },
  prev(){
    this.setData({scene: 1})
  },
  next(){
    this.setData({scene: 2})
  },
  goon(){
    wx.navigateTo({
      url: 'float?scene=2',
    })
  },
  back(){
    wx.navigateBack()
  },
  jump(){
    wx.navigateTo({
      url: 'float2',
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    if(options.scene != undefined){
      that.setData({scene: options.scene})
    }
    console.log('page start')
    app.loginPromiseNew.then(function (resolve){
      console.log('page resolve', resolve)
      var windowHeight = 0
      var windowWidth = 0
      if (app.globalData.systemInfo.safeArea != null){
        
        windowHeight = app.globalData.systemInfo.safeArea.height
        windowWidth = app.globalData.systemInfo.safeArea.width
        console.log('safeArea', windowWidth)
      }
      else{
        windowHeight = app.globalData.systemInfo.windowHeight 
        windowWidth = app.globalData.systemInfo.windowWidth
        console.log('unsafeArea', windowWidth)
      }
      that.setData({windowHeight: windowHeight, windowWidth: windowWidth})


    })
  },
  onShow(){
    console.log('page on show')
    var that = this
    var scene = that.data.scene
    that.setData({scene: -1})
    that.setData({scene: scene})
  },
  onRouteDone(){
    console.log('route done')
    var that = this
    var scene = that.data.scene
    that.setData({scene: -1})
    that.setData({scene: scene})
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