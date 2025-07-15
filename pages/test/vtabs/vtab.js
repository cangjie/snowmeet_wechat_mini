// pages/test/vtabs/vtab.js
Page({

  /**
   * Page initial data
   */
  data: {
    activeTab: 11,
    index: 5
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var titles = ['咖啡','鲜榨果汁','奶茶','汉堡','三明治','沙拉','牛排','甜点','特色','烘焙','坚果','鸡尾酒','啤酒','Pizza','Wine']
    var vtabs = titles.map(item => ({title: item}))
    that.setData({vtabs})
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
  onChange(e) {
    const index = e.detail.index
    console.log('change', index)
  }
})