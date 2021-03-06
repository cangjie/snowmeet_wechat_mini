//app.js
var crypto  = require('/utils/crypt.js')
App({
  onLaunch: function (res) {
    const updateManager = wx.getUpdateManager()
    this.globalData.scene = res.scene
    updateManager.onCheckForUpdate(function (res) {
      // 请求完新版本信息的回调
      console.log(res.hasUpdate)
    })

    updateManager.onUpdateReady(function () {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success(res) {
          if (res.confirm) {
            // 新的版本已经下载好，调用 applyUpdate 应用新版本并重启
            updateManager.applyUpdate()
          }
        }
      })
    })

    updateManager.onUpdateFailed(function () {
      // 新版本下载失败
    })



    // 展示本地存储能力
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

  
  },
  loginPromiseNew: new Promise(function(resolve){
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
              var getUserInfoPromise = new Promise(function(resolve) {
                var url = 'https://' + app.globalData.domainName + '/api/mini_user_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
                wx.request({
                  url: url,
                  success: (res) => {
                    if (res.data.status == 0 && res.data.count > 0){
                      if (res.data.mini_users[0].is_admin == '1') {
                        app.globalData.role = 'staff'
                      }
                      if (res.data.mini_users[0].nick == '' || res.data.mini_users[0].head_image == '' || res.data.mini_users[0].gender == '') {
                        wx.getUserInfo({
                          success: (res) => {
                            if (res.userInfo != null) {
                              app.globalData.userInfo = res.userInfo
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
                              app.globalData.userInfo.gender = gender
                              var updateUrl = 'https://' +  app.globalData.domainName + '/api/mini_user_update.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&nick=' + encodeURIComponent(app.globalData.userInfo.nickName) + '&headimage=' + encodeURIComponent(app.globalData.userInfo.avatarUrl) + '&gender=' + encodeURIComponent(gender)
                              wx.request({
                                url: updateUrl
                              })
                              
                            }
                          }
                        })
                      }
                      else {
                        app.globalData.userInfo = {avatarUrl: res.data.mini_users[0].head_image, nickName: res.data.mini_users[0].nick, gender: res.data.mini_users[0].gender}
                      }
                    }
                    resolve(app.globalData)
                  }
                })
                
              })
              
              getUserInfoPromise.then(function(resolveMsg){
                resolve(app.globalData)
              })
              
            }
            catch(errMsg)
            {
              console.log(errMsg)
            }
          }
        })

      }
    })
  }),
  loginPromise: new Promise(function(resolve){
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
              var getUserInfoPromise = new Promise(function(resolve) {
                var url = 'https://' + app.globalData.domainName + '/api/mini_user_get.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
                wx.request({
                  url: url,
                  success: (res) => {
                    if (res.data.status == 0 && res.data.count > 0){
                      if (res.data.mini_users[0].is_admin == '1') {
                        app.globalData.role = 'staff'
                      }
                      if (res.data.mini_users[0].nick == '' || res.data.mini_users[0].head_image == '' || res.data.mini_users[0].gender == '') {
                        wx.getUserInfo({
                          success: (res) => {
                            if (res.userInfo != null) {
                              app.globalData.userInfo = res.userInfo
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
                              app.globalData.userInfo.gender = gender
                              var updateUrl = 'https://' +  app.globalData.domainName + '/api/mini_user_update.aspx?sessionkey=' + encodeURIComponent(app.globalData.sessionKey) + '&nick=' + encodeURIComponent(app.globalData.userInfo.nickName) + '&headimage=' + encodeURIComponent(app.globalData.userInfo.avatarUrl) + '&gender=' + encodeURIComponent(gender)
                              wx.request({
                                url: updateUrl
                              })
                              
                            }
                          }
                        })
                      }
                      else {
                        app.globalData.userInfo = {avatarUrl: res.data.mini_users[0].head_image, nickName: res.data.mini_users[0].nick, gender: res.data.mini_users[0].gender}
                      }
                    }
                    resolve('')
                  }
                })
                
              })
              
              getUserInfoPromise.then(function(resolveMsg){
                resolve(res.data.session_key)
              })
              
            }
            catch(errMsg)
            {
              console.log(errMsg)
            }
          }
        })

      }
    })
  }),
  globalData: {
    appId:'wxd1310896f2aa68bb',
    domainName:'mini.snowmeet.top',
    userInfo: null,
    sessionKey:'',
    cellNumber: '',
    role:'',
    adminTabbarItem: [
      {
        "text": "养护",
        "iconPath": "/images/icons/icon_maintain_white.jpg",
        "selectedIconPath": "/images/icons/icon_maintain_white.jpg",
        "pagePath": "/pages/admin/equip_maintain/search_order/search_order"
      },
      {
        "text": "订单",
        "iconPath": "images/zhihu-fill.png",
        "selectedIconPath": "images/zhihu-fill-hl.png",
        "pagePath": "/pages/test/upload/upload"
      },
      {
        "pagePath": "/pages/admin/equip_maintain/uploadimage/uploadimage",
        "text": "上传测试",
        "iconPath": "images/book-3-line.png",
        "selectedIconPath": "images/book-3-line-hl.png",
        
      },
      {
        "pagePath": "/pages/admin/equip_maintain/uploadimage/uploadimage",
        "text": "上传测试",
        "iconPath": "images/home-2-line.png",
        "selectedIconPath": "images/home-2-line-hl.png",
      }
    ],
    userTabBarItem: [
      {
        "pagePath": "/pages/index/index",
        "text": "装备",
        "iconPath": "/images/equip.jpg",
        "selectedIconPath": "/images/equip.jpg"
      },
      {
        "pagePath": "/pages/skipass/skipass",
        "text": "雪票",
        "iconPath": "images/book-3-line.png",
        "selectedIconPath": "images/book-3-line-hl.png"
      },
      {
        "pagePath": "/pages/mine/mine",
        "text": "我的",
        "iconPath": "images/home-2-line.png",
        "selectedIconPath": "images/home-2-line-hl.png"
      }
    ]
  }
})