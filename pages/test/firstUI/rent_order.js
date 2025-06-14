// pages/test/firstUI/rent_order.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    //values:[{id: 1, name:'产品'},{id: 2, name:'收退款'},{id: 3, name:'小票'},{id: 4, name:'日志'}],
    menu:['产品', '收退款', '租金明细', '结算', '日志'],
    currentMenuIndex: 0
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    console.log('values', this.data.values)
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
  clickMenu(e){
    console.log('click menu', e)
    var that = this
    that.setData({currentMenuIndex: e.detail.index})
  }
})