// pages/admin/deposit/deposit_list.js
const util = require('../../../utils/util.js')
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    key: '',
    dealing: false
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
    var url = 'https://' + app.globalData.domainName + '/core/deposit/SearchDepositAccounts?key=' + encodeURIComponent(that.data.key) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    that.setData({dealing: true})
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          //that.setData({dealing: false})
          return
        }
        var accounts = res.data
        var totalIncome = 0
        var totalConsume = 0
        for(var i = 0; i < accounts.length; i++){
          var a = accounts[i]
          var date = new Date(a.create_date)
          a.dateStr = util.formatDate(date)
          a.timeStr = util.formatTimeStr(date)
          a.income_amountStr = util.showAmount(a.income_amount)
          a.consume_amountStr = util.showAmount(a.consume_amount)
          a.avaliableAmountStr = util.showAmount(a.avaliableAmount)
          totalIncome += a.income_amount
          totalConsume += a.consume_amount
        }
        console.log('accounts', accounts)
        that.setData({accounts, totalIncome, totalConsume, 
          totalIncomeStr: util.showAmount(totalIncome), totalConsumeStr: util.showAmount(totalConsume)})
      },
      complete:(res)=>{
        that.setData({dealing: false})
      }
    })

  },
  setKey(e){
    var that = this
    that.setData({key: e.detail.value})
  },
  gotoDetail(e){
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'deposit_detail?id=' + id.toString(),
    })
  }
})