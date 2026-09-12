// pages/admin/ski_pass/dhhs_skipass_order.js
// pages/admin/ski_pass/nanshan_reserve.js
const app = getApp()
const util = require('../../../utils/util.js')
const adminAssistant = require('../../../utils/adminAssistant.js')
Page({

  /**
   * Page initial data
   */
  data: {
    // 本页原本只看单日；AI 查询会给一个日期区间，用 startDate/endDate 承接。
    // 后端 GetDHHSReservedSkipasses 本来就收 start/end，之前一直传同一天而已。
    aiQueryApplied: false,
    aiQueryConditions: ''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var aiState = adminAssistant.applyPageIntent('ski_pass.show_results', options)
    if (aiState) {
      that.setData({
        aiQueryApplied: true,
        aiQueryConditions: aiState.aiQueryConditions,
        startDate: aiState.startDate,
        endDate: aiState.endDate,
        currentDate: aiState.startDate
      })
      return
    }
    var currentDate = util.formatDate(new Date())
    that.setData({currentDate})
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
  gotoNext(){
    var that = this
    var currentDate = new Date(that.data.currentDate)
    currentDate = currentDate.setDate(currentDate.getDate() + 1)
    that.setData({currentDate: util.formatDate(new Date(currentDate)), aiQueryApplied: false, aiQueryConditions: ''})
    that.getData()
  },

  gotoPrev(){
    var that = this
    var currentDate = new Date(that.data.currentDate)
    currentDate = currentDate.setDate(currentDate.getDate() - 1)
    that.setData({currentDate: util.formatDate(new Date(currentDate)), aiQueryApplied: false, aiQueryConditions: ''})
    that.getData()
  },
  selectDate(e){
    var that = this
    var currentDate = e.detail.value
    that.setData({currentDate, aiQueryApplied: false, aiQueryConditions: ''})
  },
  getData(){
    var that = this
    var start = that.data.aiQueryApplied && that.data.startDate ? that.data.startDate : that.data.currentDate
    var end = that.data.aiQueryApplied && that.data.endDate ? that.data.endDate : that.data.currentDate
    var getUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetDHHSReservedSkipasses?start=' + util.formatDate(new Date(start)) + '&end=' + util.formatDate(new Date(end)) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        console.log('skipasses', res)
        if (res.statusCode != 200){
          return
        }
        var skipasses = res.data
        for(var i = 0; i < skipasses.length; i++){
          var skipass = skipasses[i]
          skipass.reserve_dateStr = util.formatDate(new Date(skipass.reserve_date))
          skipass.deal_priceStr = util.showAmount(skipass.deal_price)
        }
        that.setData({skipasses})
      }
    })
  },
  cancel(e){
    var that = this
    that.setData({cancelling: true})
    var id = e.currentTarget.id
    var cancelUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/Cancel/' + id + '?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: cancelUrl,
      success:(res)=>{
        console.log('cancel result', res)
        //that.setData({cancelling: false})
        that.getData()
      }
    })
  },
  refund(e){
    var that = this
    that.setData({cancelling: true})
    var id = e.currentTarget.id
    var cancelUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/Refund?skipassId=' + id + '&reason=' + encodeURIComponent('确认取消成功后退款') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&sessionType=' + encodeURIComponent('wechat_mini_openid')
    wx.request({
      url: cancelUrl,
      success:(res)=>{
        console.log('cancel result', res)
        //that.setData({cancelling: false})
        that.getData()
      }
    })
  }
})