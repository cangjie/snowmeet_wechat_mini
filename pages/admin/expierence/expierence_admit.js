// pages/admin/expierence/expierence_admit.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    filledAdmitInfo: {
      shop: '八易',
      asset_name:'',
      asset_scale:'',
      asset_photos:'',
      guarantee_credential_type: '身份证',
      guarantee_credential_no: '',
      guarantee_credential_photos: '',
      cell_number: '',
      guarantee_cash: 2000
    },
    hourLength: 2,
    infoIsValid: false,
    role: '',
    currentExpierenceId: 0,
    paid: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
    })
    var nowTime = new Date()
    //var startTimeStr = nowTime.getFullYear().toString() + '-' + (nowTime.getMonth() + 1).toString() + '-' + nowTime.getDate().toString() + ' ' + nowTime.getHours().toString() + ':' + nowTime.getMinutes().toString()
    //nowTime.setHours(nowTime.getHours()+2)
    var startTimeStr = util.formatDate(nowTime) + ' ' + util.formatTimeStr(nowTime)
    nowTime.setHours(nowTime.getHours()+2)

    //var endTimeStr = nowTime.getFullYear().toString() + '-' + (nowTime.getMonth() + 1).toString() + '-' + nowTime.getDate().toString() + ' ' + nowTime.getHours().toString() + ':' + nowTime.getMinutes().toString()
    var endTimeStr = util.formatDate(nowTime) + ' ' + util.formatTimeStr(nowTime)
    var filledAdmitInfo = this.data.filledAdmitInfo
    filledAdmitInfo.start_time = startTimeStr
    filledAdmitInfo.end_time = endTimeStr
    this.setData({filledAdmitInfo: filledAdmitInfo})
    
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
  shopSelected(e){
    var that = this
    var info = that.data.filledAdmitInfo
    info.shop = e.detail.shop
    that.setData({filledAdmitInfo: info})
  },
  changeInfo: function(e) {
    var value = e.detail.value
    switch(e.currentTarget.id) {
      case "shopName":
        this.data.filledAdmitInfo.shop = value
        break
      case "equipName":
        this.data.filledAdmitInfo.asset_name = value
        break
      case "scale":
        this.data.filledAdmitInfo.asset_scale = value
        break
      case "idcardType":
        this.data.filledAdmitInfo.guarantee_credential_type = value
        break
      case "idcardNo":
        this.data.filledAdmitInfo.guarantee_credential_no = value
        break
      case "cell":
        this.data.filledAdmitInfo.cell_number = value
        break
      case "cash":
        this.data.filledAdmitInfo.guarantee_cash = value
        break
      case "hourLength":
        this.data.hourLength = value
        var nowTime = new Date()
        //var endTime = nowTime.setHours(nowTime.getHours() + parseInt(value))
        var startTimeStr = nowTime.getFullYear().toString() + '-' + (nowTime.getMonth() + 1).toString() + '-' + nowTime.getDate().toString() + ' ' + nowTime.getHours().toString() + ':' + nowTime.getMinutes().toString()
        nowTime.setHours(nowTime.getHours()+parseInt(value))
        nowTime.setMinutes(nowTime.getMinutes() + 30)
        //var endTimeStr = nowTime.getFullYear().toString() + '-' + (nowTime.getMonth() + this.data.hourLength).toString() + '-' + nowTime.getDate().toString()
        var endTimeStr = nowTime.getFullYear().toString() + '-' + (nowTime.getMonth() + 1).toString() + '-' + nowTime.getDate().toString() + ' ' + nowTime.getHours().toString() + ":" + nowTime.getMinutes().toString()
        this.data.filledAdmitInfo.start_time = startTimeStr
        this.data.filledAdmitInfo.end_time = endTimeStr
      default:
        break
    }
    this.checkValid()
  },
  checkValid: function() {
    var filledAdmitInfo = this.data.filledAdmitInfo
    /*
    var valid = true
    if (filledAdmitInfo.asset_name != '' && filledAdmitInfo.asset_scale != '' 
    && (filledAdmitInfo.guarantee_credentail_photos != '' || (filledAdmitInfo.guarantee_credential_type != '' && filledAdmitInfo.guarantee_credential_no != '') ) && filledAdmitInfo.cell_number != '' && filledAdmitInfo.guarantee_cash != '' && this.data.hourLength != '' && filledAdmitInfo.shop != '') {
      try{
        parseInt(filledAdmitInfo.guarantee_cash)
      }
      catch(err){
        valid = false
      }
      try{
        parseInt(this.data.hourLength)
      }
      catch(err){
        valid = false
      }
    }
    else {
      valid = false
    }
    */
    var valid = false
    if (filledAdmitInfo.asset_name != '' && filledAdmitInfo.asset_scale != ''  && filledAdmitInfo.cell_number.length == 11 && filledAdmitInfo.guarantee_cash != '' && this.data.hourLength != '' && filledAdmitInfo.shop != ''){
      try{
        parseInt(filledAdmitInfo.guarantee_cash)
        valid = true
      }
      catch(err){
        valid = false
      }
      try{
        parseInt(this.data.hourLength)
        valid = true
      }
      catch(err){
        valid = false
      }
    }
    this.setData({infoIsValid: valid})
  },
  uploaded: function(e) {
    var filledAdmitInfo = this.data.filledAdmitInfo
    var id = e.currentTarget.id
    var fileArr = e.detail.files
    var files = ''
    for(var i = 0; i < fileArr.length; i++){
      files = files + (i>0?',':'') + fileArr[i].url
    }
    switch(id) {
      case 'equipPhotooUpload':
        filledAdmitInfo.asset_photos = files
        break
      case '':
        filledAdmitInfo.guarantee_credential_photos = files
        break
      default:
        break
    }
  },
  submit: function(e) {
    var that = this
    var submitUrl = 'https://' + app.globalData.domainName + '/core/Experience/PlaceOrder?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    var filledAdmitInfo = this.data.filledAdmitInfo
    filledAdmitInfo.start_time = util.formatDateString(filledAdmitInfo.start_time)
    filledAdmitInfo.end_time = util.formatDateString(filledAdmitInfo.end_time)
    wx.request({
      url: submitUrl,
      method: 'POST',
      data: filledAdmitInfo,
      success: (res) => {
        console.log(res)
        var responseData = res.data
        var wxaCodeUrl = 'http://weixin.snowmeet.top/show_wechat_temp_qrcode.aspx?scene=pay_payment_id_' + responseData.order.payments[0].id
        //this.setData({currentExpierenceId: responseData.expierence_list_id, wxaCodeUrl: wxaCodeUrl})
        this.setData({currentExpierenceId: responseData.id, wxaCodeUrl: wxaCodeUrl})
        var intervalId = setInterval(() => {
          var getInfoUrl = 'https://' + app.globalData.domainName + '/core/Experience/GetExperienceTemp/' + responseData.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: getInfoUrl,
            success: (res) => {
              if (res.statusCode == 200) {
                var exp = res.data
                if (exp.order != null && exp.order.payments != null && exp.order.payments.length > 0 && exp.order.payments[0].status == '支付成功') {
                  clearInterval(intervalId)
                  this.setData({paid: true})
                }

              }
            }
          })
          
        }, 1000);
      }
    })
  }
})