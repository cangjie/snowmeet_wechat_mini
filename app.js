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

        const env = wx.getAccountInfoSync()
        app.globalData.env = env.miniProgram.envVersion
        switch(app.globalData.env){
          case 'trail':
          case 'develop':
            app.globalData.domainName = app.getDomain()
            break
          default:
            break
        }


        console.log('weixin log in success.', res)
        var url = 'https://' + app.globalData.domainName + '/core/MiniAppHelper/MemberLogin?code=' + res.code + '&openIdType=' + encodeURIComponent('wechat_mini_openid')
        wx.request({
          url: url,
          method: 'GET',
          success: (res) => {
            console.log('get seesionkey success', res)
            app.globalData.sessionKey = res.data.session_key
            var member = res.data.member
            var cell = ''
            for (var msa in member.memberSocialAccounts){
              if (msa.type == 'cell'){
                cell = msa.num
                break
              }
            }
            var userInfo = {open_id: '', union_id: '', cell_number: cell, real_name: member.real_name, gender: member.gender, nick: member.real_name, is_admin: member.is_admin, is_manager: member.is_manager, is_staff: member.is_staff}
            app.globalData.memberInfo = member
            app.globalData.userInfo = userInfo
            app.globalData.is_admin = member.is_admin
            app.globalData.is_manager = member.is_manager
            app.globalData.is_staff = member.is_staff
            if (member.is_admin || member.is_manager || member.is_staff){
              app.globalData.role = 'staff'
            }
            else{
              app.globalData.role = ''
            }
            console.log('app data', app.globalData)
            wx.getSystemInfoAsync({
              success:(res)=>{
                app.globalData.systemInfo = res
                //resolve(app.globalData)
                if ((app.globalData.is_admin == 1 || app.globalData.is_manager == 1 || app.globalData.is_manager == 1) && app.globalData.env != 'develop' && app.globalData.env != 'trail'  ){
                  wx.redirectTo({
                    url: '/pages/admin/admin',
                  })
                }
              },
              fail:(res)=>{
                console.log('get sys info fail, try sync', res)
                try{
                  app.globalData.systemInfo = wx.getSystemInfoSync()
                }
                catch(err){
                  console.log('get sys info sync fail', err)
                }
                //resolve(app.globalData)
                if (app.globalData.is_admin == 1 || app.globalData.is_manager == 1 || app.globalData.is_manager == 1){
                  wx.redirectTo({
                    url: '/pages/admin/admin',
                  })
                }
              },
              complete:(res)=>{
                
                //app.globalData.domainName = 'snowmeet.wanlonghuaxue.com'
                resolve(app.globalData)
                console.log('env', env)
              }
            })
          },
          fail:(res)=>{
            console.log('request fail', res)
          },
          complete:()=>{
            resolve(app.globalData)
          }
        })
      },
      fail:(res)=>{
        console.log(res)
      }
    })
    
  }),

  getDomain(){
    const fileManager = wx.getFileSystemManager();
    console.log('path', wx.env.USER_DATA_PATH)
    var domainName = ''
    try{
      fileManager.accessSync(wx.env.USER_DATA_PATH + '/domain.txt')
      domainName = fileManager.readFileSync(wx.env.USER_DATA_PATH + '/domain.txt', 'utf-8', 0)
    }
    catch{
      domainName = 'snowmeet.wanlonghuaxue.com'
      fileManager.writeFileSync(wx.env.USER_DATA_PATH + '/domain.txt', domainName, 'utf-8')
      //fileManager.closeSync()
    }
    return domainName
  },

  setDomain(domain){
    const fileManager = wx.getFileSystemManager();
    fileManager.writeFileSync(wx.env.USER_DATA_PATH + '/domain.txt', domain, 'utf-8')
    this.domainName = domain
  },

  globalData: {
    appId:'wxd1310896f2aa68bb',
    domainName:'mini.snowmeet.top',
    uploadDomain: 'xuexiaotupian.wanlonghuaxue.com',
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
      /*
      {
        "pagePath": "/pages/index/index",
        "text": "装备",
        "iconPath": "/images/equip.jpg",
        "selectedIconPath": "/images/equip.jpg"
      },
      */
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