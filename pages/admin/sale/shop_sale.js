// pages/admin/sale/shop_sale.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    payMethodList:['微信支付', '支付宝转账', '微信转账','多拉宝', 'POS刷卡', '现金'],
    payMethodSelectedIndex: 0,
    showCustomerInfo: false,
    payOptionList:['全额支付', '部分支付', '无需付款'],
    payOptionSelectedIndex: 0,
    role:'',
    open_id: '',
    cell: '',
    code:'',
    userInfoDisplay: true,
    ticketsRefresh: true,
  },

  cellChanged(e){
    this.setData({open_id: ''})
    console.log('cell changed:', e)
    this.setData({open_id: e.detail.value})
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
    var displayUserInfo = that.data.userInfoDisplay
    if (selectedValue != 0){
      displayUserInfo = true
    }
    that.setData({payMethodSelectedIndex: selectedValue, showCustomerInfo: showCustomerInfo,
      userInfoDisplay: displayUserInfo})
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
    var that = this
    if (options.cell != null){
      that.setData({cell: options.cell})
    }
    if (options.code != null){
      that.setData({code: options.code})
    }
    if (options.openid != null){
      that.setData({open_id: options.openid})
    }
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
    })
  },

  userFound(e){
    console.log('User Found', e)
    var that = this
    var code = that.data.code.trim()
    if (e.detail.user_found){
      var getTicketsUrl = 'https://' + app.globalData.domainName + '/core/ticket/GetTicketsByUser/0?openId=' 
      + encodeURIComponent(e.detail.user_info.open_id) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getTicketsUrl,
        method: 'GET',
        success:(res)=>{
          console.log('current tickets', res)
          for(var i = 0; i < res.data.length; i++){
            code = code + ((code == '')? '' : ',') + res.data[i].code
          }
          that.setData({code: code, ticketsRefresh: false})
          that.setData({ticketsRefresh: true})
        }
      })
    }
    else {
      if (that.data.payMethodSelectedIndex == 0){
        that.setData({userInfoDisplay: false})
      }
    }
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

  submit(){
    wx.navigateBack()
  },
  shopSelected(e){
    console.log('shop selected', e)
  },
  ticketSelected(e){
    console.log('ticket selected', e)
  },
  userUpdate(e){
    console.log('user info update:', e)
  }
})