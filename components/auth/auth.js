// components/auth/auth.js
const app = getApp()
Component({
  /**
   * Component properties
   */
  properties: {
    validType: {
      type: String,
      value: "info"
    }
  },

  /**
   * Component initial data
   */
  data: {
    title: '需要获取您的头像、昵称和性别',
    show: false,
    validType: 'info'
  },
  ready: function() {
    if (this.properties.validType == 'info') {
      if (app.globalData.userInfo == null) {
        wx.getSetting({
          success: res => {
            if (res.authSetting['scope.userInfo']) {
              wx.getUserInfo({
                success: res => {
                  app.globalData.userInfo = res.userInfo
                }
              })
            }
            else {
              var show = true
              var title = '需要获取您的头像、昵称和性别'
              var validType = 'info'
              this.setData({show: show, title: title, validType: validType})
            }
          }
        })
      }
    }
    else if (this.properties.validType == 'cell') {
      var needGet = true
      if (needGet) {
        var title = '需要您授权获取手机号'
        this.setData({show: false, validType: 'cell'})
      }
    }
  },
  /**
   * Component methods
   */
  methods: {
    getUserInfo: function(res) {
      app.globalData.userInfo = res.detail.userInfo
      this.setData({show: false})
    }
  }
})
