// components/school_lesson_info/school_lesson_info.js
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
  ready: function(e){
    var role = app.globalData.role
    var getInfoUrl = 'https://' + app.globalData.domainName + '/core/' + ((role.trim() != 'staff')? 'custom/' : '') + 'schoollesson/' + this.properties.lesson_id + '?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    var that = this
    wx.request({
      url: getInfoUrl,
      method: 'GET',
      success: (res) => {
        that.setData({school_lesson: res.data})
      }
    })
  }
})
