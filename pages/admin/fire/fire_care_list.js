// pages/admin/fire/fire_care_list.js
const app = getApp()
const util = require('../../../utils/util.js')
const data = require('../../../utils/data.js')
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
    switch(options.bizType){
      case 'care':
        that.setData({orderType: '养护'})
        wx.setNavigationBarTitle({
          title: '养护订单临时列表',
        })
        break
      case 'rent':
        that.setData({orderType: '租赁'})
        wx.setNavigationBarTitle({
          title: '租赁订单临时列表',
        })
        break
      default:
        break
    }
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
    that.data.startDate = new Date("2025-10-21")
    that.data.endDate = new Date("2026-12-31")
    app.loginPromiseNew.then(function (resolve){
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
    data.getOrdersByStaffPromise(null, null, null, null, that.data.orderType, '2025-10-01', '2026-12-31', 
    null, null, null, null, null, null, null, app.globalData.sessionKey).then(function (orders){
      console.log('get orders', orders)
      that.renderOrders(orders)
      //that.setData({orders})
    }).catch(function (exp){

    })
  },
  renderOrders(orders){
    var that = this
    var totalAmount = 0
    for(var i = 0; orders && i < orders.length; i++){
      var order = orders[i]
      var bizDate = new Date(order.biz_date)
      order.dateStr = util.formatDate(bizDate)
      order.timeStr = util.formatTimeStr(bizDate)
      totalAmount += order.totalCharge
      order.totalChargeStr = util.showAmount(order.totalCharge)
      
      var calledName = ''
      var member = order.member
      var cell = ''
      var memberShip = '【散】'
      if (order.contact_name){
        calledName = order.contact_name + (order.contact_gender == '男' ? '(先生)' : (order.contact_gender == '女' ? '(女士)' : ''))
        cell = order.contact_num
      }
      else if (member){
        calledName = member.real_name + (member.gender == '男' ? ' 先生' : (member.gender == '女' ? ' 女士' : ''))
        cell = member.cell
      }
      if(member && member.following_wechat == 1){
        memberShip = '【会】'
      }
      order.calledName = calledName
      order.cell = cell
      order.memberShip = memberShip

      for(var j = 0; order.availablePayments && j < order.availablePayments.length; j++){
        order.payMethod = order.availablePayments[j].pay_method
      }

    }
    that.setData({orders, totalAmount})
  },
  gotoDetail(e){
    var that = this
    if (that.data.orderType == '租赁'){
      wx.navigateTo({
        url: 'fire_order_detail?id=' + e.currentTarget.id,
      })
    }
  }
})