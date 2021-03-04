// pages/admin/equip_maintain/on_site/recept.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    confirmedInfo: {
      shop: '万龙',
      degree: '89',
      edge: 0,
      candle: 0,
      equipInfo: {
        type: '双板',
        brand: ''
      },
      additional_fee: 0
    },
    pickDateDescription: '明天',
    totalCharge: 0,
    submitInfoValid: false,
    actionMode: 'add'
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
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      that.data.sessionKey = resolve.sessionKey
    })
  },
  checkValid: function() {
    if (this.data.actionMode == 'add') {
      if (this.data.confirmedInfo.equipInfo.brand == '' || 
      (this.data.confirmedInfo.edge != 1 && this.data.confirmedInfo.candle != 1 && this.data.confirmedInfo.additional_fee == 0)) {
        this.setData({submitInfoValid: false})
      }
      else {
        var url = 'https://' + app.globalData.domainName + '/api/maintain_task_order_place_in_shop.aspx?action=view&sessionkey=' + encodeURIComponent(this.data.sessionKey)
        console.log(this.data.confirmedInfo)
        wx.request({
          url: url,
          method: 'POST',
          data: this.data.confirmedInfo,
          success: (res) => {
            if (res.data.status == 0) {
              var totalCharge = res.data.total_fee
              this.data.confirmedInfo.product_id = res.data.product_id.toString()
              var canSubmit = false
              if (totalCharge > 0) {
                canSubmit = true
              }
              this.setData({totalCharge: totalCharge, submitInfoValid: canSubmit})
            }
          },
          fail: (res) => {
            this.setData({totalCharge: 0, submitInfoValid: false})
          }
        })
        
      }
    }
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
      this.checkValid()
    }
    
  },
  changeScale: function(e) {
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.equipInfo.scale = e.detail.value
    this.setData({confirmedInfo: confirmedInfo})
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
    this.checkValid()
    //this.viewSummary('view')
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
    this.checkValid()
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
    this.checkValid()
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
  submit: function() {
    var that = this
    var preRequestPromise = new Promise(function(resolve) {
      var urlPreOrder = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_create_by_staff_quickly.aspx?sessionkey=' + encodeURIComponent(that.data.sessionKey)
      wx.request({
        url: urlPreOrder,
        method: 'POST',
        data: that.data.confirmedInfo,
        success: (res) => {
          if (res.data.status == 0) {
            resolve(res.data)
          }
        }
      })
    })
    
    preRequestPromise.then(function(resolve){
      that.data.confirmedInfo.request_id = resolve.maintain_in_shop_request_id
      var submitData = {}
      if (that.data.gender != undefined && that.data.gender != '') {
        submitData.confirmed_gender = that.data.gender
      }
      else{
        submitData.confirmed_gender = ''
      }
      if (that.data.realName != undefined && that.data.realName != '') {
        submitData.confirmed_name = that.data.realName
      }
      else {
        submitData.confirmed_name = ''
      }
      if (that.data.cell != undefined && that.data.cell != '') {
        submitData.confirmed_cell = that.data.cell
      }
      else {
        submitData.confirmed_cell = ''
      }
      submitData.confirmed_images = that.data.photoFiles
      var updateContactInfoUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_modify.aspx?id=' + resolve.maintain_in_shop_request_id + '&sessionkey=' + encodeURIComponent(that.data.sessionKey)
      wx.request({
        url: updateContactInfoUrl,
        method: 'POST',
        data: submitData,
        success: (res) => {
          
        },
        fail: (res) => {

        },
        complete: (res)=>{
          console.log(res)
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
  }
})