// pages/Print/cavas_test.js
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
    //var imgUrl = '../../images/katerina.jpg'
    var imgUrl = 'http://weixin.snowmeet.top/images/qrcode/pay_in_shop_maintain_batch_id_676_1640362216.jpg'
    const ctx_out = wx.createCanvasContext('img', this)
    var that = this
    wx.getImageInfo({
      src: imgUrl,
      success:(res)=>{
        that.setData({
          canvasWidth: res.width,
          canvasHeight: res.height,
        });
        console.log("画布宽度" + res.width, "画布高度" + res.height);
        ctx_out.drawImage(res.path, 0, 0, 150, 150);
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