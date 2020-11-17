//app.js
var crypto  = require('/utils/crypt.js')
App({
  onLaunch: function () {
    const updateManager = wx.getUpdateManager()

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

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        var url = 'https://' + this.globalData.domainName + '/api/get_login_info.aspx?code=' + res.code
        wx.request({
          url: url,
          header: {
            'content-type': 'application/json' // 默认值
          },
          success: res => {
            //console.log(res.data)
            try
            {
              this.globalData.sessionKey = res.data.session_key
              this.globalData.role = res.data.role
              /*
              if (this.globalData.role == 'staff') {
                wx.navigateTo({
                  url: '/pages/admin/equip_maintain/order_list/order_list_main',
                })
              }
              */
            }
            catch(errMsg)
            {
              console.log(errMsg)
            }
          }
        })

      }
    })
   
  },
  globalData: {
    appId:'wxd1310896f2aa68bb',
    domainName:'mini.snowmeet.top',
    userInfo: null,
    sessionKey:'',
    unionId:'',
    role:'',
    encryptedData: '',
    iv:'',
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
    ]
  }
})