// pages/test/upload/choose_video_upload.js
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    app.loginPromiseNew.then(function(resolve){

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
  upload1: function(){
    wx.chooseMedia({
      count: 1,
      maxDuration: 60,
      sourceType:['album'],
      sizeType:['compressed'],
      mediaType:['video'],
      success: (res) => {
        var uploadUrl = 'https://' + app.globalData.domainName + '/upload_video.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
        //uploadUrl = 'https://mini.snowmeet.top/upload_video.aspx?sessionkey=rKYZc73RUrr93oriEAnkyw%3D%3D'
        wx.uploadFile({
          filePath: res.tempFiles[0].tempFilePath,
          name: 'test.mp4',
          url: uploadUrl,
          success: (res) => {
            console.log(res)
          }
        })
      }
    })
  },
  upload: function() {
    wx.chooseMedia({
      count: 1,
      maxDuration: 60,
      sourceType:['album'],
      sizeType:['compressed'],
      mediaType:['image', 'video'],
      success: (res) => {
        var uploadedFile = res.tempFiles[0]
        const mgr = wx.getFileSystemManager();
        var content = mgr.readFileSync(uploadedFile.tempFilePath)
        console.log(content)
      }
    })
  }
})