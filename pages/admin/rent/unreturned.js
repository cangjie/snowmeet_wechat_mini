// pages/admin/rent/unreturned.js
const app = getApp()
const util = require('../../../utils/util')
Page({

  /**
   * Page initial data
   */
  data: {
    querying: false,
    classList:[]
  },
  shopSelected(e){
    var that = this
    that.setData({shop: e.detail.shop})
  },
  getData(){
    var that = this
    that.setData({querying: true})
    var getUrl = 'https://' + app.globalData.domainName + '/core/Rent/GetUnReturnedItems?sessionKey=' + encodeURIComponent(app.globalData.sessionKey) + '&shop=' + encodeURIComponent(that.data.shop)
    wx.request({
      url: getUrl,
      method: 'GET',
      success:(res)=>{
        if (res.statusCode != 200){
          return
        }
        var items = []
        var orders = res.data
        var classList = [{class: '总计', count: orders.length}]
        for(var i = 0; i < orders.length; i++){
          var order = orders[i]
          var item = order.details[0]
          var findInClassList = false
          for(var j = 0; j < classList.length; j++){
            if (classList[j].class == item.rent_item_class){
              classList[j].count++
              findInClassList = true
              break
            }
          }
          if (!findInClassList){
            classList.push({class: item.rent_item_class, count: 1})
          }




          item.cell_number = order.cell_number
          item.real_name = order.real_name
          var startDate = new Date(item.start_date)
          item.startDateStr = util.formatDate(startDate)
          item.startTimeStr = util.formatTimeStr(startDate)
          item.pay_option = order.pay_option
          items.push(item)
        }
        that.setData({rentItems: items, classList: classList})
      },
      complete:()=>{
        that.setData({querying: false})
      }
    })
  },
  gotoDetail(e){
    var id = e.currentTarget.id
    wx.navigateTo({
      url: 'rent_detail?id=' + id.toString(),
    })
  },
  call(e){
    var cell = e.currentTarget.id
    wx.makePhoneCall({
      phoneNumber: cell,
    })
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    app.loginPromiseNew.then(function(resovle){

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