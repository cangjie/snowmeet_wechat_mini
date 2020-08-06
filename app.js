//app.js
var crypto  = require('/utils/crypt.js')
App({
  onLaunch: function () {
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
              if (this.globalData.role == 'staff') {
                wx.navigateTo({
                  url: '/pages/admin/equip_maintain/search_order/search_order',
                })
              }
            }
            catch(errMsg)
            {
              console.log(errMsg)
            }
          }
        })

      }
    })
    // 获取用户信息
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
          wx.getUserInfo({
            success: res => {
              // 可以将 res 发送给后台解码出 unionId
              this.globalData.userInfo = res.userInfo
              this.globalData.encryptedData = res.encryptedData
              this.globalData.iv = res.iv
              wx.request({
                url: 'https://' + this.globalData.domainName + '/api/decode_encrypted_data.aspx',
                data:{
                  encdata: res.encryptedData,
                  sessionkey: this.globalData.sessionKey,
                  iv: res.iv
                },
                success: res => {
                  if (res.data.encdata == this.globalData.encryptedData && res.data.sessionkey == this.globalData.sessionKey && res.data.iv == this.globalData.iv) {
                    console.log('well')
                  }
                }
              })
              //console.log('注册成功123abc!@#','aes加密：',aes.aesEncrypt('注册成功123abc!@#'))
              //console.log(aes.aesEncrypt('注册成功123abc!@#'),'aes解密：',aes.aesDecrypt(aes.aesEncrypt('注册成功123abc!@#')))
            /*
              var encStr = crypto.encrypted("福田区", this.globalData.sessionKey, res.iv)
              console.log(encStr)//加密
              var decStr = crypto.decrypted(res.encryptedData, this.globalData.sessionKey, res.iv)
              console.log(decStr)//解密
*/
              // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
              // 所以此处加入 callback 以防止这种情况
              if (this.userInfoReadyCallback) {
                this.userInfoReadyCallback(res)
              }
            }
          })
        }
      }
    })
  },
  globalData: {
    appId:'wxd1310896f2aa68bb',
    domainName:'mini.luqinwenda.com',
    userInfo: null,
    sessionKey:'',
    unionId:'',
    role:'',
    encryptedData: '',
    iv:'',
    adminTabbarItem: [
      {
        "pagePath": "pages/index/index",
        "text": "订单",
        "iconPath": "images/zhihu-fill.png",
        "selectedIconPath": "images/zhihu-fill-hl.png",
        "pagePath": "/pages/admin/equip_maintain/search_order/search_order"
      },
      {
        "pagePath": "pages/test/scan/scan",
        "text": "签售",
        "iconPath": "images/book-3-line.png",
        "selectedIconPath": "images/book-3-line-hl.png",
        
      },
      {
        "pagePath": "pages/logs/logs",
        "text": "我的",
        "iconPath": "images/home-2-line.png",
        "selectedIconPath": "images/home-2-line-hl.png",
      }
    ]
  }
})