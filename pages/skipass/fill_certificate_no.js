// pages/skipass/fill_certificate_no.js
const app = getApp()
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
    this.data.orderid = options.orderid
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

  },
  inputChanged: function(source){
    console.log(source)
    this.data.certNo = source.detail.value
  },
  submitCertNo: function(){
    var certNo = this.data.certNo
    
    var submitUrl = 'https://' + app.globalData.domainName + '/core/OrderOnlines/SetSkiPassCertNo/' + this.data.orderid + '?certNo=' + certNo + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: submitUrl,
      success:(res)=>{
        wx.showToast({
          title: '提交成功。',
          success:(res)=>{
            wx.navigateTo({
              url: '/pages/mine/my_ski_pass/my_ski_pass',
            })
          }
        })
      }
    })

  }
})