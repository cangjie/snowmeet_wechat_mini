function wxlogin() {
  wx.checkSession({
    success: (res) => {

    },
    fail: (res) => {
      wx.login({
        success: res => {
          var url = 'https://' + this.globalData.domainName + '/api/get_login_info.aspx?code=' + res.code
          wx.request({
            url: url,
            header: {
              'content-type': 'application/json' // 默认值
            },
            success: res => {
              try
              {
                const app = getApp()
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