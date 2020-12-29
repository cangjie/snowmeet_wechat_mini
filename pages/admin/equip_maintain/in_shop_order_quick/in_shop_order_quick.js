// pages/admin/equip_maintain/in_shop_order_quick/in_shop_order_quick.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    confirmedInfo: {
      equipInfo: {
        type: '双板',
        brand: ''
      },
      shop: '万龙',
      degree: '89',
      edge: 0,
      candle: 0,

    },
    pickDateDescription: '明天',
    totalCharge: 0,
    additional_fee: 0,
    request_id: 0
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var pickDate = new Date()
    pickDate.setDate(pickDate.getDate() + 1)
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.pick_date = pickDate.getFullYear().toString() + '-' + (pickDate.getMonth() + 1).toString() + '-' + pickDate.getDate().toString()
    this.setData({confirmedInfo: confirmedInfo})
    var brandListUrl = 'https://' + app.globalData.domainName + '/api/brand_list_get.aspx'
    wx.request({
      url: brandListUrl,
      success: (res)=>{
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
          this.setData({skiBrandList: skiList, boardBrandList: boardList, brandSelectIndex: 0, displayedBrandList: skiList})
      }
    })
  },
  selectType: function(e) {
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.equipInfo.type = e.detail.value
    if (e.detail.value=='单板') {
      this.setData({brandSelectIndex: 0, displayedBrandList: this.data.boardBrandList, confirmedInfo: confirmedInfo})
    }
    else {
      this.setData({brandSelectIndex: 0, displayedBrandList: this.data.skiBrandList, confirmedInfo: confirmedInfo})
    }
    

  },
  selectBrand: function(e){
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.equipInfo.brand = this.data.displayedBrandList[e.detail.value]
    this.setData({brandSelectIndex: e.detail.value, confirmedInfo: confirmedInfo})
  },
  changeScale: function(e) {
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.equipInfo.scale = e.detail.value
    this.setData({confirmedInfo: confirmedInfo})
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
    var pickDateStr = e.detail.value
    try {
      var pickDate = new Date(pickDateStr)
      var nowDate = new Date()
      var confirmedInfo = this.data.confirmedInfo
      confirmedInfo.pick_date = pickDate.getFullYear().toString() + '-' + (pickDate.getMonth()+1).toString() + '-' + pickDate.getDate().toString()
      if (nowDate.toDateString() == pickDate.toDateString()) {
        this.setData({pickDateDescription: '今天', confirmedInfo: confirmedInfo})
      }
      else {
        nowDate.setDate(nowDate.getDate() + 1)
        if (nowDate.toDateString() == pickDate.toDateString()) {
          this.setData({pickDateDescription: '明天', confirmedInfo: confirmedInfo})
        }
        else {
          this.setData({pickDateDescription: '', confirmedInfo: confirmedInfo})
        }
      }
      this.viewSummary('view')
    }
    catch(msg){

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
  viewSummary: function(action) {
    var confirmedInfo = this.data.confirmedInfo
    var url = 'https://' + app.globalData.domainName + '/api/maintain_task_order_place_in_shop.aspx?action=' + action + '&sessionkey=' + app.globalData.sessionKey
    var preRequestPromise = new Promise(function(resolve) {
      var urlPreOrder = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_create_by_staff_quickly.aspx?sessionkey=' + app.globalData.sessionKey
      wx.request({
        url: urlPreOrder,
        method: 'POST',
        data: confirmedInfo,
        success: (res) => {
          if (res.data.status == 0) {
            resolve(res.data)
          }
        }
      })
    })
    if (action=='placeorder') {
      preRequestPromise.then(function(resolve){
        confirmedInfo.request_id = resolve.maintain_in_shop_request_id
        wx.request({
          url: url,
          method: 'POST',
          data: confirmedInfo,
          success: (res) => {
            if (res.data.status == 0) {
              var totalCharge = res.data.total_fee
              this.setData({totalCharge: totalCharge})
            }
          }
        })
      })
    }
    else {
      wx.request({
        url: url,
        method: 'POST',
        data: confirmedInfo,
        success: (res) => {
          if (res.data.status == 0) {
            var totalCharge = res.data.total_fee
            confirmedInfo.product_id = res.data.product_id
            this.setData({totalCharge: totalCharge})
          }
        }
      })
    }
  },
  viewSummary1: function(action) {
    
    if (action=='placeorder') {
      var urlPreOrder = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_create_by_staff_quickly.aspx?sessionkey=' + app.globalData.sessionKey
      wx.request({
        url: urlPreOrder,
        method: 'POST',
        data: this.data.confirmedInfo,
        success: (res) => {
          if (res.data.status == 0) {

          }
        }
      })
    }
    action = 'view'
    var url = 'https://' + app.globalData.domainName + '/api/maintain_task_order_place_in_shop.aspx?action=' + action + '&sessionkey=' + app.globalData.sessionKey
    wx.request({
      url: url,
      method: 'POST',
      data: this.data.confirmedInfo,
      success: (res) => {
        if (res.data.status == 0) {
          var totalCharge = res.data.total_fee
          this.setData({totalCharge: totalCharge})
        }
      }
    })
  },
  submit: function() {
    this.viewSummary('placeorder')
  }
})