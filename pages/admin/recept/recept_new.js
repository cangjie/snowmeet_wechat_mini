// pages/admin/recept/recept_new.js
const util = require("../../../utils/util")
const data = require('../../../utils/data.js')
const app = getApp()

Page({

  /**
   * Page initial data
   */
  data: {
    showUserInfo: false,
    bizType:'sale',
    receptId: null,
    showSummary: false,
    showMainComponent: true
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({bizType: options.bizType,
      shop: options.shop,
      memberId: options.memberId? options.memberId : null,
      realName: options.realName? options.realName: null,
      gender: options.gender? options.gender : null,
      cell: options.cell? options.cell: null,
    })
    var title = ''
    switch(that.data.bizType)
    {
      case 'rent':
        title = '租赁开单'
        break
      case 'care':
        title = '养护开单'
        break
      case 'sale':
        title = '零售开单'
        break
      defaut:
        break
    }
    wx.setNavigationBarTitle({
      title: title,
    })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  onShow() {
    var that = this
    app.loginPromiseNew.then(function (resolve){
      if (that.data.memberId){
        data.getMemberPromise(that.data.memberId, app.globalData.sessionKey).then(function (member){
          var degree = '会员'
          if (member.following_wechat != 1){
            degree += ' 取关'
          }
          var realName = that.data.realName? that.data.realName : member.real_name
          var cell = that.data.cell ? that.data.cell : member.cell
          var gender = that.data.gender? that.data.gender: member.gender
         
          
          that.setData({member, degree, realName, cell, gender})
        }).catch(function (reject){

        })
      }
      else{
        that.setData({degree: '散客', memberId: null})
      }
    })
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide() {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload() {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh() {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom() {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage() {

  },
  showUserInfo(){

    var that = this
    if (that.data.degree != '散客'){
      that.setData({showUserInfo: true})
    }
  },
  closeUserInfo(e){
    var that = this
    that.setData({showUserInfo: false})
  },
  /*
  getData(){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Recept/GetUnfinishedRecept?bizType=' + encodeURIComponent(that.data.bizType) + '&name=' + encodeURIComponent(that.data.name) + '&gender=' + encodeURIComponent(that.data.gender) 
    + '&num=' + that.data.contactNum + '&memberId=' + that.data.memberId + '&shop=' + encodeURIComponent(that.data.shop) + '&sessionKey=' + app.globalData.sessionKey
    if (that.data.receptId){
      getUrl = app.globalData.requestPrefix + 'Recept/'
    }
    console.log('get url', getUrl)    
  },
  getMember(){
    var that = this
    var getUrl = app.globalData.requestPrefix + 'Member/GetMember/' + that.data.memberId + '?sessionKey=' + app.globalData.sessionKey + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    util.performWebRequest(getUrl, null).then(function(resolve){
      console.log('get member', resolve)
      that.setData({showMainComponent: false})
      that.setData({member: resolve})
      that.setData({showMainComponent: true})
    }).catch(function(reject){

    })
  },
  */
  onPopClose(){
    var that = this
    that.setData({showUserInfo:false})
  }
})