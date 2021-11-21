// pages/admin/equip_maintain/on_site/recept.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    id: 0,
    confirmedInfo: {
      shop: '万龙',
      degree: '89',
      edge: 0,
      candle: 0,
      equipInfo: {
        type: '双板',
        brand: ''
      },
      additional_fee: 0,
      urgent:false
    },
    pickDateDescription: '明天',
    totalCharge: 0,
    submitInfoValid: false,
    fixBottom: false,
    bottomEdge: false,
    pasteFace: false,
    withPole: false,
    others: false,
    batchId: 0,
    ticketInfo: null,
    lastMaintainInfo: null,
    ticketCode: ''
  },
  fillBrand: function(type, brand) {
    if (this.data.id > 0){
      if (type == '双板') {
        if (this.data.boardBrandList == undefined) {
          setTimeout((res)=>{
            this.fillBrand(type, brand)
          }, 1000)
        }
        else {
          var list = this.data.boardBrandList
          var selectedIndex = 0
          for(var i = 0; i < list.length; i++) {
            if (list[i] == brand) {
              selectedIndex = i
              break;
            }
          }
          this.setData({brandSelectIndex: selectedIndex})
        }
      }
      if (type == '单板') {
        if (this.data.skiBrandList == undefined) {
          setTimeout((res)=>{
            this.fillBrand(type, brand)
          }, 1000)
        }
        else {
          var list = this.data.boardBrandList
          var selectedIndex = 0
          for(var i = 0; i < list.length; i++) {
            if (list[i] == brand) {
              selectedIndex = i
              break;
            }
          }
          this.setData({brandSelectIndex: selectedIndex})
        }
      }
    }
  },
  getTicketInfo: function(code) {
    var that = this
    var getTickUrl = 'https://' + app.globalData.domainName + '/core/Ticket/GetTicket/' + code
    wx.request({
      url: getTickUrl,
      method: 'GET',
      success: (res)=>{
        that.setData({ticketInfo: res.data})
        var openId = res.data.open_id
        var getLastUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetLast/' + encodeURIComponent(openId) + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getLastUrl,
          method: 'GET',
          success: (res)=>{
            var confirmedInfo = that.data.confirmedInfo
            confirmedInfo.equipInfo.type = res.data.confirmed_equip_type
            confirmedInfo.equipInfo.brand = res.data.confirmed_brand
            confirmedInfo.equipInfo.scale = res.data.confirmed_scale
            var cell = res.data.confirmed_cell
            var realName = res.data.confirmed_name
            var brandList = that.data.skiBrandList
            if (res.data.confirmed_equip_type == '单板') {
              brandList = that.data.boardBrandList
            }
            var brandSelectIndex = that.data.brandSelectIndex
            for(var i = 0; i < brandList.length; i++) {
              if (brandList[i].trim() == res.data.confirmed_brand){
                brandSelectIndex = i
                break
              }
            }
            that.setData({lastMaintainInfo: res.data, confirmedInfo: confirmedInfo, cell: cell, realName:realName, gender: res.data.confirmed_gender, displayedBrandList: brandList, brandSelectIndex: brandSelectIndex})
            //that.selectType()
          }
        })
      }
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
        /*
    wx.showModal({
      title: '是否添加添加下一单？',
      confirmText: '新增',
      cancelText: '结算',
      success: (res) => {
        
      }
    })
    */
   if (options.batchId != undefined) {
     this.data.batchId = options.batchId
   }
   if (options.ticketCode != undefined){
     this.data.ticketCode = options.ticketCode
   }
    if (options.id != undefined) {
      try{
        this.setData({id: parseInt(options.id)})
        var getInfoUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&id=' + this.data.id
        wx.request({
          url: getInfoUrl,
          success: (res) => {
            if (res.data.status == 0) {
              var order = res.data.maintain_in_shop_request
              var confimedInfo = this.data.confirmedInfo
              confirmedInfo.equipInfo.type = order.confirmed_equip_type
              confimedInfo.equipInfo.brand = order.confirmed_brand
              confimedInfo.equipInfo.scale = order.confirmed_scale
              var photoFiles = order.confirmed_images
              if (order.confirmed_edge == '1') {
                confirmedInfo.edge = 1
                confirmedInfo.degree = order.confirmed_degree
              }
              else {
                confirmedInfo.edge = 0
                confirmedInfo.degree = ''
              }
              if (order.confirmed_candle == '1') {
                confirmedInfo.candle = 1
              }
              else {
                confirmedInfo.candle = 0
              }
              confirmedInfo.additional_fee = order.confirmed_additional_fee
              var pickDate = new Date(order.confirmed_pick_date.toString())
              confirmedInfo.pick_date = pickDate.getFullYear().toString() + '-' + (pickDate.getMonth() + 1).toString() + '-' + pickDate.getDate().toString()
              var fixBottom = order.confirmed_more.indexOf('补板底') >= 0 ? true:false
              var pasteFace = order.confirmed_more.indexOf('粘板面') >= 0 ? true:false
              var bottomEdge = order.confirmed_more.indexOf('修底刃') >= 0 ? true:false
              var withPole = order.confirmed_more.indexOf('雪杖') >= 0 ? true:false
              var others = order.confirmed_more.indexOf('其它') >= 0 ? true:false
              this.setData({confirmedInfo: confirmedInfo, cell: order.confirmed_cell, realName: order.confirmed_name, gender: order.confirmed_gender, fixBottom: fixBottom, bottomEdge: bottomEdge, pasteFace: pasteFace, withPole: withPole, others: others, pickDateDescription: '', photoFiles: order.confirmed_images})
              this.fillBrand(order.confirmed_equip_type, order.confirmed_brand)
            }
          }
        })
      }
      catch(msg) {

      }
    }
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
          var selectedBrandIndex = 0
          var skisIndex = 0
          var boardIndex = 0
          for(var i = 0; i < listArray.length; i++){
            if (listArray[i].brand_type == '双板') {
              var brandName = listArray[i].brand_name+ (listArray[i].chinese_name.trim() != ''?'/':'')+listArray[i].chinese_name
              skiList.push(brandName)
              /*
              if (brandName == confirmedInfo.equipInfo.brand) {
                selectedBrandIndex = skisIndex
              }
              */
              skisIndex++
            }
            else{
              var brandName = listArray[i].brand_name+ (listArray[i].chinese_name.trim() != ''?'/':'')+listArray[i].chinese_name
              boardList.push(brandName)
              /*
              if (brandName == confirmedInfo.equipInfo.brand) {
                selectedBrandIndex = boardIndex
              }
              */
              boardIndex++
            }
            
          }
          if (this.data.id > 0) {
            selectedBrandIndex++
          }
          
          skiList.push('未知')
          boardList.push('未知')

          
          if (confirmedInfo.equipInfo.type == '双板') {
            for (var i = 0; i < skiList.length; i++){
              if (confirmedInfo.equipInfo.brand == skiList[i].trim()){
                selectedBrandIndex = i
                break
              }

            }
            this.setData({skiBrandList: skiList, boardBrandList: boardList, brandSelectIndex: selectedBrandIndex, displayedBrandList: skiList})
          }
          if (confirmedInfo.equipInfo.type == '单板') {
            for (var i = 0; i < boardList.length; i++){
              if (confirmedInfo.equipInfo.brand == boardList[i].trim()){
                selectedBrandIndex = i
                break
              }
            }
            this.setData({skiBrandList: skiList, boardBrandList: boardList, brandSelectIndex: selectedBrandIndex, displayedBrandList: boardList})
          }
          
          
      }
    })
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      that.data.sessionKey = resolve.sessionKey
      if (that.data.batchId > 0) {
        var getBatchUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get_batch.aspx?sessionkey=' + encodeURIComponent(that.data.sessionKey) + '&batchid=' + that.data.batchId
        wx.request({
          url: getBatchUrl,
          success: (res) => {
            if (res.data.status == 0 && res.data.count > 0) {
              var cell = ''
              var name = ''
              var gender = ''
              var arr = res.data.maintain_in_shop_request
              for(var i = 0; i < arr.length && cell == '' && name == '' && gender == ''; i++){
                cell = arr[i].confirmed_cell.trim()
                name = arr[i].confirmed_name.trim()
                gender = arr[i].confirmed_gender.trim()
              }
              that.setData({cell:cell, realName: name, gender: gender})
            }
            
          }
        })
      }
      else{
        if (options.ticketCode != undefined){
          that.getTicketInfo(options.ticketCode)
        }
      }
    })
  },
  checkValid: function() {
    var cellValid = true
    if (this.data.cell != undefined && this.data.cell.trim() != '') {
      var cell = this.data.cell.trim()
      if (cell.length != 11 || cell.indexOf('1')!=0) {
        cellValid = false
      }
    }
    if (this.data.id == 0) {
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
              this.setData({totalCharge: totalCharge, submitInfoValid: canSubmit && cellValid })
            }
          },
          fail: (res) => {
            this.setData({totalCharge: 0, submitInfoValid: false})
          }
        })
        
      }
    }
  
    
  },
  call: function() {
    wx.makePhoneCall({
      phoneNumber: this.data.cell
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
    confirmedInfo.confirmed_memo = memo
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
    this.checkValid()
  },
  submit: function() {
    var that = this
    var preRequestPromise = new Promise(function(resolve) {
      that.data.confirmedInfo.ticket_code = that.data.ticketCode
      var urlPreOrder = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_create_by_staff_quickly.aspx?sessionkey=' + encodeURIComponent(that.data.sessionKey) + '&batchid=' + that.data.batchId
      wx.request({
        url: urlPreOrder,
        method: 'POST',
        data: that.data.confirmedInfo,
        success: (res) => {
          if (res.data.status == 0) {
            resolve(res.data)
            that.data.batchId = res.data.batch_id
          }
        },
        fail:(res)=>{
          console.log(res)
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
          /*
          wx.navigateTo({
            url: 'recept_pay?id=' + that.data.confirmedInfo.request_id
          })
          */
         wx.showModal({
          title: '是否添加添加下一单？',
          confirmText: '新增',
          cancelText: '结算',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({
                url: 'recept_batch?batchId=' + that.data.batchId,
              })
            }
            else
            {
              wx.navigateTo({
                url: 'recept_pay?batchId=' + that.data.batchId,
              })
            }
          }
        })
        }
      })
    })
  },
  update: function() {
     var confirmedInfo = this.data.confirmedInfo
     var submitData = {}
     submitData.confirmed_name = this.data.realName
     submitData.confirmed_cell = this.data.cell
     submitData.confirmed_gender = this.data.gender
     submitData.confirmed_images = this.data.photoFiles
     submitData.confirmed_memo = confirmedInfo.confirmed_memo
     submitData.confirmed_scale = confirmedInfo.equipInfo.scale
     var updateContactInfoUrl = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_modify.aspx?id=' + this.data.id + '&sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
     wx.request({
       url: updateContactInfoUrl,
       data: submitData,
       method: 'POST',
       success: (res) => {
        this.setData({confirmedInfo: confirmedInfo})

        wx.showToast({
          title: '更新成功',
        })
       }
     })
  },
  gotoPrint: function() {
    wx.navigateTo({
      url: 'print_label_new?id=' + this.data.id
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
    this.checkValid()
    this.setData({confirmedInfo: confirmedInfo, pickDateDescription: pickDateDescription})
  },
  changeUrgent:function(e) {
    console.log(e)
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.urgent = e.detail.value?1:0
    this.setData({confirmedInfo: confirmedInfo})
    this.checkValid()
  }
})