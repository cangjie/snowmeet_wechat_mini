import fuiConfig from './components/firstui/fui-config/index'
var util = require('./utils/util.js')

function containsChinese(str) {
  return /[\u4e00-\u9fff]/.test(str)
}

function tryDecodeChinese(str) {
  if (typeof str !== 'string' || str.indexOf('%') < 0) {
    return str
  }
  try {
    var decoded = decodeURIComponent(str)
    return containsChinese(decoded) ? decoded : str
  }
  catch (e) {
    return str
  }
}

function decodeChineseInPostData(data) {
  if (data == null || data == undefined) {
    return data
  }
  if (Array.isArray(data)) {
    return data.map(function (item) {
      return decodeChineseInPostData(item)
    })
  }
  if (typeof data === 'object') {
    var out = {}
    Object.keys(data).forEach(function (key) {
      out[key] = decodeChineseInPostData(data[key])
    })
    return out
  }
  if (typeof data === 'string') {
    return tryDecodeChinese(data)
  }
  return data
}

function patchWxRequestPostDataDecoder() {
  if (wx.__snowmeetPostDataDecodedPatched) {
    return
  }
  var rawRequest = wx.request
  wx.request = function (options) {
    try {
      if (options && typeof options === 'object') {
        var method = (options.method || 'GET').toUpperCase()
        if (method === 'POST' && options.data != null) {
          options.data = decodeChineseInPostData(options.data)
        }
      }
    }
    catch (e) {
      console.warn('patch wx.request decode post data fail', e)
    }
    return rawRequest.call(wx, options)
  }
  wx.__snowmeetPostDataDecodedPatched = true
}

App({
  onLaunch: function (res) {
    patchWxRequestPostDataDecoder()
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
    //const app = getApp()
    if (res.query.staffId) {
      util.referStafffId = res.query.staffId
    }


  },
  loginPromiseNew: new Promise(function (resolve) {
    var that = this
    var app = getApp();
    console.log('start to log in.')
    wx.login({
      success: (res) => {
        const app = getApp()
        var fontUrl = 'https://' + app.globalData.domainName + '/font/thin.ttf'
        wx.loadFontFace({
          family: 'icon-font',
          source: 'url("' + fontUrl + '")',
          success: (res) => {
            console.log('load font', res)
          },
          fail: (res) => {
            console.log('load font', res)
          }
        })
        if (util.referStafffId) {
          app.globalData.referStaffId = util.referStafffId
        }
        const env = wx.getAccountInfoSync()
        app.globalData.env = env.miniProgram.envVersion
        if (!app.globalData.env || app.globalData.env == '') {
          app.globalData.env = 'trail'
        }

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
        util.performWebRequest(url, undefined).then(function (resolveData) {
          var session = resolveData
          app.globalData.sessionKey = encodeURIComponent(session.session_key)
          app.globalData.member = session.member
          app.globalData.staff = session.staff
          app.globalData.deviceInfo = wx.getDeviceInfo()
          app.globalData.windowInfo = wx.getWindowInfo()
          app.globalData.appBaseInfo = wx.getAppBaseInfo()
          wx.getSystemInfoAsync({
            success: (res) => {
              app.globalData.systemInfo = res
              const env = wx.getAccountInfoSync()
              app.globalData.env = env.miniProgram.envVersion
              if (app.globalData.staff
                && (app.globalData.scene == '1000'  || app.globalData.scene == '1010'
                || app.globalData.scene == '1089')) {
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

            },
            complete: (res) => {
              console.log('global data', app.globalData)
              resolve({})
              console.log('env', env)
            }
          })
        }).catch(function (err) {
          // MemberLogin 失败(后端返 code!=0, 如"获取会员信息失败"; 或网络非 200) 时,
          // 5-28 后 performWebRequest 会 reject + toast。必须 resolve 而非永远 pending,
          // 否则所有 page 的 app.loginPromiseNew.then(...) 永远不跑,页面集体卡死。
          // 下游页面用 sessionKey/member 时应做 null 兜底(如 payment_entry 已做)。
          console.warn('MemberLogin failed, resolving loginPromiseNew with empty session', err)
          resolve({})
        })
      },
      fail: (res) => {
        // wx.login 本身失败(极少见但可能):同样必须落地 loginPromiseNew,否则全局卡死
        console.warn('wx.login failed, resolving loginPromiseNew with empty session', res)
        resolve({})
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
        /*
        "iconPath": "images/book-3-line.png",
        "selectedIconPath": "images/book-3-line-hl.png",
*/
      },
      {
        "pagePath": "/pages/admin/equip_maintain/uploadimage/uploadimage",
        "text": "上传测试",
        /*
        "iconPath": "images/home-2-line.png",
        "selectedIconPath": "images/home-2-line-hl.png",
        */
      }
    ],
    userTabBarItem: [
      {
        "pagePath": "/pages/ski_pass/ski_pass_selector",
        "text": "预定"
        /*
        "iconPath": "/images/book-3-line.png",
        "selectedIconPath": "/images/book-3-line-hl.png"
        */
      },
      {
        "pagePath": "/pages/mine/mine",
        "text": "我的"
        /*
        "iconPath": "/images/home-2-line.png",
        "selectedIconPath": "/images/home-2-line-hl.png"
        */
      }
    ]
  }
})