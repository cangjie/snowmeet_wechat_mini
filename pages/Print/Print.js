// pages/Print/Print.js
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var para = options.para
    var obj = JSON.parse(para)
    console.log(obj)
    this.testPrintImage()
  },

  testPrintImage: function() {
    var imgUrl = 'http://weixin.snowmeet.top/images/qrcode/pay_in_shop_maintain_batch_id_676_1640362216.jpg'
    const ctx_out = wx.createCanvasContext('canvasOut', this);
    wx.getImageInfo({
      src: imgUrl,
      success: (res)=>{
        console.log(res)
        ctx_out.drawImage(imgUrl, 0, 0);
        ctx_out.draw();
      }
    })
  },
  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  }
})