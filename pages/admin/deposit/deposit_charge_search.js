// pages/admin/deposit/deposit_charge_search.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    dealing: false,
    key: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {

  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady() {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow() {
    var that = this
    app.loginPromiseNew.then(function(resovle){
      that.getData()
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
  setKey(e){
    var that = this
    that.setData({key: e.detail.value})
  },
  getData(){
    var that = this
    var key = that.data.key
    if (!key || (!isNaN(key) && key.length < 4) || key.length <= 1){
      wx.showToast({
        title: '比如是手机号后四位或者姓名。',
        icon: 'error'
      })
      return
    }
    that.setData({dealing: true})
    var url = 'https://' + app.globalData.domainName + '/core/deposit/SearchMember?key=' + encodeURIComponent(key) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        console.log('get members', res.data)
        var members = res.data
        for(var i = 0; i < members.length; i++){
          var member = members[i]
          var order = undefined
          if (member.orders && member.orders.length > 0){
            order = member.orders[0]
          }
          member.orderDateStr = '——'
          member.orderAmountStr = '——'
          if (order){
            member.orderDateStr = util.formatDate(new Date(order.pay_time))
            member.orderAmountStr = util.showAmount(order.paidAmount)
          }
          if (member.depositAccounts && member.depositAccounts.length > 0){
            member.haveDeposit = '有'
            member.depositAmountStr = util.showAmount(member.depositAccounts[0].income_amount)
          }
          else{
            member.haveDeposit = '无'
            member.depositAmountStr = '——'
          }
        }
        that.setData({members})

      },
      complete:(res)=>{
        that.setData({dealing: false})
      }
    })
  },
  gotoCharge(e){
    var that = this
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'deposit_charge?memberId=' + id.toString(),
    })
  }

})