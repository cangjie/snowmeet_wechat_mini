// pages/admin/school/lesson/detail_info.js
const util = require('../../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    id: 0,
    videoThumbs: [],
    instructors:[{open_id: '', name: '请选择……', head_image: '/images/unknown_person.png'}],
    instructorNames: ['请选择……'],
    instructorSelectedIndex: 0,
    formInvalidMessage: '',
    role: '',
    school_lesson:{
      cell_number: '',
      name: '',
      gender:'',
      student_name: '',
      student_gender: '',
      student_cell_number: '',
      student_gender: '',
      demand: '',
      videos: '',
      lesson_date: '',
      instructor_open_id: '',
      training_plan: ''
    }
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    //var videoThumbs = this.data.videoThumbs
    //videoThumbs.push({url: 'https://mini.snowmeet.top/upload/20210802/1627912001.jpg'})
    //this.setData({videoThumbs: videoThumbs})
    var pickerDateStart = '2021-8-1'
    var nowDate = new Date();
    var monthStr = (nowDate.getMonth() + 1).toString()
    var dayStr = nowDate.getDate().toString()
    //pickerDateStart = nowDate.getFullYear().toString() + '-' + '00'.substr(0, 2-monthStr.length) + monthStr + '-' + '00'.substr(0, 2 - dayStr.length) + dayStr;
    pickerDateStart = util.formatDate(nowDate)
    var endDate = new Date(nowDate.setMonth(nowDate.getMonth() + 4))
    var pickerDateEnd = util.formatDate(endDate)
    
    var schoolLesson = this.data.school_lesson
    schoolLesson.lesson_date = pickerDateStart
    this.setData({pickerDateStart: pickerDateStart, pickerDateEnd: pickerDateEnd, school_lesson: schoolLesson})


    var that = this
    app.loginPromiseNew.then(function(resolve){
      that.setData({role: app.globalData.role})
      if (options.id != undefined) {
        that.data.id = options.id
        var getSchoolLessonUrl = 'https://' + app.globalData.domainName.trim() + '/core/schoollesson/GetSchoolLesson/' + options.id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
        wx.request({
          url: getSchoolLessonUrl,
          method: 'GET',
          success: (res) => {
            console.log(res)
            var schoolLesson = res.data
            var lessonDate = new Date(schoolLesson.lesson_date.toString())
            schoolLesson.lesson_date = util.formatDate(lessonDate)
            var videoArr = schoolLesson.videos.split(',')
            var videoThumbs = []
            for(var i = 0; i < videoArr.length; i++){
              if (videoArr[i].trim() != ''){
                videoThumbs.push({url:videoArr[i].replace('.mp4', '.jpg')})
              }
            }
            var instructors = that.data.instructors
            var instructorIndex = 0;
            for(var i = 0; i < instructors.length; i++){
              if (instructors[i].open_id == schoolLesson.instructor_open_id) {
                instructorIndex = i
                break
              }
            }
            that.setData({school_lesson: res.data, videoThumbs: videoThumbs, instructorSelectedIndex: instructorIndex})
          }
        })
      }
    })


    wx.request({
      url: 'https://' + app.globalData.domainName + '/core/schoolstaff/getinstructor',
      method: 'GET',
      success: (res) => {
        var instructors = this.data.instructors
        var instructorNames = this.data.instructorNames
        for(var i in res.data) {
          instructors.push(res.data[i])
          instructorNames.push(res.data[i].name)
        }
        this.setData({instructors: instructors, instructorNames: instructorNames})
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
  uploadVideo: function(files) {
    var uploadUrl = 'https://' + app.globalData.domainName + '/upload_video.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    /*
    wx.uploadFile({
      filePath: files.thumbTempFilePath,
      name: 'name',
      url: uploadUrl,
      success: (res) => {
        console.log(res)
      }
    })
    return new Promise(function(resolve){
      //resolve({url: ['']})
    })
    */
    
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
    this.data.school_lesson.videos = videos
    this.setData({videoThumbs: newVideoThumbs})
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
    this.data.school_lesson.videos = videos
    this.setData({videoThumbs: videoThumbs})
  },
  inputValueChange: function(res) {
    var sourceId = res.currentTarget.id
    var inputedValue = res.detail.value.trim()
    switch(sourceId) {
      case 'cell_number':
        this.data.school_lesson.cell_number = inputedValue
        break
      case 'name':
        this.data.school_lesson.name = inputedValue
        break
      case 'gender':
        this.data.school_lesson.gender = inputedValue
        break
      case 'student_relation':
        this.data.school_lesson.student_relation = inputedValue
        if (inputedValue.trim() == '本人') {
          var school_lesson_temp = this.data.school_lesson
          school_lesson_temp.student_cell_number = this.data.school_lesson.cell_number
          school_lesson_temp.student_name = this.data.school_lesson.name
          school_lesson_temp.student_gender = this.data.school_lesson.gender
          this.setData({school_lesson: school_lesson_temp})
        }
        break
      case 'student_cell_number':
        this.data.school_lesson.student_cell_number = inputedValue
        break
      case 'student_name':
        this.data.school_lesson.student_name = inputedValue
        break
      case 'student_gender':
        this.data.school_lesson.student_gender = inputedValue
        break
      case 'demand':
        this.data.school_lesson.demand = inputedValue
        break
      case 'resort':
        this.data.school_lesson.resort = inputedValue
        break
      case 'training_plan':
        this.data.school_lesson.training_plan = inputedValue
        break
      case 'lesson_date':
        var school_lesson = this.data.school_lesson
        school_lesson.lesson_date = inputedValue
        this.setData({school_lesson: school_lesson})
        break;
      case 'instructor_picker':
        this.data.school_lesson.instructor_open_id = this.data.instructors[inputedValue].open_id
        this.setData({instructorSelectedIndex: inputedValue})
        break
      default:
        break
    }
  },
  submit: function() {
    var school_lesson = this.data.school_lesson
    if (school_lesson.cell_number == undefined || school_lesson.cell_number.length != 11 || school_lesson.cell_number.substr(0, 1) != '1') {
      this.setData({formInvalidMessage: '请填写正确的手机号。'})
      return
    }
    if (school_lesson.name == undefined || school_lesson.name.trim() == '') {
      this.setData({formInvalidMessage: '请填写姓名。'})
      return
    }
    if (school_lesson.gender == undefined || school_lesson.gender.trim() == '') {
      this.setData({formInvalidMessage: '请选择性别。'})
      return
    }
    if (school_lesson.student_relation == undefined || school_lesson.student_relation == '') {
      this.setData({formInvalidMessage: '请选择用户和学员的关系。'})
      return
    }
    if (school_lesson.student_cell_number == undefined || school_lesson.student_cell_number.length != 11 || school_lesson.student_cell_number.substr(0, 1) != '1') {
      this.setData({formInvalidMessage: '请填写正确的学员手机号。'})
      return
    }
    if (school_lesson.student_name == undefined || school_lesson.student_name.trim() == '') {
      this.setData({formInvalidMessage: '请填写学员姓名。'})
      return
    }
    if (school_lesson.student_gender == undefined || school_lesson.student_gender == '') {
      this.setData({formInvalidMessage: '请选择学员性别。'})
      return
    }
    if (school_lesson.resort == undefined || school_lesson.resort.trim() == '') {
      this.setData({formInvalidMessage: '请选择教学的雪场。'})
      return
    }
    if (school_lesson.instructor_open_id == undefined || school_lesson.instructor_open_id.trim() == '') {
      this.setData({formInvalidMessage: '请选择教练。'})
      return
    }
    if (school_lesson.training_plan == undefined || school_lesson.training_plan.trim() == '') {
      this.setData({formInvalidMessage: '请填写教学计划。'})
      return
    }

    if (this.data.id == 0)
    {
      var submitUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/PostSchoolLesson?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    
      wx.request({
        url: submitUrl,
        method: 'POST',
        data: school_lesson,
        success: (res) => {
          wx.navigateTo({
            url: './detail_confirm_order?id=' + res.data.id,
          })
        }
      })
    }
    else {
      var id = this.data.id.toString()
      var submitUrl = 'https://' + app.globalData.domainName + '/core/schoollesson/PutSchoolLesson/' + id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: submitUrl,
        method: 'PUT',
        data: school_lesson,
        success: (res) => {
          wx.navigateTo({
            url: './detail_confirm_order?id=' + id,
          })
        }
      })
    }
  },
  uploadTest: function(res) {
    wx.chooseMedia({
      count: 1,
      maxDuration: 60,
      sourceType:['album'],
      sizeType:['compressed'],
      mediaType:['video'],
      success:(res) => {
        wx.uploadFile({
          filePath: res.tempFiles[0].tempFilePath,
          name: 'name',
          url: 'https://' + app.globalData.domainName + '/upload_video.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey),
          success: (res) => {
            console.log(res)
          }
        })
      }
    })
  }
  
})