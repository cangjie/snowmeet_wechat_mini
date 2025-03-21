// components/auth/auth.js
const app = getApp()
function init(app, that) {
  //var that = this
  //const app = getApp()
  if (app.globalData.sessionKey != undefined && app.globalData.sessionKey != '' && app.globalData.userInfo == null) {
    var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetMiniUserOld?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      success: (res) => {
        if (res.data.status == 0 && res.data.count > 0){
          that.setData({miniUser: res.data.mini_users[0]})
          if (that.properties.validType == 'cell') {
            if (that.data.miniUser.cell_number == ''){
              var title = '需要您授权获取手机号'
              if (res.data.number != '') {
                title = '需要您重新授权获取手机号'
              }
              that.setData({show: true, validType: 'cell', title: title})
            }
            else {
              //that.triggerEvent("UpdateSuccess", {})
            }
          }

          
         
        }
      }
    })
  }

  if (that.properties.validType == 'info') {
    if (app.globalData.userInfo == null) {
      wx.getSetting({
        success: res => {
          if (res.authSetting['scope.userInfo']) {
            wx.getUserInfo({
              success: (res) => {
                var gender = ''
                switch(res.userInfo.gender) {
                  case 1:
                    gender = '男'
                    break
                  case 2:
                    gender = '女'
                    break
                  default:
                    break
                }
                app.globalData.userInfo = res.userInfo
                console.log('auth mini user update', res)
                var updateUrl = 'https://' +  app.globalData.domainName + '/api/mini_user_update.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&nick=' + encodeURIComponent(res.userInfo.nickName) + '&headimage=' + encodeURIComponent(res.userInfo.avatarUrl) + '&gender=' + encodeURIComponent(gender)
                wx.request({
                  url: updateUrl
                })
              }
            })
          }
          else {
            var show = true
            var title = '需要获取您的头像、昵称和性别'
            var validType = 'info'
            that.setData({show: show, title: title, validType: validType})
          }
        }
      })
    }
  }
  else if (that.properties.validType == 'cell') {
    
    var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetMiniUserOld?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      success: (res) => {
        if (res.statusCode == 200 && res.data.mini_users.length == 1){
          var miniUser = res.data.mini_users[0]
          if (miniUser.cell_number && miniUser.cell_number.length != 11){
            var title = '需要您授权获取手机号'
            that.setData({show: true, validType: 'cell', title: title})
          }
          else{
            console.log('auth success')
            that.triggerEvent("UpdateSuccess", {})
          }
        }
        /*
        if (res.data.status == 0){
          if (res.data.need_update==1) {
            var title = '需要您授权获取手机号'
            if (res.data.number != '') {
              title = '需要您重新授权获取手机号'
            }
            that.setData({show: true, validType: 'cell', title: title})
          }
          else {
            app.loginPromiseNew.then(function(resolve){
              console.log(resolve)
              that.triggerEvent("UpdateSuccess", {})
            })
            
          }
        }
        else{
          
        }
        */
      }
    })
    
  }
}
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
    if (app.globalData.sessionKey == null || app.globalData.sessionKey == '') {
      var that = this
      app.loginPromiseNew.then(function(resolve){
        init(app, that)
      })
    }
    else {
      init(app, this)
    }
    
  },
  
  /**
   * Component methods
   */
  methods: {
    getUserInfo: function(res) {
      app.globalData.userInfo = res.detail.userInfo
      console.log('auth success')
      this.setData({show: false})
    },
    getPhoneNumber: function(res) {
      if(res.detail.errMsg=='getPhoneNumber:ok')
      {
        var url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateUserInfo?sessionKey=' + encodeURIComponent(app.globalData.sessionKey)+'&encData='+encodeURIComponent(res.detail.encryptedData)+'&iv='+encodeURIComponent(res.detail.iv)
        wx.request({
          url: url,
          method: 'GET',
          success: res => {
            this.setData({show: false})
            app.globalData.cellNumber = res.data.phoneNumber
            //console.log('Auth UpdateSuccess', res)
            console.log('auth success')
            this.triggerEvent("UpdateSuccess", {})
          }
        })
      }
    }
  }
})
