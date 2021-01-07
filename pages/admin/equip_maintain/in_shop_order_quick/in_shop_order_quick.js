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
      candle: 0

    },
    pickDateDescription: '明天',
    totalCharge: 0,
    additional_fee: 0,
    request_id: 0,
    wxaCodeUrl: '',
    paid: false,
    filledContanctInfo:false,
    canSubmit: false,
    intervalIdOrderId: 0,
    intervalIdPaid: 0,
    photoFiles: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var pickDate = new Date()
    var pickDateStartStr = pickDate.getFullYear().toString() + '-' + (pickDate.getMonth() + 1).toString() + '-' + pickDate.getDate().toString()
    var pickDateEndStr = pickDate.getFullYear().toString() + '-' + (pickDate.getMonth() + 2).toString() + '-' + pickDate.getDate().toString()
    pickDate.setDate(pickDate.getDate() + 1)

    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.pick_date = pickDate.getFullYear().toString() + '-' + (pickDate.getMonth() + 1).toString() + '-' + pickDate.getDate().toString()
    this.setData({confirmedInfo: confirmedInfo, pickDateStart: pickDateStartStr, pickDateEnd: pickDateEndStr})
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
    if (confirmedInfo.equipInfo.brand != '') {
      var canSubmit = false
      if (this.data.totalCharge > 0) {
        canSubmit = true
      }
      this.setData({brandSelectIndex: e.detail.value, confirmedInfo: confirmedInfo, canSubmit: canSubmit})
    }
    
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
  pickDateChange: function(e) {
    var pickDate = new Date(e.detail.value)
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.pick_date = e.detail.value
    var nowDate = new Date()
    var pickDateDescription = ''
    if (nowDate.getDate() == pickDate.getDate() && nowDate.getMonth() == pickDate.getMonth()) {
      pickDateDescription = '今天'
    }
    else if (nowDate.getDate() + 1 == pickDate.getDate() ) {
      pickDateDescription = '明天'
    }
    else if (nowDate.getDate() + 2 == pickDate.getDate()) {
      pickDateDescription = '后天'
    }
    else if (nowDate.getDate() + 3 == pickDate.getDate()) {
      pickDateDescription = '大后天'
    }
    else if (nowDate.getDate() + 7 > pickDate.getDate() && pickDate.getDay() == 0) {
      pickDateDescription = '本周日'
    }
    else if (nowDate.getDate() + 7 > pickDate.getDate() && pickDate.getDay() == 6) {
      pickDateDescription = '本周六'
    }
    else if (nowDate.getDate() + 14 > pickDate.getDate() && pickDate.getDay() == 0) {
      pickDateDescription = '下周日'
    }
    else if (nowDate.getDate() + 14 > pickDate.getDate() && pickDate.getDay() == 6) {
      pickDateDescription = '下周六'
    }
    else {
      pickDateDescription = ''
    }
    this.setData({confirmedInfo: confirmedInfo, pickDateDescription: pickDateDescription})
    this.viewSummary('view')
  },
  changePickDate: function(e) {
    var pickDateStr = e.detail.value
    if (pickDateStr.split('-')[2].trim() != '') {
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
    var url = 'https://' + app.globalData.domainName + '/api/maintain_task_order_place_in_shop.aspx?action=' + action + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    
    if (action=='placeorder') {
      var that = this
      var preRequestPromise = new Promise(function(resolve) {
        var urlPreOrder = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_create_by_staff_quickly.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
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
      preRequestPromise.then(function(resolve){
        confirmedInfo.request_id = resolve.maintain_in_shop_request_id
        var wxaCodeUrl = 'https://' + app.globalData.domainName + '/get_wxacode_unlimit.aspx?page=' + encodeURIComponent('pages/maintain/in_shop_request_payment/in_shop_request_payment') + '&scene=' + resolve.maintain_in_shop_request_id
        that.setData({wxaCodeUrl: wxaCodeUrl, request_id: resolve.maintain_in_shop_request_id})
        that.data.intervalIdOrderId = setInterval(() => {
          var getOrderIdPromise = new Promise(function(resolve) {
            var getOrderIdUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get.aspx?id=' + that.data.confirmedInfo.request_id + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
            wx.request({
              url: getOrderIdUrl,
              success: (res) => {
                if (res.data.status == 0){
                  resolve({maintain_in_shop_request: res.data.maintain_in_shop_request})
                }
              }
            })
          })
          getOrderIdPromise.then(function(resolve) {
            if (resolve.maintain_in_shop_request.order_id > 0) {
              var orderId = resolve.maintain_in_shop_request.order_id
              clearInterval(that.data.intervalIdOrderId)
              that.data.intervalIdPaid = setInterval(() => {
                var getPayStatePromise = new Promise(function(resolve){
                  var orderInfoUrl = 'https://' + app.globalData.domainName + '/api/order_info_get.aspx?orderid=' + orderId + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
                  wx.request({
                    url: orderInfoUrl,
                    success: (res) => {
                      if (res.data.status == 0) {
                        if (res.data.order_online.pay_state == '1'){
                          //clearInterval(that.data.intervalIdPaid)
                          resolve({order_online: res.data.order_online, paid: true})
                        }
                      }
                    }
                  })
                })
                getPayStatePromise.then(function(resolve){
                  if (resolve.paid) {
                    clearInterval(that.data.intervalIdPaid)
                    that.setData({paid: true})
                    var customorOpenId = resolve.order_online.open_id
                    var getUserInfoPromise = new Promise(function(resolve) {
                      var getUserInfoUrl = 'https://' + app.globalData.domainName + '/api/mini_user_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&openid=' + encodeURIComponent(customorOpenId)
                      wx.request({
                        url: getUserInfoUrl,
                        success: (res) => {
                          if (res.data.status == 0 && res.data.count > 0){
                            resolve(res.data.mini_users[0])
                          }
                        }
                      })
                      
                    })
                    getUserInfoPromise.then(function(resolve) {
                      var realName = resolve.real_name
                      if (realName.trim() == '') {
                        realName = resolve.nick
                      }
                      that.setData({cell: resolve.cell_number, nick: resolve.nick, realName: realName, gender: resolve.gender})
                    })
                  }
                })
                
              }, 1000);
            }
          })
        }, 1000)
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
            confirmedInfo.product_id = res.data.product_id.toString()
            var canSubmit = false
            if (confirmedInfo.equipInfo.brand != '' && totalCharge > 0) {
              canSubmit = true
            }
            this.setData({totalCharge: totalCharge, canSubmit: canSubmit})
          }
        }
      })
    }
  },
  submit: function() {
    this.viewSummary('placeorder')
  },
  changeGender: function(e) {
    this.setData({gender: e.detail.value})
  },
  changeRealName: function(e) {
    this.setData({realName: e.detail.value})
  },
  changeCellNumber: function(e) {
    this.setData({cell: e.detail.value})
  },
  submitContactInfo: function(e) {
    if (this.data.gender != undefined && this.data.gender != ''
    && this.data.realName != undefined && this.data.realName != ''
    && this.data.cell != undefined && this.data.cell != '') {
      var submitData = {}
      submitData.confirmed_cell = this.data.cell
      submitData.confirmed_name = this.data.realName
      submitData.confirmed_gender = this.data.gender
      submitData.confirmed_images = this.data.photoFiles
      var updateContactInfoUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_modify.aspx?id=' + this.data.confirmedInfo.request_id + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: updateContactInfoUrl,
        method: 'POST',
        data: submitData,
        success: (res) => {
          if (res.data.status == 0 && res.data.result > 0) {
            this.setData({filledContanctInfo: true})
          }
        }
      })
    }
  },
  uploaded: function(e) {
    var files = e.detail.files
    var photoFiles = ''
    for(var i in files) {
      if (files[i].url != '') {
        photoFiles = photoFiles + ((photoFiles.trim() != '')? ',' : '') + files[i].url
      }
    }
    this.setData({photoFiles: photoFiles})
  }
})