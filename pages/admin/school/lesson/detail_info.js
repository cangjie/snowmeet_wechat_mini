// pages/admin/school/lesson/detail_info.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    
    videoThumbs: []
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    //var videoThumbs = this.data.videoThumbs
    //videoThumbs.push({url: 'https://mini.snowmeet.top/upload/20210802/1627912001.jpg'})
    //this.setData({videoThumbs: videoThumbs})
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
    this.setData({uploadVideo: this.uploadVideo.bind(this)})
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
  /*
  uploaded: function(e) {
    var files = e.detail.files
    var uploadedFiles = ''
    for(var i in files) {
      if (files[i].url != '') {
        uploadedFiles = uploadedFiles + ((uploadedFiles.trim() != '')? ',' : '') + files[i].url
      }
    }
    this.setData({uploadedFiles: uploadedFiles})
  },
  */
  uploadVideo: function(files) {
    var uploadUrl = 'https://' + app.globalData.domainName + '/upload_video.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        filePath: files.thumbTempFilePath,
        name: 'name',
        url: uploadUrl,
        success: (res) => {
          var timeStampArr = res.data.trim().split('/')
          var timeStamp = timeStampArr[timeStampArr.length - 1].trim()
          timeStamp = timeStamp.split('.')[0].trim()
          uploadUrl = uploadUrl + '&timestamp=' + timeStamp
          wx.uploadFile({
            filePath: files.tempFilePath,
            name: 'name',
            url: uploadUrl,
            success: (res) => {
              resolve({"urls": [res.data.trim()]})
            }
          })
        }
      })
    })
  },
  deleteVideo: function(res) {
    var videoThumbs = this.data.videoThumbs
    var delIndex = res.detail.index
    var newVideoThumbs = []
    for(var i = 0; i < videoThumbs.length; i++) {
      if (i != delIndex) {
        newVideoThumbs.push(videoThumbs[i])
      }
    }
    this.setData({videoThumbs: newVideoThumbs})
  },
  uploadVideoSuccess: function(res) {
    var r = res.detail.urls
    var newVideoThumb = 'https://' + app.globalData.domainName.trim() + r[0]
    newVideoThumb = newVideoThumb.toLowerCase().replace('.mp4', '.jpg')
    var videoThumbs = this.data.videoThumbs
    videoThumbs.push({url: newVideoThumb})
    this.setData({videoThumbs: videoThumbs})
  }
  
})