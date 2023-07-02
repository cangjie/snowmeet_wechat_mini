// pages/admin/utv/reserve_info_detail.js
Page({

  /**
   * Page initial data
   */
  data: {
    tabs: [{title: '押金收费'}, {title: '司乘信息'}, {title: '驾照保险'}, {title: '安全检查'},{title: '归还退费'}],
    tabIndex: 0
  },

  onChange(e){
    console.log('tab change', e)
    var that = this
    that.setData({tabIndex: e.detail.index})
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

  }
})