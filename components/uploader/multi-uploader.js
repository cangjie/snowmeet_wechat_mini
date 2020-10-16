// components/uploader/multi-uploader.js
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    detail_id: {
      type: String,
      value: '0'
    },
    image_count: {
      type: String,
      value: '3'
    },
    title:{
      type: String,
      value: ''
    }
  },
  /**
   * Component initial data
   */
  data: {
    files:[]
  },
  pageLifetimes: {
    show: function() {
      this.setData({
        selectFile: this.selectFile.bind(this),
        uploadFile: this.uploadFile.bind(this)
      })
    }
  },
  /**
   * Component methods
   */
  methods: {
    selectFile: function(files) {
      console.log('files', files)
      // 返回false可以阻止某次文件上传
    },
    uploadFile: function(files) {
      console.log('upload files', files)
      var uploadUrl = 'https://' + app.globalData.domainName + '/upload.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      // 文件上传的函数，返回一个promise
      return new Promise((resolve, reject) => {
        for(var i = 0; i < files.tempFilePaths.length; i++)
        {
          
          wx.uploadFile({
            filePath: files.tempFilePaths[i],
            name: 'name',
            url: uploadUrl,
            success: (res)=>{
              var filesData = this.data.files
              //var filesData = [{url: 'http://mini.luqinwenda.com/upload/1596954732.jpg'}]
              var uploadFilesData = res.data.split(',')
              for(var i = 0; i < uploadFilesData.length; i++) {
                filesData.push({url: 'https://' + app.globalData.domainName + uploadFilesData[i]})
              }
              this.setData({files: filesData})
              this.triggerEvent('Uploaded', {files: filesData}, "100")
              console.log(res)
            },
            fail: (res)=>{
              console.log(res)
            }
          })
        }
      })
    }
  },
  
})
