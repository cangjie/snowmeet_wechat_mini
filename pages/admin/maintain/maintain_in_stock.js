// pages/admin/maintain/maintain_in_stock.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    querying: false
  },
  gotoDetail(e){
    wx.navigateTo({
      url: 'task?id=' + e.currentTarget.id,
    })
  },
  shopSelected(e){
    console.log('shop selected', e)
    var that = this
    that.setData({shop: e.detail.shop})
  },
  getData(){
    var that = this
    that.setData({querying: true})
    var getUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetInStockTask?sessionKey=' 
      + encodeURIComponent(app.globalData.sessionKey) + '&shop=' + encodeURIComponent(that.data.shop)
    wx.request({
      url: getUrl,
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var tasks = res.data
        for(var i = 0; i < tasks.length; i++){
          var task = tasks[i]
          task.memo = ''
          task.date = util.formatDate(new Date(task.create_date))
          if (task.confirmed_equip_type == '双板' && task.confirmed_serial == ''){
            task.memo = '信息不全'
          }
          if (task.order != undefined && task.order != null 
            && task.order.final_price != undefined && task.order.final_price != null){
              task.orderPriceStr = util.showAmount(task.order.final_price)
          }
          else {
            task.orderPriceStr = '---'
          }
          
        }
        that.setData({tasks: tasks})
      },
      complete:(res)=>{
        that.setData({querying: false})
      }
    })
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    app.loginPromiseNew.then(function (resovle) {

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