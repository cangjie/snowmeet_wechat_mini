const app = getApp()
var wxloginModule = require('../../utils/wxlogin.js')
const data = require('../../utils/data.js')
const profileAuth = require('../../utils/profile_auth.js')
const tabbar = require('../../utils/tabbar.js')
const distributorMenu = require('../../utils/distributor_menu.js')
Page({

  /**
   * Page initial data
   */
  data: {
    role: '',
    canGetInfo: false,
    // 底部菜单里「我的」的下标，取自 utils/tabbar.js（次卡隐藏时是 1，显示时是 2）
    tabIndex: tabbar.tabIndexOf(tabbar.MINE_URL),
    // 教练入口：是教练才显示「我是教练」；领过学员卡才显示「我的学员卡」
    coach: null,
    hasCoachCard: false,
    // 分销商菜单区域（教练 / 机构）：身份和条目都由服务端 Distributor/GetMyDistributor 决定
    distributor: null,
    distributorTitle: '',
    distributorEntries: [],
    // 顶部头像昵称：顾客授权过就显示（取自 MemberProfile/GetMyProfile），没有就保持微信自带的默认显示
    profileAvatar: '',
    profileNick: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    //wxloginModule.wxlogin()
    
    
      var that = this
      const env = wx.getAccountInfoSync()
      app.globalData.env = env.miniProgram.envVersion
      // 所有版本统一使用 mini.snowmeet.top，不再按环境切换域名
      that.setData({env: app.globalData.env})
      app.loginPromiseNew.then(function(resolve) {
        that.setData({tabbarItemList: app.globalData.userTabBarItem, 
          staff: app.globalData.staff, canGetInfo: true, coach: app.globalData.coach || null})
      })
    
    
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {
    // 教练身份和学员卡每次显示都刷新：管理员中途把这个会员设为教练、或学员刚领了卡，不用重新登录
    var that = this
    app.loginPromiseNew.then(function () {
      var sessionKey = app.globalData.sessionKey
      if (!sessionKey) return
      data.getMyCoachPromise(sessionKey).then(function (d) {
        app.globalData.coach = d && d.isCoach ? d.coach : null
        that.setData({coach: app.globalData.coach})
      }).catch(function () {})
      data.getMyDistributorPromise(sessionKey).then(function (d) {
        var menu = distributorMenu.build(d)
        app.globalData.distributor = menu.distributor
        that.setData({distributor: menu.distributor, distributorTitle: menu.title, distributorEntries: menu.entries})
      }).catch(function () {})
      data.getMyCoachCardsPromise(sessionKey).then(function (d) {
        that.setData({hasCoachCard: !!(d && d.cards && d.cards.length)})
      }).catch(function () {})
      that._showProfile(sessionKey)
    })
  },

  // 顶部显示顾客自己授权的头像和昵称（2026-11-15 用户要求）。请求一次 GetMyProfile：
  //   已有资料 → 显示，并记下「这次运行不用再问」；
  //   没有资料（已绑手机号的老会员不会再走验证手机号入口，所以在这里补问）→ 弹层（可跳过），处理完立刻再取一次刷新顶部；
  //   本次运行里已经跳过 / 没有会员 / 请求失败 → 保持默认显示，不弹。
  _showProfile: function (sessionKey) {
    var that = this
    var show = function (res) {
      var view = profileAuth.profileView(res)
      that.setData({ profileAvatar: view.avatarUrl, profileNick: view.nickName })
    }
    return data.getMyProfilePromise(sessionKey).then(function (res) {
      if (profileAuth.hasProfile(res)) {
        profileAuth.markDone(app.globalData, sessionKey)
        show(res)
        return
      }
      show(res)
      if (!profileAuth.needPrompt(res) || profileAuth.isDone(app.globalData, sessionKey)) return
      return profileAuth.ensureOn(that).then(function () {
        return data.getMyProfilePromise(sessionKey).then(show)
      })
    }).catch(function () {})
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  },
  tabSwitch: function(e) {
    wx.redirectTo({
      url: e.detail.item.pagePath
    })
  },
  gotoOrders: function(e) {
    /*
    wx.navigateTo({
      url: 'plugin-private://wx34345ae5855f892d/pages/orderList/orderList?tabId=all',
     
    });
    */
  },
  gotoSkipass: function(e) {
    wx.navigateTo({
      url: '/pages/mine/skipass/my_skipasses',
    })
  },
  gotoAdmin: function(e) {
    wx.navigateTo({
      url: '/pages/admin/admin',
    })
  },
  gotoCoach: function(){
    wx.navigateTo({
      url: '/pages/coach/home/home',
    })
  },
  gotoDistributorEntry: function(e){
    var url = e.currentTarget.dataset.url
    if (!url) return
    wx.navigateTo({
      url: url,
    })
  },
  gotoCoachCard: function(){
    wx.navigateTo({
      url: '/pages/coach/card/card',
    })
  },
  gotoTicket: function(){
    wx.navigateTo({
      url: '/pages/mine/ticket/ticket_list',
    })
  },
  gotoSummerMaintain:function(){
    wx.navigateTo({
      url: '/pages/summer_maintain/my_summer_maintain',
    })
  },
  gotoMaintain(){
    wx.navigateTo({
      url: '/pages/mine/maintain/order_list',
    })
  },
  gotoDeposit(){
    wx.navigateTo({
      url: '/pages/mine/deposit/deposit_list',
    })
  },
  gotoPunchCards(){
    wx.navigateTo({
      url: '/pages/mine/my_punchcards',
    })
  },
  nav(e){
    var path = '/pages/index/index'
    var id = e.currentTarget.id
    switch(id) {
      case 'env':
        path = '/pages/admin/env'
      default:
        break
    }
    wx.navigateTo({
      url: path
    })
  }

})