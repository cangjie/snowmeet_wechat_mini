// pages/mine/deposit/deposit_list.js
const util = require('../../../utils/util')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {

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
    app.loginPromiseNew.then(function(resolve){
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
  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/Deposit/GetMyAccounts?type=' + encodeURIComponent('服务储值') + '&subType=&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        console.log('accounts', res)
        var accounts = res.data
        for(var i = 0; i < accounts.length; i++){
          var a = accounts[i]
          a.avaliableAmountStr = util.showAmount(a.avaliableAmount)
          a.income_amountStr = util.showAmount(a.income_amount)
          a.consume_amountStr = util.showAmount(a.consume_amount)
          for(var j = 0; j < a.balances.length; j++){
            var b = a.balances[j]
            var createDate = new Date(b.create_date)
            b.dateStr = util.formatDate(createDate)
            b.timeStr = util.formatTimeStr(createDate)
            b.type = b.amount > 0 ? '收入' : '消费'
            
            
            if (b.order != null){
              b.orderType = ((b.order.type == '服务')? '养护' : '租赁')
              b.amount = -1 * b.amount
            }
            else {
              b.orderType = '——'
            }
            b.amountStr = util.showAmount(b.amount)
          }
        }
        that.setData({accounts})
      }
    }) 
  }
})