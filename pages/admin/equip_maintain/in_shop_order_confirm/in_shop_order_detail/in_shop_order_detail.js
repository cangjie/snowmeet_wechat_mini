// pages/admin/equip_maintain/in_shop_order_confirm/in_shop_order_detail/in_shop_order_detail.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    edgeDegree: '89',
    summary: 0,
    productFee: 0,
    btnDisabled: true,
    btnText: ' 提 交 ',
    orderId: 0,
    wxaCodeUrl:''
    //maintain_in_shop_request:{equip_type: '双板'}
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function(options){
    var id = options.scene
    var getBrandListPromise = new Promise(function(resolve){
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
          that.setData({skiBrandList: skiList, boardBrandList: boardList})
          resolve({})
        }
      })
    })
    var that = this
    getBrandListPromise.then(function(resolve){
      app.loginPromise.then(function(resolve){
        if (app.globalData.sessionKey != '') {
          var getUserFilledInfoPromise = new Promise(function(resolve) {
            var url = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&id=' + id
            wx.request({
              url: url,
              success: (res) => {
                if (res.data.status == 0) {
                  var maintainInShopRequest = res.data.maintain_in_shop_request
                  var pickDate = new Date(maintainInShopRequest.pick_date)
                  maintainInShopRequest.pick_date = pickDate.getFullYear().toString() + '-' + (1 + pickDate.getMonth()).toString() + '-' + pickDate.getDate().toString()
                  that.setData({maintain_in_shop_request: res.data.maintain_in_shop_request})
                  resolve(res.data.maintain_in_shop_request)
                } 
              }
            })
          })
          getUserFilledInfoPromise.then(function(resolve){
            var getUserInfoPromise = new Promise(function(resolve){
              var url = 'https://' + app.globalData.domainName + '/api/mini_user_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&openid=' + encodeURIComponent(that.data.maintain_in_shop_request.open_id)
              wx.request({
                url: url,
                success: (res) => {
                  if (res.data.status == 0 && res.data.count > 0){
                    resolve(res.data.mini_users[0])
                  }
                }
              })
            })
            getUserInfoPromise.then(function(resolve){
              var confirmedInfo = {}
              confirmedInfo.request_id = that.data.maintain_in_shop_request.id
              confirmedInfo.cell_number = resolve.cell_number
              confirmedInfo.real_name = resolve.real_name
              confirmedInfo.gender = resolve.gender
              var equipInfo = {}
              equipInfo.type = that.data.maintain_in_shop_request.equip_type
              equipInfo.brand = that.data.maintain_in_shop_request.brand
              equipInfo.serial = ''
              equipInfo.scale = that.data.maintain_in_shop_request.scale
              equipInfo.year = ''
              confirmedInfo.equipInfo = equipInfo
              confirmedInfo.edge = that.data.maintain_in_shop_request.edge
              confirmedInfo.degree = that.data.maintain_in_shop_request.degree
              confirmedInfo.candle = that.data.maintain_in_shop_request.candle
              confirmedInfo.repair_more = that.data.maintain_in_shop_request.repair_more
              confirmedInfo.shop = that.data.maintain_in_shop_request.shop
              confirmedInfo.degree = '89'
              confirmedInfo.pick_date = that.data.maintain_in_shop_request.pick_date
              var displayedBrandList = that.data.skiBrandList
              if (equipInfo.type=='双板') {
                displayedBrandList = that.data.skiBrandList
              }
              else {
                displayedBrandList = that.data.boardBrandList
              }
              var brandSelectIndex = 0
              for(var i = 0; i < displayedBrandList.length; i++) {
                if (displayedBrandList[i].trim() == equipInfo.brand) {
                  brandSelectIndex = i
                  break
                }
              }
              that.setData({userInfo: resolve, confirmedInfo: confirmedInfo, displayedBrandList: displayedBrandList, brandSelectIndex: brandSelectIndex})
              that.viewSummary('view')
            })
          })
        }
      })
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

  },
  call: function() {
    wx.makePhoneCall({
      phoneNumber: this.data.userInfo.cell_number,
    })
  },
  changeCellNumber: function(e) {
    var newNumber = e.detail.value
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.cell_number = newNumber
    this.setData({confirmedInfo: confirmedInfo})
  },
  changeRealName: function(e) {
    var realName = e.detail.value
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.real_name = realName
    this.setData({confirmedInfo: confirmedInfo})
  },
  changeGender: function(e) {
    var gender = e.detail.value
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.gender = gender
    this.setData({confirmedInfo: confirmedInfo})
  },
  equipInfoChange: function(e) {
    var equipInfo = e.detail.confirmedFilledInfo
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.equipInfo = equipInfo
    this.setData({confirmedInfo: confirmedInfo})
    this.viewSummary('view')
  },
  changeEdge: function(e) {
    var edge = false
    if (e.detail.value.length == 1) {
      edge = true
    }
    var confirmedInfo = this.data.confirmedInfo
    if (edge) {
      confirmedInfo.edge = '1'
    }
    else {
      confirmedInfo.edge = '0'
    }
    this.setData({confirmedInfo: confirmedInfo})
    this.viewSummary('view')
  },
  degreeChange: function(e) {
    var degree = e.detail.value
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.degree = degree
    this.setData({confirmedInfo: confirmedInfo})
  },
  changeCandle: function(e) {
    var candle = false
    if (e.detail.value.length == 1) {
      candle = true
    }
    var confirmedInfo = this.data.confirmedInfo
    if (candle) {
      confirmedInfo.candle = '1'
    }
    else {
      confirmedInfo.candle = '0'
    }
    this.setData({confirmedInfo: confirmedInfo})
    this.viewSummary('view')
  },
  changeRepairMore: function(e) {
    var repairMore = ''
    for(var i = 0; i < e.detail.value.length; i++) {
      repairMore = repairMore + ((repairMore == '')? '' : ',') + e.detail.value[i]
    }
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.repair_more = repairMore
    this.setData({confirmedInfo: confirmedInfo})
  },
  changeMemo: function(e) {
    var memo = e.detail.value
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.memo = memo
    this.setData({confirmedInfo: confirmedInfo})
  },
  changeAdditionalFee: function(e) {
    var fee = e.detail.value
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.additional_fee = fee
    this.setData({confirmedInfo: confirmedInfo})
    this.viewSummary('view')
  },
  changePickDate: function(e) {
    var pickDate = e.detail.value
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.pick_date = pickDate
    this.setData({confirmedInfo: confirmedInfo})
    this.viewSummary('view')
  },
  selectType: function(e) {
    if (e.detail.value=='单板') {
      this.setData({brandSelectIndex: 0, displayedBrandList: this.data.boardBrandList})
    }
    else {
      this.setData({brandSelectIndex: 0, displayedBrandList: this.data.skiBrandList})
    }
  },
  changeScale: function(e) {
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.equipInfo.scale = e.detail.value
    this.setData({confirmedInfo: confirmedInfo})
  },
  selectBrand: function(e){
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.equipInfo.brand = this.data.displayedBrandList[e.detail.value]
    this.setData({brandSelectIndex: e.detail.value, confirmedInfo: confirmedInfo})
    this.viewSummary('view')
  },
  submit: function(e) {
    this.viewSummary('placeorder')
  },
  viewSummary: function(action) {
    wx.request({
      url: 'https://' + app.globalData.domainName + '/api/maintain_task_order_place_in_shop.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&action=' + action,
      method: 'POST',
      data: this.data.confirmedInfo,
      success: (res) => {
        var btnDisabled = true
        var btnText = ' 提 交 '
        if (res.data.total_fee == '0') {
          btnText = '请选择服务器项目'
        }
        else {
          var type = ''
          var brand = ''
          var serial = ''
          var year = ''
          var scale = ''
          var info  = this.data.confirmedInfo.equipInfo
          try{
            type = info.type
            brand = info.brand
            serial = info.serial
            scale = info.scale
            year = info.year
          }
          catch(err) {

          }
          if (type == '' || type == undefined || brand == '' || brand == undefined) {
            btnText = '请选择装备信息'
          }
          else {
            btnText = ' 提 交 '
            btnDisabled = false
          }
        }
        this.setData({"summary": res.data.total_fee, "productFee": res.data.product_fee, btnText: btnText, btnDisabled: btnDisabled})
        if (action=='placeorder') {
          var orderId = res.data.order_id
          var wxaCodeUrl = 'https://' + app.globalData.domainName + '/get_wxacode_unlimit.aspx?page=' + encodeURIComponent('pages/payment/payment') + '&scene=orderid-' + orderId
          this.setData({orderId: orderId, wxaCodeUrl: wxaCodeUrl})
          var getPaymentPromise = new Promise(function(resolve){
            var paid = false
            var t = setInterval(() => {
              var orderInfoUrl = 'https://' + app.globalData.domainName + '/api/order_info_get.aspx?orderid=' + orderId + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
              wx.request({
                url: orderInfoUrl,
                success: (res) => {
                  if (res.data.status == 0) {
                    if (res.data.order_online.pay_state == '1'){
                      clearInterval(t)
                      resolve([])
                    }
                  }
                }
              })
            }, 2000);
          })
          var that = this
          getPaymentPromise.then(function(resolve) {
            that.setData({paid: true})
          })
        }
      }
    })
  }
})