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

function resolveUiProfile(windowWidth) {
  var width = Number(windowWidth || 0)
  var isCompact = width > 0 && width <= 375
  return {
    windowWidth: width,
    isCompact: isCompact,
    fontScale: isCompact ? 0.92 : 1,
  }
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
        // icon-font(thin.ttf, 2MB) 只有旧版接待 components/rent/rent_recept 用到，
        // 已下沉到该组件按需加载，不再让所有用户冷启动都下这 2MB
        if (util.referStafffId) {
          app.globalData.referStaffId = util.referStafffId
        }
        const env = wx.getAccountInfoSync()
        app.globalData.env = env.miniProgram.envVersion
        if (!app.globalData.env || app.globalData.env == '') {
          app.globalData.env = 'trial'
        }

        // 所有版本（开发/体验/正式）统一使用 mini.snowmeet.top（见 globalData 默认值），
        // 不再按环境读 domain.txt 切换域名
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
          app.globalData.uiProfile = resolveUiProfile(app.globalData.windowInfo && app.globalData.windowInfo.windowWidth)
          wx.getSystemInfoAsync({
            success: (res) => {
              app.globalData.systemInfo = res
              app.globalData.uiProfile = resolveUiProfile(res && res.windowWidth)
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
                app.globalData.uiProfile = resolveUiProfile(app.globalData.systemInfo && app.globalData.systemInfo.windowWidth)
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
      domainName = 'mini.snowmeet.top'
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
    uiProfile: {
      windowWidth: 0,
      isCompact: false,
      fontScale: 1,
    },
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
    // ⚠️ 各页面的 tabIndex 是硬编码的（页面 data 里写死 0/1/2），
    // 往这个数组中间插项会让后面所有页面的高亮错位——增删项时必须同步检查
    // 所有用了 mp-tabbar 的页面：index / mine / ski_pass_selector / ski_pass_reserve / punchcard_shop
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
        "pagePath": "/pages/punchcard/punchcard_shop",
        "text": "次卡"
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