// pages/mine/school/lesson/lesson_detail.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    isLogin: false,
    showPreview: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
   
    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
      wx.request({
        url: 'https://' + app.globalData.domainName + '/core/schoollesson/' + options.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey),
        method: 'GET',
        success: (res) => {
          var school_lesson = res.data
          var tempImageUrlArray = school_lesson.videos.toString().split(',')
          school_lesson.videos_array = new Array()
          for(var i in tempImageUrlArray) {
            //school_lesson.videos_array[i] = school_lesson.videos_array[i].replace('.mp4', '.jpg')
            school_lesson.videos_array.push({url: tempImageUrlArray[i].replace('.mp4', '.jpg')})
          }
          
          that.setData({school_lesson: school_lesson, isLogin: true, school_lesson_id: options.id})
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

  }
})