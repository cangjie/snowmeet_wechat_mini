function wxlogin() {
  wx.checkSession({
    success: (res) => {
      const app = getApp()
      var url = 'https://' + app.globalData.domainName + '/api/check_session_key.aspx?sessionkey=' + app.globalData.sessionKey
      wx.request({
        url: url,
        success: (res) => {
          if (res.data.status == 0) {
            app.globalData.role = res.data.role
          }
        }
      })
      
    },
    fail: (res) => {
      wx.login({
        success: res => {
          const app = getApp()
          var url = 'https://' + app.globalData.domainName + '/api/get_login_info.aspx?code=' + res.code
          wx.request({
            url: url,
            header: {
              'content-type': 'application/json' // 默认值
            },
            success: res => {
              try
              {
                
                app.globalData.sessionKey = res.data.session_key
                app.globalData.role = res.data.role
              }
              catch(errMsg)
              {
                console.log(errMsg)
              }
            } 
          })
        }
      })
    }
  })

}
module.exports={
  wxlogin: wxlogin
}