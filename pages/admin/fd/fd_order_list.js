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
   sortType: ['时间倒序','时间正序','应付金额倒序','应付金额正序'],
   currentSortType: '时间倒序',
   queryOptions:[
    {key: 'isTest', value: false},
    {key: 'isEnterain', value: false},
    {key: 'isPackage', value: false},
    {key: 'isOnCredit', value: false},
    {key: 'haveDiscount', value: null},
    {key: 'status', value: '已完成'}
    ]
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
    var subQuery = ''
    var queryOptions = that.data.queryOptions
    for(var i = 0; i < queryOptions.length; i++){
      if (queryOptions[i].value != null){
        subQuery += '&' + queryOptions[i].key + '=' + queryOptions[i].value
      }
    }
    qUrl = qUrl + subQuery
    that.setData({querying: true})
    console.log('query url', qUrl)
    util.performWebRequest(qUrl, null).then(function (resolve){
      var orders = resolve
      console.log('get orders', orders)
      that.renderOrders(resolve)
      that.setData({querying: false})
    }).catch(function (reject){
      that.setData({querying: false})
    })
  },
  renderOrders(orders){
    var that = this
    if (orders == null){
      orders = that.data.orders
    }
    var sort = that.data.currentSortType
    switch(sort){
      case '时间倒序':
        orders = orders.sort((a, b)=>{b.id - a.id})
        break
      case '时间正序':
        orders = orders.sort((a, b) => {a.id - b.id})
        break
      case '应付金额倒序':
        orders = order.sort((a, b)=> {b.totalCharge - a.totalCharge})
        break
      case '应付金额正序':
        orders = order.sort((a, b)=> {a.totalCharge - b.totalCharge})
        break
      default:
        break
    }
    var totalAmount = 0
    for(var i = 0; orders && i < orders.length; i++){
      var order = orders[i]
      var bizDate = new Date(order.biz_date)
      order.dateStr = util.formatDate(bizDate)
      order.timeStr = util.formatTimeStr(bizDate)
      totalAmount += order.totalCharge
      order.totalChargeStr = util.showAmount(order.totalCharge)
    }

    that.setData({orders, totalAmount, totalAmountStr: util.showAmount(totalAmount)})
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
  },
  gotoDetail(e){
    wx.navigateTo({
      url: 'fd_order_detail',
    })
  },
  setQueryOptions(e){
    var that = this
    var id = e.currentTarget.id
    that.setQueryOptionValue(id, e.detail.value)
  },
  setQueryOptionValue(key, value){
    var that = this
    var queryOptions = that.data.queryOptions
    for(var i = 0; i < queryOptions.length; i++){
      if (queryOptions[i].key == key){
        switch(value){
          case 'null':
            queryOptions[i].value = null
            break
          case 'true':
            queryOptions[i].value = true
            break
          case 'false':
            queryOptions[i].value = false
            break
          default:
            queryOptions[i].value = value
            break
        }
      }
    }
    console.log('set query options', queryOptions)
  },
  setSortType(e){
    var that = this
    that.setData({currentSortType: that.data.sortType[e.detail.value]})
    if (that.data.orders){
      that.renderOrders()
    }
  }
})