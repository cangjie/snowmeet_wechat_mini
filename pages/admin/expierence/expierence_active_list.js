// pages/admin/expierence/expierence_active_list.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    role:''
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var that = this
    app.loginPromiseNew.then(function (resolve) {
      var getListUrl = 'https://' + app.globalData.domainName + '/core/Experience/GetExperiencesTemp?sessionkey=' + encodeURIComponent(app.globalData.sessionKey)
      wx.request({
        url: getListUrl,
        success: (res) => {
          var expierenceListArr = res.data
          for(var i = 0; i < expierenceListArr.length; i++) {
            var refund = false
            var exp = expierenceListArr[i]
            if (util.exists(exp) && util.exists(exp.order) && util.exists(exp.order.refunds)){
              for(var j = 0; j < exp.order.refunds.length; j++){
                if (exp.order.refunds[j].refund_id != ''){
                  refund = true
                  break
                }
              }
            }
            if (refund){
              expierenceListArr.splice(i, 1)
              i--
            }
            else {
              var endTime = new Date(expierenceListArr[i].end_time)
              expierenceListArr[i].endTimeStr = endTime.getFullYear().toString() + '-' + (endTime.getMonth()+1).toString() + '-' + endTime.getDate().toString() + ' ' + endTime.getHours().toString() + ':' + endTime.getMinutes().toString()
            }
          }
          that.setData({role: app.globalData.role, expierence_list_arr: res.data})
        }
      })
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
  gotoRefund: function(e) {
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'expierence_refund?id=' + id
    })
  }
})