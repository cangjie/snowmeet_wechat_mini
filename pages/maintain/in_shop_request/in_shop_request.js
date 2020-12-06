// pages/maintain/in_shop_request/in_shop_request.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    needValidCell: true,
    shop: '万龙',
    type: '双板',
    brand: '',
    scale:'',
    edge: false,
    candle: false,
    repair: false,
    pickDate: '',
    buttonText: ' 请 填 写 品 牌 ',
    buttonDisable: true,
    sessionKey: '',
    startDate: '',
    endDate:'',
    id: '0',
    
  },
  
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var now = new Date()
    var endDate = new Date()
    endDate.setDate(now.getDate() + 14)
    var pickDate = new Date()
    pickDate.setDate(now.getDate() + 1)
    
    this.setData({pickDate: pickDate.getFullYear().toString() + '-' + (pickDate.getMonth() + 1).toString() + '-' + pickDate.getDate().toString() , startDate: now.toDateString(), endDate: endDate.toDateString(), shop: options.shop})
    if (app.globalData.sessionKey == null || app.globalData.sessionKey == '') {
      var that = this
      app.loginPromise.then(function(resolve) {
        that.setData({sessionKey: app.globalData.sessionKey})
      })
    }
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
  onUpdateSuccess: function(){
    this.setData({needValidCell: false})
  },
  pickDateChange: function(e) {
    this.setData({pickDate: e.detail.value.trim()})
  },
  submit: function(e) {
    if (this.checkValid()) {
      var url = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_create.aspx?sessionkey=' + encodeURIComponent(this.data.sessionKey.trim()) + '&shop=' + encodeURIComponent(this.data.shop) + '&type=' + encodeURIComponent(this.data.type) + '&brand=' + encodeURIComponent(this.data.brand) + '&scale=' + encodeURIComponent(this.data.scale) + '&edge=' + (this.data.edge? '1' : '0') + '&candle=' + (this.data.candle? '1' : '0') + '&repair=' + (this.data.repair? '1':'0') + '&pickdate=' + encodeURIComponent(this.data.pickDate)
      wx.request({
        url: url,
        success: (res) => {
          if (res.data.status == 0) {
            //this.setData({id: res.data.id})
            var wxaCodeUrl = 'https://' + app.globalData.domainName + '/get_wxacode_unlimit.aspx?page=' + encodeURIComponent('pages/admin/equip_maintain/in_shop_order_confirm/in_shop_order_detail/in_shop_order_detail') + '&scene=' + res.data.id
            this.setData({wxaCodeUrl: wxaCodeUrl, id: res.data.id})
          }
        }
      })

    }
  },
  checkValid: function() {
    if (this.data.brand.trim() != '') {
      if (this.data.edge || this.data.candle || this.repair) {
        this.setData({buttonDisable: false, buttonText: " 提 交 "})
        return true
      }
      else {
        this.setData({buttonDisable: true, buttonText: "请选择服务项目 "})
        return false
      } 
    }
    else {
      return false
    }
  },
  selectType: function(e) {
    this.setData({type: e.detail.value.trim()})
    this.checkValid()
  },
  inputBrand: function(e) {
    this.setData({brand: e.detail.value.trim()})
    this.checkValid()
  },
  selectMainService: function(e) {
    var edge = false
    var candle = false
    for(var item in e.detail.value) {
      switch(e.detail.value[item].trim()){
        case 'edge':
          edge = true
          break
        case 'candle':
          candle = true
        default:
          break
      }
    }
    this.setData({edge: edge, candle:candle})
    this.checkValid()
  }
})