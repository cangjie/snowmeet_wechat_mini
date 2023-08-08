// pages/admin/recept/recept_list.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    shop: ''
  },
  gotoDetail(e){
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'recept?id=' + id,
    })
  },
  shopSelected(e){
    console.log('shop selected', e)
    var that = this
    that.setData({shop: e.detail.shop})
    that.getData()
  },
  getData(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/Recept/GetUnSubmitRecept?shop=' 
      + encodeURIComponent(that.data.shop) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var receptList = res.data
        for(var i = 0; i < receptList.length; i++){
          var recept = receptList[i]
          var rDate = new Date(recept.create_date)
          recept.create_date_dateStr = util.formatDate(rDate)
          recept.create_date_timeStr = util.formatTimeStr(rDate)
        }
        that.setData({receptList: receptList})
      }
    })
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
    app.loginPromistNew.then(function (resolve){
      //that.getData()
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

  }
})