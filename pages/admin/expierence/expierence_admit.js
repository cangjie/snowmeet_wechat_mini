// pages/admin/expierence/expierence_admit.js
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
      guarantee_credentail_photos: '',
      cell_number: '',
      guarantee_cash: 2000,
    },
    hourLength: 2,
    infoIsValid: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var nowTime = new Date()
    var startTimeStr = nowTime.getFullYear().toString() + '-' + (nowTime.getMonth() + 1).toString() + '-' + nowTime.getDate().toString()
    nowTime.setHours(nowTime.getHours()+2)
    nowTime.setMinutes(nowTime.getMinutes() + 30)
    var endTimeStr = nowTime.getFullYear().toString() + '-' + (nowTime.getMonth() + this.data.hourLength).toString() + '-' + nowTime.getDate().toString()
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
        var startTimeStr = nowTime.getFullYear().toString() + '-' + (nowTime.getMonth() + 1).toString() + '-' + nowTime.getDate().toString()
        nowTime.setHours(nowTime.getHours()+2)
        nowTime.setMinutes(nowTime.getMinutes() + 30)
        var endTimeStr = nowTime.getFullYear().toString() + '-' + (nowTime.getMonth() + this.data.hourLength).toString() + '-' + nowTime.getDate().toString()
        this.data.filledAdmitInfo.start_time = startTimeStr
        this.data.filledAdmitInfo.end_time = endTimeStr
      default:
        break
    }
    
  },
  checkValid: function() {
    var filledAdmitInfo = this.data.filledAdmitInfo
    if (filledAdmitInfo.asset_name != '' && filledAdmitInfo.asset_scale != '' 
    && (filledAdmitInfo.guarantee_credentail_photos != '' || (filledAdmitInfo.guarantee_credential_type != '' && filledAdmitInfo.guarantee_credential_no != '') ) && )
  }
})