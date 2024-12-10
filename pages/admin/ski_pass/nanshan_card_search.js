// pages/admin/ski_pass/nanshan_card_search.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    keyword: '',
    searching: false
  },
  setKeyword(e){
    var that = this
    var v = e.detail.value
    that.setData({keyword: v})
  },
  getData(){
    var that = this
    var url = 'https://' + app.globalData.domainName + '/core/NanshanSkipass/SearchSkipass?key=' + encodeURIComponent(that.data.keyword) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    wx.request({
      url: url,
      method: 'GET',
      success:(res)=>{
        that.setData({searching: false})
        if (res.statusCode != 200){
          return
        }
        var list = res.data
        for(var i = 0; i < list.length; i++){
          list[i].reserveDateStr = util.formatDate(new Date(list[i].reserveDate))
        }
        that.setData({list})
        console.log('list', list)
      }
    })
  },
  search(){
    var that = this
    that.setData({searching: true})
    that.getData()
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    app.loginPromiseNew.then(function(resolve){

    })
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