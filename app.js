import fuiConfig from './components/firstui/fui-config/index'
var util = require('./utils/util.js')
var authSession = require('./utils/authSession.js')

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

// 保持启动时立即登录；需身份的页面可通过 retryLogin 重新发起同一流程。
function startLogin() {
  return new Promise(function (resolve) {
    function failLogin(err) {
      console.warn('Login failed, resolving with empty session', err)
      authSession.resetAuthenticationState(getApp())
      resolve({
        authenticated: false,
        message: (typeof err === 'string' && err) || (err && (err.message || err.errMsg)) || '微信登录失败'
      })
    }

    console.log('start to log in.')
    wx.login({
      success: (res) => {
        const app = getApp()
        if (util.referStafffId) {
          app.globalData.referStaffId = util.referStafffId
        }
        const env = wx.getAccountInfoSync()
        app.globalData.env = env.miniProgram.envVersion
        if (!app.globalData.env || app.globalData.env == '') {
          app.globalData.env = 'trial'
        }

        // 开发、体验和正式版继续使用同一个域名。
        console.log('weixin log in success.', res)
        var url = 'https://' + app.globalData.domainName + '/api/MiniAppHelper/MemberLogin?code=' + res.code + '&openIdType=' + encodeURIComponent('wechat_mini_openid')
        util.performWebRequest(url, undefined).then(function (session) {
          if (!session || typeof session.session_key !== 'string' || !session.session_key.trim()) {
            throw new Error('未获取到有效微信会话')
          }
          app.globalData.sessionKey = encodeURIComponent(session.session_key)
          app.globalData.member = session.member
          app.globalData.staff = session.staff
          // 教练信息（不是教练为空）。教练中心、「我的」页入口用；管理员中途添加的教练在页面显示时再调 GetMyCoach 刷新
          app.globalData.coach = session.coach || null
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
            complete: () => {
              console.log('global data', app.globalData)
              resolve({ authenticated: true })
              console.log('env', env)
            }
          })
        }).catch(failLogin)
      },
      // 登录失败也要结束等待，避免所有依赖 loginPromiseNew 的页面永久卡住。
      fail: failLogin
    })
  })
}

// 店员进入小程序后，第一次落在首页或雪票选购页时自动进管理员菜单；落在其他页面
// （扫码、分享、付款等指定页面）不适用，不分冷热启动、不分场景。
const ENTRY_PATHS = ['pages/index/index', 'pages/ski_pass/ski_pass_selector']
const ADMIN_URL = '/pages/admin/admin'
const SHOP_URL = '/pages/punchcard/punchcard_shop'

function isEntryPath(path) {
  return typeof path === 'string' && ENTRY_PATHS.indexOf(path.replace(/^\//, '')) >= 0
}

function currentRoute() {
  if (typeof getCurrentPages !== 'function') return ''
  const pages = getCurrentPages()
  const page = pages && pages[pages.length - 1]
  return page && page.route ? '/' + page.route : ''
}

// 入口分流，首页冷启动（fromIndex）和后台重新进入共用。
// 「入口」指一次进入小程序：冷启动一次，每次从后台重新进入再算一次，用 entryRevision 区分。
// 同一入口里店员只自动进一次管理员菜单（entryHandledRevision），之后从菜单打开业务页、返回菜单、
// 主动回首页都不会再被弹回后台；回首页的普通落点是次卡商城。
// 入口落点 entryPath 取自 onLaunch / onShow 的 res.path。
function routeEntry(options, appRef) {
  const app = appRef || getApp()
  const fromIndex = !!(options && options.fromIndex)
  const revision = app.globalData.entryRevision
  return app.loginPromiseNew.then(function () {
    // 登录期间又换了入口（切后台、重新进入），这次结果作废
    if (revision !== app.globalData.entryRevision) return 'stale'
    const route = currentRoute()
    let target = ''
    if (app.globalData.staff
      && isEntryPath(app.globalData.entryPath)
      && app.globalData.entryHandledRevision !== revision) {
      app.globalData.entryHandledRevision = revision
      // 本次入口已经在管理员页，视为已处理，不重复跳
      if (route === ADMIN_URL) return 'stay'
      target = ADMIN_URL
    }
    else if (fromIndex) {
      target = SHOP_URL
    }
    if (!target) return 'stay'
    if (app.globalData.entryNavigating) return 'busy'
    app.globalData.entryNavigating = true
    // 冷启动时首页是唯一页面，redirectTo 即可；后台重新进入时页面栈里可能有业务页，用 reLaunch 清栈
    const navigate = fromIndex ? wx.redirectTo : wx.reLaunch
    navigate.call(wx, {
      url: target,
      complete: function () {
        app.globalData.entryNavigating = false
      },
      fail: function (err) {
        console.warn('entry route fail', { scene: app.globalData.scene, target: target, errMsg: err && err.errMsg })
        // 跳转没成功，撤回本次已处理标记，允许下一次重试
        if (target === ADMIN_URL && app.globalData.entryRevision === revision) {
          app.globalData.entryHandledRevision = 0
        }
      }
    })
    return target === ADMIN_URL ? 'admin' : 'shop'
  })
}

App({
  routeEntry: routeEntry,

  onLaunch: function (res) {
    patchWxRequestPostDataDecoder()
    wx.$fui = fuiConfig

    const updateManager = wx.getUpdateManager()
    this.globalData.scene = res.scene
    this.globalData.entryRevision = 1
    this.globalData.entryPath = res.path
    if (isEntryPath(res.path) && res.path.replace(/^\//, '') !== 'pages/index/index') {
      routeEntry({ fromIndex: false }, this)
    }
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
  // 冷启动落在首页时由首页 onLoad 调 routeEntry；落在雪票选购页的冷启动、以及所有从后台重新进入，在这里分流。
  onHide: function () {
    // 作废还没跑完的旧入口结果
    this.globalData.entryRevision += 1
    this._hidden = true
  },
  onShow: function (res) {
    if (!this._hidden) return
    this._hidden = false
    this.globalData.scene = res && res.scene
    this.globalData.entryPath = res && res.path
    routeEntry({ fromIndex: false }, this)
  },

  loginPromiseNew: startLogin(),
  startLogin: startLogin,

  retryLogin() {
    this.loginPromiseNew = this.startLogin()
    return this.loginPromiseNew
  },

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
    userInfo: null,
    sessionKey: '',
    entryRevision: 1,
    entryHandledRevision: 0,
    entryPath: '',
    entryNavigating: false,
    cellNumber: '',
    role: '',
    isWebsocketOpen: false,
    uiProfile: {
      windowWidth: 0,
      isCompact: false,
      fontScale: 1,
    },
    //wssUrl: 'wss://' + domainName + '/ws',
    // ⚠️ 各页面的 tabIndex 是硬编码的（页面 data 里写死 0/1/2），
    // 往这个数组中间插项会让后面所有页面的高亮错位——增删项时必须同步检查
    // 所有用了 mp-tabbar 的页面：index / mine / ski_pass_selector / punchcard_shop
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
