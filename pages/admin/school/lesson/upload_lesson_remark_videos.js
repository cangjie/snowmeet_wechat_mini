// pages/admin/school/lesson/upload_lesson_remark_videos.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    id: 0,
    role: '',
    loadComponents: false,
    videoThumbs: []
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var id = options.id
    var that = this
    this.setData({uploadVideo: this.uploadVideo.bind(this)})
    app.loginPromiseNew.then(function(resolve){
      var getLessonUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/getschoollesson/' + id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getLessonUrl,
        method: 'GET',
        success:(res)=>{
          var videoThumbs = []
          var videoThumbArr = []
          if (res.data.lesson_videos != null){
            videoThumbArr = res.data.lesson_videos.split(',')
          }  
          
          for(var i = 0; i < videoThumbArr.length; i++) {
            if (videoThumbArr[i].trim() != ''){
              videoThumbs.push({url: videoThumbArr[i].trim().replace('.mp4', '.jpg')})
            }
          }
          that.setData({role: app.globalData.role, id: id, loadComponents: true, school_lesson:res.data, videoThumbs: videoThumbs})
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

  inputRemark: function(source){
    this.data.school_lesson.instructor_remark = source.detail.value.trim()
  },

  uploadVideo: function(files) {
    var uploadUrl = 'https://' + app.globalData.domainName + '/upload_video.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    return new Promise(function(resolve)  {  
      wx.uploadFile({
        filePath: files.thumbTempFilePath,
        name: 'thumb',
        url: uploadUrl,
        success: (res) => {
          var timeStampArr = res.data.trim().split('/')
          var timeStamp = timeStampArr[timeStampArr.length - 1].trim()
          timeStamp = timeStamp.split('.')[0].trim()
          uploadUrl = uploadUrl + '&timestamp=' + timeStamp
          wx.uploadFile({
            filePath: files.tempFilePath,
            name: 'video',
            url: uploadUrl,
            success: (res) => {
              resolve({"urls": [res.data.trim()]})
            }
          })
        },
        fail: (res) => {
          console.log(res)
        }
      })
    })
  },
  uploadVideoSuccess: function(res) {
    var videos = ''
    var r = res.detail.urls
    var newVideoThumb = 'https://' + app.globalData.domainName.trim() + r[0]
    newVideoThumb = newVideoThumb.toLowerCase().replace('.mp4', '.jpg')
    var videoThumbs = this.data.videoThumbs
    videoThumbs.push({url: newVideoThumb})
    for(var item in videoThumbs) {
      videos = videos + ',' + videoThumbs[item].url.replace('.jpg', '.mp4')
    }
    videos = videos.substr(1, videos.length - 1)
    this.data.school_lesson.lesson_videos = videos
    this.setData({videoThumbs: videoThumbs})
  },
  deleteVideo: function(res) {
    var videos = ''
    var videoThumbs = this.data.videoThumbs
    var delIndex = res.detail.index
    var newVideoThumbs = []
    for(var i = 0; i < videoThumbs.length; i++) {
      if (i != delIndex) {
        newVideoThumbs.push(videoThumbs[i])
      }
    }
    for(var item in newVideoThumbs) {
      videos = videos + ',' + videoThumbs[item].url.replace('.jpg', '.mp4')
    }
    videos = videos.substr(1, videos.length - 1)
    this.data.school_lesson.lesson_videos = videos
    this.setData({videoThumbs: newVideoThumbs})
  },
  submit: function() {
    var updateUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/PutSchoolLesson/' + this.data.school_lesson.id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: updateUrl,
      method: 'PUT',
      data: this.data.school_lesson,
      success:(res)=>{
        console.log(res)
      }
    })
  }
})