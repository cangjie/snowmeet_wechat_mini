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
    var app = getApp();
    console.log('start to log in.')
    wx.login({
      success:(res)=>{
        const app = getApp()
        console.log('weixin log in success.')
        console.log(res)
        var url = 'https://' + app.globalData.domainName + '/core/MiniAppHelper/Login?code=' + res.code
        wx.request({
          url: url,
          method: 'GET',
          success: (res) => {
            console.log('get seesionkey success')
            console.log(res)
            app.globalData.sessionKey = res.data.session_key
            
            url = 'https://' + app.globalData.domainName + '/core/MiniAppUser/GetMiniUserOld?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
            wx.request({
              url: url,
              method: 'GET',
              success: (res) => {
                console.log('get user info success')
                console.log(res)
                if (res.data.status == 0 && res.data.count > 0){
                  if (res.data.mini_users[0].is_admin == '1') {
                    app.globalData.role = 'staff'
                  }
                  if (res.data.mini_users[0].is_manager == '1') {
                    app.globalData.is_manager = true
                  }
                  else{
                    app.globalData.is_manager = false
                  }
                  app.globalData.cellNumber = res.data.mini_users[0].cell_number
                  app.globalData.userInfo = res.data.mini_users[0]
                  if (res.data.mini_users[0].nick == ''  || res.data.mini_users[0].nick == '微信用户'  || res.data.mini_users[0].head_image == '' || res.data.mini_users[0].gender == '') {
                    console.log('get user detail info')
                    wx.getUserInfo({
                      success: (res) => {
                        console.log('get user detail info success')
                        console.log(res)
                        var updateUrl = 'https://' + app.globalData.domainName + '/core/MiniAppUser/UpdateUserInfo?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&encData=' + encodeURIComponent(res.encryptedData) + '&iv=' + encodeURIComponent(res.iv)
                        wx.request({
                          url: updateUrl,
                          method: 'GET',
                          success:(res)=>{
                            console.log('user data updated', res)
                            app.globalData.userInfo = res.data
                            wx.getSystemInfoAsync({
                              success:(res)=>{
                                app.globalData.systemInfo = res
                                resolve(app.globalData)
                              },
                              fail:(res)=>{
                                console.log('get sys info fail, try sync', res)
                                try{
                                  app.globalData.systemInfo = wx.getSystemInfoSync()
                                }
                                catch(err){
                                  console.log('get sys info sync fail', err)
                                }
                                resolve(app.globalData)
                              }
                            })
                            
                          }
                        })
                      },
                      fail: (res) => {
                        console.log('get sys info fail, try sync', res)
                        try{
                          app.globalData.systemInfo = wx.getSystemInfoSync()
                        }
                        catch(err){
                          console.log('get sys info sync fail', err)
                        }
                        resolve(app.globalData)
                      }
                    })
                  }
                  else{
                    //resolve(app.globalData)



                    wx.getSystemInfoAsync({
                      success:(res)=>{
                        app.globalData.systemInfo = res
                        resolve(app.globalData)
                      },
                      fail:(res)=>{
                        console.log('get sys info fail', res)
                        app.globalData.systemInfo = wx.getSystemInfoSync()
                        resolve(app.globalData)
                      }
                    })
                  }
                }
              }
            })
          },
          fail:(res)=>{
            console.log('request fail', res)
          }
        })
      },
      fail:(res)=>{
        console.log(res)
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
        "pagePath": "/pages/ski_pass/ski_pass_selector",
        "text": "雪票",
        "iconPath": "/images/book-3-line.png",
        "selectedIconPath": "/images/book-3-line-hl.png"
      },
      
      {
        "pagePath": "/pages/mine/mine",
        "text": "我的",
        "iconPath": "/images/home-2-line.png",
        "selectedIconPath": "/images/home-2-line-hl.png"
      }
    ]
  }
})