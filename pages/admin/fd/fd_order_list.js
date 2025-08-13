// pages/admin/fd/fd_order_list.js
const app = getApp()
const util = require('../../../utils/util.js')
Page({

  /**
   * Page initial data
   */
  data: {
    querying: false,
    searchTags: [],
    /*
    checkBoxes:[
      {title: '全部', value: '', checked: true},
      {title: '支付中', value: '支付中', checked: false},
      {title: '挂账', value: '挂账', checked: false},
      {title: '招待', value: '招待', checked: false},
      {title: '减免', value: '减免', checked: false},
      {title: '已完成', value: '已完成', checked: false}
    ]
    */
   sortType: ['时间倒序','时间正序','金额倒序','金额正序']
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad(options) {
    var that = this
    var currentDate = util.formatDate(new Date())
    that.setData({currentDate, startDate: currentDate, endDate: currentDate})
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
      that.setData({staff: app.globalData.staff})
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
    var qUrl = app.globalData.requestPrefix + 'Order/GetOrdersByStaff?shop=' + encodeURIComponent(that.data.shop) + '&type=' + encodeURIComponent('餐饮') + '&startDate=' + util.formatDateString(that.data.startDate) + '&endDate=' + util.formatDateString(that.data.endDate) + '&sessionKey=' + app.globalData.sessionKey
    that.setData({querying: true})
    console.log('query url', qUrl)
    util.performWebRequest(qUrl, null).then(function (resolve){
      var orders = resolve
      console.log('get orders', orders)
      that.setData({querying: false})
    }).catch(function (reject){
      that.setData({querying: false})
    })
  },
  shopSelected(e){
    var that = this
    console.log('shop selected', e)
    that.setData({shop: e.detail.shop})
  },
  setDate(e){
    var id = e.currentTarget.id
    var that = this
    console.log('select date', e)
    switch(id){
      case 'start':
        that.setData({startDate: e.detail.value})
        break
      case 'end':
        that.setData({endDate: e.detail.value})
        break
      default:
        break
    }
  },
  setTags(e){
    var that = this
    console.log('set tags', e)
    var checkBoxes = that.data.checkBoxes
    var haveCheckedAll = checkBoxes[0].checked
    var oriTags = e.detail.value
    if (!haveCheckedAll){
      for(var i = 0; i < checkBoxes.length; i++){
        checkBoxes[i].checked = false
      }
      for(var i = 0; i < oriTags.length; i++){
        if (oriTags[i] == ''){
          for(var j = 1; j < checkBoxes.length; j++){
            checkBoxes[j].checked = false
          }
          checkBoxes[0].checked = true
          break
        }
        for(var j = 0; j < checkBoxes.length; j++){
          if (checkBoxes[j].value == oriTags[i]){
            checkBoxes[j].checked = true
          }
        }
      }
    }
    else{
      for(var i = 0; i < oriTags.length; i++){
        for(var j = 0; j < checkBoxes.length; j++){
          checkBoxes[i].checked = false
        }
        for(var j = 1; j < checkBoxes.length; j++){
          if (checkBoxes[j].value == oriTags[i]){
            checkBoxes[j].checked = true
          }
        }
      }
    }
    that.setData({checkBoxes})
  }
})