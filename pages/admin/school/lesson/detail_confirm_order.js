// pages/admin/school/lesson/detail_confirm_order.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    finishLoad: false,
    role: '',
    training_fee: 0,
    ticket_fee: 0,
    rent_fee: 0,
    others_fee: 0,
    errMsg: '',
    canSubmit: false,
    totalFee: 0,
    school_lesson:{
      training_fee: 0,
      ticket_fee: 0,
      others_fee: 0,
      rent_fee: 0
    }
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var id = options.id
    this.setData({lesson_id: id})
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
      var getLessonInfoUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/GetSchoolLesson/' + id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getLessonInfoUrl,
        method: 'GET',
        success: (res) => {
          that.setData({school_lesson: res.data, canSubmit: true, training_fee: res.data.training_fee, ticket_fee: res.data.ticket_fee, rent_fee: res.data.rent_fee, others_fee: res.data.others_fee, totalFee: res.data.training_fee + res.data.ticket_fee + res.data.rent_fee + res.data.others_fee, finishLoad: true})
        },
        fail:(res) => {
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
  inputFee: function(res){
    var inputedValue = res.detail.value.trim()
    var floatValue = parseFloat(inputedValue)
    var totalFee = this.data.totalFee
    var errMsg = ''
    if (isNaN(floatValue)) {
      errMsg = '请输入正确的'
    }
    switch (res.currentTarget.id) {
      case "training_fee":
        if (errMsg!='') {
          errMsg = errMsg + '教练费用金额。'
        }
        else {
          this.setData({training_fee: inputedValue})
        }
        break;
      case "ticket_fee":
        if (errMsg!='') {
          errMsg = errMsg + '雪票价格。'
        }
        else {
          this.setData({ticket_fee: inputedValue})
        }
        break;
      case "rent_fee":
        if (errMsg!='') {
          errMsg = errMsg + '雪具租赁价格。'
        }
        else {
          this.setData({rent_fee: inputedValue})
        }
        break;
      case "others_fee":
        if (errMsg!='') {
          errMsg = errMsg + '其他费用。'
        }
        else{
          this.setData({others_fee: inputedValue})
        }
        break;
      default:
        break;
    }
    if (errMsg!='') {
      this.setData({canSubmit: false, errMsg: errMsg})
    }
    else{
      var canSubmit = false
      if (this.data.school_lesson!=undefined) {
        canSubmit = true
      }
      this.setData({canSubmit: canSubmit, errMsg: ''})
      var floatRentFee = 0
      try{
        floatRentFee = parseFloat(this.data.rent_fee)
        this.data.school_lesson.rent_fee = floatRentFee
      }
      catch{

      }
      var floatTrainingFee = 0
      try{
        floatTrainingFee = parseFloat(this.data.training_fee)
        this.data.school_lesson.training_fee = floatTrainingFee
      }
      catch{

      }
      var floatOthersFee = 0
      try{
        floatOthersFee = parseFloat(this.data.others_fee)
        this.data.school_lesson.others_fee = floatOthersFee
      }
      catch{

      }
      var floatTicketFee = 0
      try{
        floatTicketFee = parseFloat(this.data.ticket_fee)
        this.data.school_lesson.ticket_fee = floatTicketFee
      }
      catch{

      }
      totalFee = this.data.school_lesson.training_fee + this.data.school_lesson.ticket_fee + this.data.school_lesson.rent_fee + this.data.school_lesson.others_fee
      this.setData({totalFee: totalFee})
    }
  },
  submit: function() {
    var school_lesson = this.data.school_lesson
    school_lesson.training_fee = this.data.training_fee
    school_lesson.ticket_fee = this.data.ticket_fee
    school_lesson.rent_fee = this.data.rent_fee
    school_lesson.others_fee = this.data.others_fee
    var that = this
    wx.request({
      url: 'https://' + app.globalData.domainName + '/core/schoollesson/GetSchoolLesson/' + this.data.school_lesson.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey),
      method: 'PUT',
      data: school_lesson,
      success: (res) => {
        wx.navigateTo({
          url: '/pages/mine/school/lesson/lesson_detail?id=' + that.data.school_lesson.id
        })
      }
    })
    
  },
  inputMemo: function(res) {
    this.data.school_lesson.memo = res.detail.value.trim()
    
  }
})