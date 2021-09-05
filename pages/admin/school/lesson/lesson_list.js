// pages/admin/school/lesson/lesson_list.js
const util = require('../../../../utils/util.js')
const app = getApp()

Page({

  /**
   * Page initial data
   */
  data: {
    role:'',
    sessionKey: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  pageInitPromise: new Promise(function(resolve){
    
    var sessionKey = ''
    var role = ''
    var instructors = []

    var that = this
    app.loginPromiseNew.then(function(r){
      sessionKey = app.globalData.sessionKey
      role = app.globalData.role
      var getInstructorUrl = 'https://' + app.globalData.domainName + '/core/schoolstaff/getinstructor'
      wx.request({
        url: getInstructorUrl,
        method: 'GET',
        success: (res) => {
          resolve({sessionKey: r.sessionKey, role: r.role, instructors: res.data})
        }
      })
    })
  }),
  onLoad: function (options) {
    var that = this
    this.pageInitPromise.then(function(resolve) {
      console.log(resolve)
      var getListUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/GetSchoolLessons?sessionkey=' + encodeURIComponent(resolve.sessionKey)
      wx.request({
        url: getListUrl,
        method: 'Get',
        success: (res) => {
          var lessons = res.data
          for(var i in lessons) {
            var createDate = new Date(lessons[i].create_date)
            lessons[i].create_date = util.formatDate(createDate)
            var lessonDate = new Date(lessons[i].lesson_date)
            lessons[i].lesson_date = util.formatDate(lessonDate)
            var instructorName = ''
            for(var j in resolve.instructors) {
              if (resolve.instructors[j].open_id.trim() == lessons[i].instructor_open_id.trim()) {
                instructorName = resolve.instructors[j].name
                break
              }
            }
            lessons[i].instructorName = instructorName
            
          }
          that.setData({role: resolve.role, sessionKey: resolve.sessionKey, instructors: resolve.instructors, schoolLessonArr: lessons})
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
  goToDetail: function(source) {
    var id = source.currentTarget.id
    var targetUrl = 'detail_info?id=' + id
    var getSchoolLessonUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/getschoollesson/' + id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&cell=' + app.globalData.cellNumber
    wx.request({
      url: getSchoolLessonUrl,
      method: 'GET',
      success: (res) => {
        if (res.data.status != '未打开' && res.data.status != '未支付'){
          targetUrl = '/pages/mine/school/lesson/lesson_detail?id=' + id
        }
        wx.navigateTo({
          url: targetUrl
        })
      }
    })
    
  }
})