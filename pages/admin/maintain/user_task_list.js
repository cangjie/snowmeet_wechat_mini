// pages/admin/maintain/user_task_list.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {

  },
  getData(){
    var that = this
    var getTaskUrl = 'https://' + app.globalData.domainName + '/core/MaintainLive/GetTasks?start=' + encodeURIComponent('2020-01-01') + '&end=' + encodeURIComponent('2099-12-31') + '&sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + ((that.data.shop == '')? '' : '&shop=&openId=' + encodeURIComponent(that.data.openId))
    var orderList = []
    wx.request({
      url: getTaskUrl,
      method: 'GET',
      success:(res)=>{
        console.log('get tasks', res)
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

        that.setData({tasks: tasks, orderList: orderList, totalAmount: totalAmount, totalAmountStr: totalAmountStr})
      }
    })
  },
  gotoDetail(e){
    wx.navigateTo({
      url: 'task?id=' + e.currentTarget.id + '&isConfirm=1',
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    that.setData({openId: options.openId})
    app.loginPromiseNew.then(function(reolve){
      that.getData()
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