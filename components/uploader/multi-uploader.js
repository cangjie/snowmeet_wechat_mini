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
    },
    uploaded_files:{
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

  lifetimes:{
    ready(){
      console.log('uploader ready')
      this.setData({
        selectFile: this.selectFile.bind(this),
        uploadFile: this.uploadFile.bind(this)
      })
      var uploadedFilesArr = this.properties.uploaded_files.split(',')
      var files = this.data.files
      for(var i = 0; i < uploadedFilesArr.length; i++) {
        if (uploadedFilesArr[i].trim() != '') {
          files.push({url: uploadedFilesArr[i].trim()})
        }
      }
      this.setData({files: files})
    }
  },


  /**
   * Component methods
   */
  methods: {
    click(e){
      console.log('click', e)
    },
    selectFile: function(files) {
      console.log('files', files)
      return true
      // 返回false可以阻止某次文件上传
    },
    uploadFile: function(files) {
      console.log('upload files', files)
      var uploadUrl = 'https://' + app.globalData.domainName + '/api/UploadFile/Upload/' + app.globalData.sessionKey
      // 文件上传的函数，返回一个promise
      return new Promise((resolve, reject) => {
        for(var i = 0; i < files.tempFilePaths.length; i++)
        {
        
          wx.uploadFile({
            filePath: files.tempFilePaths[i],
            name: 'file',
            url: uploadUrl,
            success: (res)=>{
              // wx.uploadFile 的 success 对任何 HTTP 状态码都会触发（400/401/500 也进这里）。
              // 不判 statusCode 的话，错误响应体（JSON/HTML）会被当成文件路径拼进 URL 存库，
              // 上传界面看着成功、库里存的却是垃圾地址，顾客端 <image> 只能显示空白。
              if (res.statusCode < 200 || res.statusCode >= 300) {
                console.error('multi-uploader 上传失败', res.statusCode, res.data)
                wx.showToast({ title: '图片上传失败', icon: 'none' })
                return
              }
              var filesData = this.data.files
              //var filesData = [{url: 'http://mini.luqinwenda.com/upload/1596954732.jpg'}]
              var uploadFilesData = res.data.split(',')
              var added = 0
              for(var i = 0; i < uploadFilesData.length; i++) {
                var path = (uploadFilesData[i] || '').trim()
                // 正常返回的是以 / 开头的站内相对路径；不是这个形状就说明拿到的不是上传结果，别往库里存
                if (path.charAt(0) != '/') {
                  console.error('multi-uploader 返回值不是文件路径', uploadFilesData[i])
                  continue
                }
                filesData.push({url: 'https://' + app.globalData.domainName + path})
                added++
              }
              if (added == 0) {
                wx.showToast({ title: '图片上传失败', icon: 'none' })
                return
              }
              this.setData({files: filesData})
              this.triggerEvent('Uploaded', {files: filesData}, "100")
              console.log(res)
            },
            fail: (res)=>{
              console.error('multi-uploader 上传失败', res)
              wx.showToast({ title: '图片上传失败', icon: 'none' })
            }
          })
        }
      })
    },
    delete: function(e) {
      var deleteIndex = e.detail.index
      var files = this.data.files
      var newFiles = []
      for(var i = 0; i < files.length; i++) {
        if (i != deleteIndex) {
          newFiles.push(files[i])
        }
      }
      this.setData({files: newFiles})
      this.triggerEvent('Uploaded', {files: newFiles}, "100")
    }
  },
  
})
