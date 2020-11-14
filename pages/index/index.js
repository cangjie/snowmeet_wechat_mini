//index.js
//获取应用实例
const app = getApp()

Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo')
  },
  //事件处理函数
  bindViewTap: function() {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },
  onLoad: function () {

    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else if (this.data.canIUse){
      // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
      // 所以此处加入 callback 以防止这种情况
      app.userInfoReadyCallback = res => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    } else {
      // 在没有 open-type=getUserInfo 版本的兼容处理
      wx.getUserInfo({
        success: res => {
          app.globalData.userInfo = res.userInfo
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    }
    
  },
  onShow: function(e) {
    if (app.globalData.role == 'staff') {
      /*
      wx.navigateTo({
        url: '/pages/admin/equip_maintain/search_order/search_order',
      })
      */
    }

    this.setData({tabbarItemList: app.globalData.userTabBarItem, tabIndex: 0})
    var url = 'https://' + app.globalData.domainName + '/api/mini_shop_products_list_get.aspx'
    wx.request({
      url: url,
      success: (res) => {
        if (res.data.errcode==0){
          var productsPairListArray = []
          var pair = []
          for(var i = 0; i < res.data.spus.length; i++) {
            if (i % 2 == 0) {
              pair = []
            }
            pair.push(res.data.spus[i])
            if (i % 2 == 1) {
              productsPairListArray.push(pair)
            }
          }
          if (pair.length == 1){
            pair.push({title: ''})
            productsPairListArray.push(pair)
          }
          this.setData({productsPairListArray: productsPairListArray})
        }
        
      }
    })


  },
  getUserInfo: function(e) {
    console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },
  jump: function(e){

    /*
    wx.removeTabBarBadge({
      index: 0
    })
    
    wx.removeTabBarBadge({
      index: 1
    })
    wx.removeTabBarBadge({
      index: 2
    })
    */
    wx.navigateTo({
      url: '/pages/test/tab/tab',
    })
  },
  gotoDetail: function(e) {
    var id = e.currentTarget.id
    var path = ''
    for(var i = 0; i < this.data.productsPairListArray.length; i++) {
      if (this.data.productsPairListArray[i][0].product_id == id) {
        path = this.data.productsPairListArray[i][0].path
      }
      else if (this.data.productsPairListArray[i][1].title != '') {
        path = this.data.productsPairListArray[i][1].path
      }
      else {

      }
    }
    if (path!='') {
      wx.navigateTo({
        url: path
      })
    }
  },
  tabSwitch: function(e) {
    wx.navigateTo({
      url: e.detail.item.pagePath
    })
  }
})
