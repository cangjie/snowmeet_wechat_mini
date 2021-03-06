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
    brandSelectIndex: 0
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

    var brandListUrl = 'https://' + app.globalData.domainName + '/api/brand_list_get.aspx'
    wx.request({
      url: brandListUrl,
      success: (res) => {
        var listArray = res.data.brand_list
        var skiList = []
        skiList.push('请选择...')
        var boardList = []
        boardList.push('请选择...')
        for(var i = 0; i < listArray.length; i++){
          if (listArray[i].brand_type == '双板') {
            skiList.push(listArray[i].brand_name+ (listArray[i].chinese_name.trim() != ''?'/':'')+listArray[i].chinese_name)
          }
          else{
            boardList.push(listArray[i].brand_name+ (listArray[i].chinese_name.trim() != ''?'/':'')+listArray[i].chinese_name)
          }
          
        }
        skiList.push('未知')
        boardList.push('未知')
        this.setData({skiBrandList: skiList, boardBrandList: boardList, displayedBrandList: skiList})
      }
    })


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
  repairChange: function(e) {
    this.setData({repair: ((e.detail.value.trim()=='1')?true:false)})
    this.checkValid()
  },
  inputScale: function(e) {
    this.setData({scale: e.detail.value})
  },
  submit: function(e) {
    if (this.checkValid()) {
      var brand = this.data.displayedBrandList[this.data.brandSelectIndex]
      var url = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_create.aspx?sessionkey=' + encodeURIComponent(this.data.sessionKey.trim()) + '&shop=' + encodeURIComponent(this.data.shop) + '&type=' + encodeURIComponent(this.data.type) + '&brand=' + encodeURIComponent(brand) + '&scale=' + encodeURIComponent(this.data.scale) + '&edge=' + (this.data.edge? '1' : '0') + '&candle=' + (this.data.candle? '1' : '0') + '&repair=' + (this.data.repair? '1':'0') + '&pickdate=' + encodeURIComponent(this.data.pickDate)
      wx.request({
        url: url,
        success: (res) => {
          if (res.data.status == 0) {
            //this.setData({id: res.data.id})
            var type = 'ski'
            if (this.data.type.trim() == '单板') {
              type = 'board'
            }
            var wxaCodeUrl = 'https://' + app.globalData.domainName + '/get_wxacode_unlimit.aspx?page=' + encodeURIComponent('pages/admin/equip_maintain/in_shop_order_confirm/in_shop_order_detail/in_shop_order_detail') + '&scene=' + res.data.id
            this.setData({wxaCodeUrl: wxaCodeUrl, id: res.data.id})
            var requestId = res.data.id
            //var that = this
            var payOrderIdInterval = setInterval(function(){
              var orderId = 0
              var orderPromise = new Promise(function(resolve){
                var requestUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&id=' + requestId
                wx.request({
                  url: requestUrl,
                  success: (res) => {
                    if (res.data.status == 0){
                      orderId = res.data.maintain_in_shop_request.order_id
                      resolve({})
                    }
                  }
                })
              })
              orderPromise.then(function(resolve){
                if (orderId!=0){
                  clearInterval(payOrderIdInterval)
                  wx.navigateTo({
                    url: '/pages/payment/payment?orderid=' + orderId
                  })
                }
              })
            }, 10000)
            
            
            
          }
        }
      })

    }
  },
  checkValid: function() {
    if (this.data.brandSelectIndex > 0) {
      if (this.data.edge || this.data.candle || this.data.repair) {
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
    var brandList = this.data.skiBrandList
    if (e.detail.value == '单板') {
      brandList = this.data.boardBrandList
    }

    this.setData({type: e.detail.value.trim(), displayedBrandList: brandList, brandSelectIndex: 0})
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
  },
  selectBrand: function(e){
    this.setData({brandSelectIndex: e.detail.value})
    this.checkValid()
  }
})