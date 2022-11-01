// components/school_lesson_info/school_lesson_info.js
const util = require('../../utils/util.js')
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    lesson_id:{
      type: String,
      value: '0'
    }
  },

  /**
   * Component initial data
   */
  data: {

  },

  /**
   * Component methods
   */
  methods: {

  },
  lifetimes: {
    attached: function(e){
      var id = this.properties.lesson_id
      var that = this
      app.loginPromiseNew.then(function(resolve){
        var getInfoUrl = 'https://' + app.globalData.domainName + '/core/'  + 'schoollesson/GetSchoolLesson/' + id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&cell=' + app.globalData.cellNumber
        
        wx.request({
          url: getInfoUrl,
          method: 'GET',
          success: (res) => {
            var school_lesson = res.data
            school_lesson.instructor_name = ''
            try{
              var lessonDate = new Date(school_lesson.lesson_date)
              school_lesson.lesson_date = util.formatDate(lessonDate)
            }
            catch(err){

            }
          //that.setData({school_lesson: res.data})
          /*
            var getInstrucorUrl = 'https://' + app.globalData.domainName + '/core/schoolstaff/getinstructor'
            wx.request({
              url: getInstrucorUrl,
              method: 'GET',
              success: (res) => {
                var instructors = res.data
                for(var i in instructors) {
                  if (instructors[i].open_id == school_lesson.instructor_open_id) {
                    school_lesson.instructor_name = instructors[i].name
                  }
                }
                that.setData({school_lesson: school_lesson})
              }
            })
            */
          }
        })
      })
    }
  },
  pageLifetimes:{
    
    show: function(e){
      

    }
  },
  ready: function(e){
    
    
  }
})
