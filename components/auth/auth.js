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
      var url = 'https://' + app.globalData.domainName + '/api/cell_number_used_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: url,
        success: res => {
          if (res.data.status == 0){
            if (res.data.need_update==1) {
              var title = '需要您授权获取手机号'
              if (res.data.number != '') {
                title = '需要您重新授权获取手机号'
              }
              this.setData({show: true, validType: 'cell', title: title})
            }
            else {
              this.triggerEvent("UpdateSuccess", {})
            }
          }
          else{
            
          }
        }
      })
    }
  },
  /**
   * Component methods
   */
  methods: {
    getUserInfo: function(res) {
      app.globalData.userInfo = res.detail.userInfo
      this.setData({show: false})
    },
    getPhoneNumber: function(res) {
      if(res.detail.errMsg=='getPhoneNumber:ok')
      {
        var url = 'https://' + app.globalData.domainName + '/api/cell_number_update.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)+'&encdata='+encodeURIComponent(res.detail.encryptedData)+'&iv='+encodeURIComponent(res.detail.iv)
        wx.request({
          url: url,
          success: res => {
            this.setData({show: false})
            app.globalData.cellNumber = res.data.phoneNumber
            this.triggerEvent("UpdateSuccess", {})
          }
        })
      }
    }
  }
})
