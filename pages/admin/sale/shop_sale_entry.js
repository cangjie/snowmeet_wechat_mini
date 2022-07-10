// pages/admin/sale/shop_sale_entry.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    cell: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      if (app.globalData.role == 'staff') {
        that.setData({role: app.globalData.role})
      }
    })
  },
  cellChanged(e){
    this.setData({cell: e.detail.value})
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
  gotoShopSale() {
    var that = this
    wx.navigateTo({
      url: 'shop_sale?cell=' + that.data.cell,
    })
  },
  scan(){
    wx.scanCode({
      onlyFromCamera: false,
      success: (res)=>{
        console.log('scan code', res)
        wx.navigateTo({
          url: res.result,
        })
      }
    })
  }
})