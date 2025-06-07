import fuiConfig from './components/firstui/fui-config/index'
var util = require('./utils/util.js')
App({
  onLaunch: function (res) {
    wx.$fui = fuiConfig
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
  loginPromiseNew: new Promise(function (resolve) {
    var app = getApp();
    console.log('start to log in.')
    wx.login({
      success: (res) => {
        const app = getApp()
        const env = wx.getAccountInfoSync()
        app.globalData.env = env.miniProgram.envVersion
        switch (app.globalData.env) {
          case 'trail':
          case 'develop':
            app.globalData.domainName = app.getDomain()
            app.globalData.requestPrefix = 'https://' + app.globalData.domainName + '/api/'
            break
          default:
            break
        }
        console.log('weixin log in success.', res)
        var url = 'https://' + app.globalData.domainName + '/api/MiniAppHelper/MemberLogin?code=' + res.code + '&openIdType=' + encodeURIComponent('wechat_mini_openid')
        //var url = app.globalData.requestPrefix + 'MiniAppHelper/MemberLogin?code=' + res.code + '&openIdType=' + encodeURIComponent('wechat_mini_openid')
        util.performWebRequest(url, undefined).then(function (resolveData) {
          var session = resolveData
          app.globalData.sessionKey = encodeURIComponent(session.session_key)
          app.globalData.member = session.member
          app.globalData.staff = session.staff
          wx.getSystemInfoAsync({
            success: (res) => {
              app.globalData.systemInfo = res
              //resolve(app.globalData)
              if ((app.globalData.is_admin == 1 || app.globalData.is_manager == 1 || app.globalData.is_manager == 1) && app.globalData.env != 'develop' && app.globalData.env != 'trail') {
                wx.redirectTo({
                  url: '/pages/admin/admin',
                })
              }
            },
            fail: (res) => {
              console.log('get sys info fail, try sync', res)
              try {
                app.globalData.systemInfo = wx.getSystemInfoSync()
              }
              catch (err) {
                console.log('get sys info sync fail', err)
              }
              if (app.globalData.staff) {
                wx.redirectTo({
                  url: '/pages/admin/admin',
                })
              }
            },
            complete: (res) => {
              resolve({})
              console.log('env', env)
            }
          })
        })
      },
      fail: (res) => {
        console.log(res)
      }
    })

  }),

  getDomain() {
    const fileManager = wx.getFileSystemManager();
    console.log('path', wx.env.USER_DATA_PATH)
    var domainName = ''
    try {
      fileManager.accessSync(wx.env.USER_DATA_PATH + '/domain.txt')
      domainName = fileManager.readFileSync(wx.env.USER_DATA_PATH + '/domain.txt', 'utf-8', 0)
    }
    catch {
      domainName = 'snowmeet.wanlonghuaxue.com'
      fileManager.writeFileSync(wx.env.USER_DATA_PATH + '/domain.txt', domainName, 'utf-8')
    }
    this.globalData.requestPrefix = 'https://' + domainName + '/api/'
    return domainName
  },

  setDomain(domain) {
    const fileManager = wx.getFileSystemManager();
    fileManager.writeFileSync(wx.env.USER_DATA_PATH + '/domain.txt', domain, 'utf-8')
    this.domainName = domain
    this.requestPrefix = 'https://' + this.domainName + '/api/'
  },
  globalData: {
    appId: 'wxd1310896f2aa68bb',
    domainName: 'mini.snowmeet.top',
    requestPrefix: 'https://mini.snowmeet.top/api/',
    uploadDomain: 'xuexiaotupian.wanlonghuaxue.com',
    userInfo: null,
    sessionKey: '',
    cellNumber: '',
    role: '',
    isWebsocketOpen: false,
    //wssUrl: 'wss://' + domainName + '/ws',
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