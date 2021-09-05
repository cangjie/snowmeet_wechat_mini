// pages/mine/school/lesson/lesson_detail.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    isLogin: false,
    showPreview: false,
    canView: true,
    needUpdate: false,
    loadComponent: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  fillPageData: function(){
    var that = this
    var getSchoolLessonInfoUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/GetSchoolLesson/' + that.data.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&cell=' + app.globalData.cellNumber
    wx.request({
      url: getSchoolLessonInfoUrl,
      method: 'GET',
      success: (res) => {
        console.log(res)
        var school_lesson = res.data
        var tempImageUrlArray = school_lesson.videos.toString().split(',')
        school_lesson.videos_array = new Array()
        for(var i in tempImageUrlArray) {
          if (tempImageUrlArray[i].trim() != ''){
            school_lesson.videos_array.push({url: tempImageUrlArray[i].replace('.mp4', '.jpg')})
          }
        }
        var canView = true
        if (school_lesson.cell_number != app.globalData.cellNumber) {
          canView = false
        }
        that.setData({school_lesson: school_lesson, isLogin: true, school_lesson_id: that.data.id, canView: canView})
        if (school_lesson != undefined && school_lesson.open_id.trim() == '' && app.globalData.role != 'staff' ) {
          var assignUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/assignopenid/' + that.data.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
          wx.request({
            url: assignUrl,
            method: 'GET',
            success: (res) => {
              that.setData({loadComponent: true})
            }
          })
        }
        else{
          that.setData({loadComponent: true})
        }
      }
    })
  },
  onLoad: function(options){
    this.data.id = options.id
    var that = this
    console.log('page start')
    app.loginPromiseNew.then(function(resolve){
      console.log('after log in')
      that.setData({role: app.globalData.role})
      if (app.globalData.role == 'staff' || app.globalData.cellNumber != '') {
        console.log('ready to load page data')
        that.fillPageData()
      }
      else {
        that.setData({needUpdate: true})
      }
    })
  },
  onLoad1: function (options) {
   
    this.data.id = options.id
    var that = this
    app.loginPromiseNew.then(function(resolve){
      if (app.globalData.cellNumber != ''){
        that.setData({role: app.globalData.role})
        var getSchoolLessonInfoUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/GetSchoolLesson/' + options.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&cell=' + app.globalData.cellNumber
        wx.request({
          url: getSchoolLessonInfoUrl,
          method: 'GET',
          success: (res) => {
            var school_lesson = res.data
            var tempImageUrlArray = school_lesson.videos.toString().split(',')
            school_lesson.videos_array = new Array()
            for(var i in tempImageUrlArray) {
              school_lesson.videos_array.push({url: tempImageUrlArray[i].replace('.mp4', '.jpg')})
            }
            var canView = true
            if (school_lesson.cell_number != app.globalData.cellNumber) {
              canView = false
            }
            that.setData({school_lesson: school_lesson, isLogin: true, school_lesson_id: options.id, canView: canView})
            if (school_lesson != undefined && school_lesson.open_id.trim() == '' && app.globalData.role != 'staff' ) {
              var assignUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/assignopenid/' + options.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
              wx.request({
                url: assignUrl,
                method: 'GET',
                success: (res) => {
                  that.setData({loadComponent: true})
                }
              })
            }
            else{
              that.setData({loadComponent: true})
            }
          }
        })
      }
      else {
        that.setData({needUpdate: true})
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
    var that = this
    return {
      title: '课程确认',
      path: '/pages/mine/school/lesson/lesson_detail?id=' + that.data.school_lesson_id,
      success: (res) => {
        console.log(res)
      }
    }
  },
  onUpdateSuccess: function() {
    this.setData({needUpdate: false})
    this.fillPageData()
  },
  placeOrder: function() {
    var trainingProductId = 203
    var ticketProductId = 202
    var rentProductId = 204
    var othersProductId = 205
    
    var placeOrderUrl = 'https://' + app.globalData.domainName + '/api/place_online_order.aspx?token=' + encodeURIComponent(app.globalData.sessionKey)
    var schoolLesson = this.data.school_lesson
    var trainingCount = parseInt(schoolLesson.training_fee / 0.01)
    var ticketCount = parseInt(schoolLesson.ticket_fee / 0.01)
    var rentCount = parseInt(schoolLesson.rent_fee / 0.01)
    var othersCount = parseInt(schoolLesson.others_fee / 0.01)
    var elementStr = ''
    //var trainingStr = ''
    if (trainingCount > 0) {
      elementStr = elementStr + ", {'product_id':" + trainingProductId.toString() + ", 'count': " + trainingCount.toString() + " }"
    }
    //var ticketStr = ''
    if (ticketCount > 0) {
      elementStr = elementStr + ", {'product_id': " + ticketProductId.toString() + ", 'count': " + ticketCount.toString() + "}"
    }
    //var rentStr = ''
    if (rentCount > 0) {
      elementStr = elementStr + ", {'product_id': " + rentProductId.toString() + ", 'count': " + rentCount.toString() + "}"
    }
    //var othersStr = ''
    if (othersCount > 0) {
      elementStr = elementStr + ", {'product_id': " + othersProductId.toString() + ", 'count': " + othersCount.toString() + "}"
    }
    elementStr = elementStr.substr(1, elementStr.length - 1)
    var cartStr = "{'cart_array': [" + elementStr + "]}"
    //var cart = {cart_array: [{product_id: trainingProductId, count: trainingCount},{product_id: ticketProductId, count: ticketCount },{product_id: rentProductId, count: rentCount},{product_id: othersProductId, count: othersCount}]}
    placeOrderUrl = placeOrderUrl + "&cart=" + encodeURIComponent(cartStr)
    var that = this
    wx.request({
      url: placeOrderUrl,
      method: 'POST',
      //data: {cart: cart},
      success: (res) => {
        console.log(res)
        var schoolLesson = this.data.school_lesson
        schoolLesson.order_id = res.data.order_id
        var updateUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/PutSchoolLesson/' + schoolLesson.id.toString() + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: updateUrl,
          method: 'PUT',
          data: schoolLesson,
          success: (res) => {
            console.log(res)
            wx.navigateTo({
              url: '/pages/payment/payment?orderid=' + schoolLesson.order_id,
            })
          }
        })
      }
    })
  }
})