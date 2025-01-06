// pages/admin/maintain/search_quick.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    loading: false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.data.loading = true
    console.log('load')
    app.loginPromiseNew.then(function(resolve){
      that.data.loading = false
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
    var that = this
    console.log('show', that.data.loading)
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
  shopSelected(e){
    var that = this
    that.setData({shop: e.detail.shop})
    that.getData()
  },
  setCell(e){
    var that = this
    that.setData({cell: e.detail.value})
    that.getData()
  },
  getData(){
    var that = this
    var shop = that.data.shop
    var cell = that.data.cell
    if (!cell || cell.length < 4){
      return
    }
    var getUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetTasksQuick/' + cell + '?shop=' + encodeURIComponent(shop) + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey)
    var orderList = []
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var tasks = res.data
        for(var i = 0; i < tasks.length; i++){
          var task = tasks[i]
          task.memo = ''
          task.date = util.formatDate(new Date(task.create_date))
          task.time = util.formatTimeStr(new Date(task.create_date))
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
          if (task.order_id > 0){
            var exists = false
            for(var j = 0; j < orderList.length; j++){
              if (orderList[j].id == task.order_id){
                exists = true
                break
              }
            }
            if (!exists ){
              orderList.push(task.order)
            }
          }
        }
        var totalAmount = 0
        for(var i = 0; i < orderList.length; i++){
          totalAmount += orderList[i].final_price
        }
        var totalAmountStr = util.showAmount(totalAmount)

        that.setData({tasks: tasks, orderList: orderList, totalAmount: totalAmount, totalAmountStr: totalAmountStr, querying: false})
        //that.setData({tasks})
      }
    })
  },
  gotoDetail(e){
    wx.navigateTo({
      url: 'task?id=' + e.currentTarget.id,
    })
  }
})