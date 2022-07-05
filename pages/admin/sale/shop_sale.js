// pages/admin/sale/shop_sale.js
Page({

  /**
   * Page initial data
   */
  data: {
    payMethodList:['微信支付', '支付宝转账', '微信转账','多拉宝', 'POS刷卡', '现金'],
    payMethodSelectedIndex: 0,
    showCustomerInfo: false,
    payOptionList:['全额支付', '部分支付', '无需付款'],
    payOptionSelectedIndex: 0
  },

  payMethodChanged(e){
    console.log('pay method changed', e)
    var that = this
    var selectedValue = e.detail.value
    var showCustomerInfo = that.data.showCustomerInfo
    if (selectedValue >0){
      showCustomerInfo = true
    }
    else{
      showCustomerInfo = false
    }
    that.setData({payMethodSelectedIndex: selectedValue, showCustomerInfo: showCustomerInfo})
  },
  payOptionChanged(e){
    var that = this
    var selectedValue = e.detail.value
    that.setData({payOptionSelectedIndex: selectedValue})
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