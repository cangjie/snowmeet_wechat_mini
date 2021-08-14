// pages/admin/school/lesson/detail_confirm_order.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    training_fee: 0,
    ticket_fee: 0,
    rent_fee: 0,
    others_fee: 0,
    errMsg: '',
    canSubmit: false,
    
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var id = options.id
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
      wx.request({
        url: 'https://' + app.globalData.domainName + '/core/schoollesson/' + id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey),
        method: 'GET',
        success: (res) => {
          that.setData({school_lesson: res.data, canSubmit: true})
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
  inputFee: function(res){
    var inputedValue = res.detail.value.trim()
    var intValue = intValue = parseInt(inputedValue)
    var errMsg = ''
    if (isNaN(intValue)) {
      errMsg = '请输入整数的'
    }
    switch (res.currentTarget.id) {
      case "training_fee":
        if (errMsg!='') {
          errMsg = errMsg + '教练费用金额。'
        }
        else {
          this.setData({training_fee: intValue})
        }
        break;
      case "ticket_fee":
        if (errMsg!='') {
          errMsg = errMsg + '雪票价格。'
        }
        else {
          this.setData({ticket_fee: intValue})
        }
        break;
      case "rent_fee":
        if (errMsg!='') {
          errMsg = errMsg + '雪具租赁价格。'
        }
        else {
          this.setData({rent_fee: intValue})
        }
        break;
      case "others_fee":
        if (errMsg!='') {
          errMsg = errMsg + '其他费用。'
        }
        else{
          this.setData({others_fee: intValue})
        }
        break;
      default:
        break;
    }
    if (errMsg!='') {
      this.setData({canSubmit: false, errMsg: errMsg})
    }
    else{
      this.setData({canSubmit: true, errMsg: ''})
      this.data.school_lesson.rent_fee = this.data.rent_fee
      this.data.school_lesson.training_fee = this.data.training_fee
      this.data.school_lesson.others_fee = this.data.rent_fee
      this.data.school_lesson.ticket_fee = this.data.ticket_fee
    }
  },
  submit: function() {
    var school_lesson = this.data.school_lesson
    school_lesson.training_fee = this.data.training_fee
    school_lesson.ticket_fee = this.data.ticket_fee
    school_lesson.rent_fee = this.data.rent_fee
    school_lesson.others_fee = this.data.others_fee
    wx.request({
      url: 'https://' + app.globalData.domainName + '/core/schoollesson/' + this.data.school_lesson.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey),
      method: 'PUT',
      data: school_lesson,
      success: (res) => {
        console.log(res)
      }
    })
    
  },
  inputMemo: function(res) {
    this.data.school_lesson.memo = res.detail.value.trim()
    
  }
})