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
    btnText: ' 提 交 '
    //maintain_in_shop_request:{equip_type: '双板'}
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var optionArr = options.scene.split('-')
    var id = optionArr[0]
    var equipType = '双板'
    if(optionArr[1] == 'board') {
      equipType = '单板'
    }
    this.setData({equipType: equipType})
    var that = this
    app.loginPromise.then(function(resolve){
      if (app.globalData.sessionKey != '') {
        var getUserFilledInfoPromise = new Promise(function(resolve) {
            var url = 'https://' + app.globalData.domainName + '/api/maintain_task_request_in_shop_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&id=' + id
            wx.request({
              url: url,
              success: (res) => {
                if (res.data.status == 0) {
                  resolve(res.data.maintain_in_shop_request)
                  that.setData({maintain_in_shop_request: resolve})
                } 
              }
            })
        })
        getUserFilledInfoPromise.then(function(resolve){
          var pickDate = new Date(resolve.pick_date)
          resolve.pick_date = pickDate.getFullYear().toString() + '-' + (1 + pickDate.getMonth()).toString() + '-' + pickDate.getDate().toString()
          that.setData({maintain_in_shop_request: resolve})
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
          getUserInfoPromise.then(function(resolve) {
            var confirmedInfo = {}
            confirmedInfo.request_id = that.data.maintain_in_shop_request.id
            confirmedInfo.cell_number = resolve.cell_number
            confirmedInfo.real_name = resolve.real_name
            confirmedInfo.gender = resolve.gender
            confirmedInfo.equipInfo = {}
            confirmedInfo.edge = that.data.maintain_in_shop_request.edge
            confirmedInfo.degree = '89'
            confirmedInfo.candle = that.data.maintain_in_shop_request.candle
            confirmedInfo.repair_more = that.data.maintain_in_shop_request.repair_more
            confirmedInfo.shop = that.data.maintain_in_shop_request.shop
            that.setData({userInfo: resolve, confirmedInfo: confirmedInfo})
            that.viewSummary()
            
          })
        })
        
      }
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
    this.viewSummary()
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
    this.viewSummary()
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
    this.viewSummary()
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
    this.viewSummary()
  },
  changePickDate: function(e) {
    var pickDate = e.detail.value
    var confirmedInfo = this.data.confirmedInfo
    confirmedInfo.pick_date = pickDate
    this.setData({confirmedInfo: confirmedInfo})
    this.viewSummary()
  },
  viewSummary: function(e) {
    wx.request({
      url: 'https://' + app.globalData.domainName + '/api/maintain_task_order_place_in_shop.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&action=view',
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
          if (type == '' || type == undefined || brand == '' || brand == undefined ||  serial == '' || serial == undefined || year == '' || year == undefined || scale == '' || scale == undefined) {
            btnText = '请选择装备信息'
          }
          else {
            btnText = ' 提 交 '
            btnDisabled = false
          }
        }
        this.setData({"summary": res.data.total_fee, "productFee": res.data.product_fee, btnText: btnText, btnDisabled: btnDisabled})
      }
    })
  }
})