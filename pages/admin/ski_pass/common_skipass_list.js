// pages/admin/ski_pass/common_skipass_list.js
const app = getApp()
const util = require('../../../utils/util.js')
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
    var that = this
    app.loginPromiseNew.then(function(resovle){
      that.getResortArr()
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

  },
  getResortArr(){
    var that = this
    var getUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetResorts'
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        var resortArr = []
        if (res.statusCode != 200){
          resortArr = ['万龙', '云顶', '太舞']
        }
        else{
          resortArr = res.data
        }
        
    
        this.setData({resort: resortArr[0], resortArr })
        that.getData()
      }
    })
  },
  getData(){
    var that = this
    that.setData({querying: true})
    var getUrl = 'https://' + app.globalData.domainName + '/core/SkiPass/GetProductsByResort?resort=' + encodeURIComponent(that.data.resort) + '&showHidden=1'
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          that.setData({querying: false})
        }
        var list = res.data
        for(var i = 0; i < list.length; i++){
          list[i].weekendDealPriceStr = util.showAmount(list[i].weekendDealPrice)
          list[i].commonDayDealPriceStr = util.showAmount(list[i].commonDayDealPrice)
          if (list[i].hidden == 1){
            list[i].color = 'red'
          }
          else {
            list[i].color = ''
          }
        }
        that.setData({list})
        that.setData({querying: false})
      }
    })
  },
  changeResort(e){
    var that = this
    var resort = e.detail.value
    that.setData({resort})
    that.getData()
  }
})